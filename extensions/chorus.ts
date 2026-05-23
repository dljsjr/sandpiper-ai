import { randomUUID } from 'node:crypto';
import { stat, unlink } from 'node:fs/promises';
import type * as net from 'node:net';
import { dirname, join, normalize } from 'node:path';
import type { ExtensionAPI, ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import sanitize from 'sanitize-filename';
import { Type } from 'typebox';
import {
  type ChorusReplyResult,
  type ChorusRoomBroker,
  createChorusRoomBroker,
  sendChorusReply,
} from './chorus/chorus-runtime';
import {
  choosePeers,
  clearChorusRoomUi,
  registerChorusMessageRenderer,
  sendChorusMessageToChat,
  setChorusRoomUi,
} from './chorus/chorus-ui';
import { createServerWithNotificationSender, isSocketAlive, sendPayloadFrame } from './tattler/tattler-ipc';
import {
  onChorusRoomDelivery,
  onChorusRoomPostReceived,
  onChorusRoomPostRequest,
  requestListPeers,
  requestOwnIdentity,
} from './tattler/tattler-pi-events';
import {
  type ChorusReplyRouteV0,
  type ChorusRoomDeliveryV0,
  type ChorusRoomId,
  type ChorusRoomPostV0,
  roomId,
  type TattlerIdentityV0,
  type TattlerMessageId,
} from './tattler/tattler-protocol';

interface BrokerEndpoint {
  readonly route: ChorusReplyRouteV0;
  readonly server: net.Server;
  readonly socketPath: string;
}

interface ActiveChorusRoom {
  readonly broker: ChorusRoomBroker;
  readonly endpoint: BrokerEndpoint;
  readonly peers: readonly TattlerIdentityV0[];
  requestRender?: () => void;
}

let activeRoom: ActiveChorusRoom | undefined;
let eventUnsubscribers: Array<() => void> = [];
let ownIdentityRequest: Promise<TattlerIdentityV0> | undefined;

function clearEventListeners(): void {
  for (const unsubscribe of eventUnsubscribers.splice(0)) {
    unsubscribe();
  }
}

async function stopActiveRoom(): Promise<void> {
  const room = activeRoom;
  activeRoom = undefined;
  if (!room) return;

  await closeServer(room.endpoint.server);
  await unlink(room.endpoint.socketPath).catch(() => undefined);
}

async function closeServer(server: net.Server): Promise<void> {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}

async function resolveOwnIdentity(pi: ExtensionAPI): Promise<TattlerIdentityV0 | undefined> {
  ownIdentityRequest ??= requestOwnIdentity(pi);
  try {
    return await ownIdentityRequest;
  } catch (err) {
    ownIdentityRequest = undefined;
    console.warn('Chorus could not resolve local Tattler identity: ', err);
    return undefined;
  }
}

function roomSocketPath(ownIdentity: TattlerIdentityV0, room: ChorusRoomId): string {
  const safeRoom = sanitize(room) || 'room';
  return normalize(
    join(dirname(ownIdentity.socketPath), `${ownIdentity.shortId}-chorus-${safeRoom}-${randomUUID()}.sock`),
  );
}

function defaultLocalAuthorName(ownIdentity: TattlerIdentityV0): string {
  return process.env.USER || process.env.USERNAME || ownIdentity.name;
}

function localAuthorName(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error('Chorus display name must be a non-empty string');
  }
  if (trimmed.includes('\n') || trimmed.includes('\r')) {
    throw new Error('Chorus display name must be a single line');
  }

  return trimmed;
}

async function createBrokerEndpoint(
  pi: ExtensionAPI,
  ownIdentity: TattlerIdentityV0,
  room: ChorusRoomId,
): Promise<BrokerEndpoint> {
  const socketPath = roomSocketPath(ownIdentity, room);
  if (await stat(socketPath, { throwIfNoEntry: false })) {
    if (await isSocketAlive(socketPath)) {
      throw new Error(`Chorus broker socket already exists and is alive: ${socketPath}`);
    }
    await unlink(socketPath);
  }

  const server = createServerWithNotificationSender(pi);
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(socketPath, () => {
        server.removeListener('error', reject);
        resolve();
      });
    });
  } catch (err) {
    server.close();
    throw err;
  }

  return {
    route: {
      name: `chorus:${room}:${ownIdentity.name}`,
      shortId: `chorus-${ownIdentity.shortId}`,
      socketPath,
    },
    server,
    socketPath,
  };
}

async function openRoom(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  ownIdentity: TattlerIdentityV0,
  room: ChorusRoomId,
  peers: readonly TattlerIdentityV0[],
  authorName: string,
): Promise<void> {
  await stopActiveRoom();
  const endpoint = await createBrokerEndpoint(pi, ownIdentity, room);
  const broker = createChorusRoomBroker({
    roomId: room,
    ownIdentity,
    localAuthorName: authorName,
    brokerRoute: endpoint.route,
    peers,
    sendFrame: sendPayloadFrame,
    onUpdate: () => activeRoom?.requestRender?.(),
  });

  activeRoom = { broker, endpoint, peers };
  setChorusRoomUi({
    pi,
    ctx,
    room,
    broker,
    peers,
    onRenderReady: (requestRender) => {
      if (activeRoom?.broker === broker) {
        activeRoom.requestRender = requestRender;
      }
    },
  });
}

async function closeRoomUi(ctx: ExtensionCommandContext): Promise<void> {
  await stopActiveRoom();
  clearChorusRoomUi(ctx);
}

async function handleRoomPostReceived(pi: ExtensionAPI, post: ChorusRoomPostV0): Promise<void> {
  activeRoom?.broker.recordRoomPost(post);
  const ownIdentity = await resolveOwnIdentity(pi);
  if (ownIdentity && post.from === ownIdentity.name) {
    return;
  }

  sendChorusMessageToChat(pi, {
    roomId: post.roomId,
    from: post.from,
    message: post.message,
    postId: post.id,
    broker: post.broker,
  });
}

async function handleRoomDelivery(pi: ExtensionAPI, delivery: ChorusRoomDeliveryV0): Promise<void> {
  const room = activeRoom;
  if (!room) {
    return;
  }

  const accepted = room.broker.acceptDelivery(delivery);
  if (!accepted || room.broker.isLocalAuthor(delivery.from)) {
    return;
  }

  sendChorusMessageToChat(pi, {
    roomId: delivery.roomId,
    from: delivery.from,
    message: delivery.message,
    postId: accepted.postId,
    broker: room.broker.brokerRoute,
  });
}

const SendChorusReplyParameters = Type.Object({
  roomId: Type.String({ description: 'Chorus room ID from the incoming Chorus message' }),
  postId: Type.String({ description: 'Original Chorus room post ID being replied to' }),
  brokerName: Type.String({ description: 'Broker route name from the incoming Chorus message' }),
  brokerShortId: Type.String({ description: 'Broker route shortId from the incoming Chorus message' }),
  brokerSocketPath: Type.String({ description: 'Broker route socketPath from the incoming Chorus message' }),
  message: Type.String({ description: 'Reply text to send to the Chorus room broker' }),
});

type ChorusReplyToolDetails =
  | ChorusReplyResult
  | { readonly kind: 'error'; readonly messageIdAck: TattlerMessageId; readonly error: string };

function registerChorusReplyTool(pi: ExtensionAPI): void {
  pi.registerTool<typeof SendChorusReplyParameters, ChorusReplyToolDetails>({
    name: 'send_chorus_reply',
    label: 'Send Chorus Reply',
    description: 'Reply to a Chorus room message through the broker route embedded in that message',
    promptSnippet:
      'Send a reply to a Chorus room via the provided broker route. Use this instead of a plain Tattler DM for Chorus replies.',
    promptGuidelines: [
      'Use this when a visible Chorus room message asks for a substantive reply.',
      'Copy roomId, postId, and broker route fields from the Chorus message metadata in context.',
      'Do not use send_peer_message for Chorus room replies unless the user explicitly asks for a direct Tattler DM.',
    ],
    parameters: SendChorusReplyParameters,
    async execute(_toolCallId, params) {
      let deliveryId = params.postId as TattlerMessageId;
      try {
        const ownIdentity = await requestOwnIdentity(pi);
        const selectedRoom = roomId(params.roomId);
        const broker = {
          name: params.brokerName,
          shortId: params.brokerShortId,
          socketPath: params.brokerSocketPath,
        };
        const result = await sendChorusReply({
          activeBroker: activeRoom?.broker,
          roomId: selectedRoom,
          from: ownIdentity.name,
          postId: params.postId,
          broker,
          message: params.message,
          sendFrame: sendPayloadFrame,
        });
        if (result.kind === 'local-post') {
          deliveryId = result.postId;
          return {
            content: [{ type: 'text', text: `Chorus reply posted locally through broker as ${result.postId}` }],
            details: result,
          };
        }

        deliveryId = result.messageIdAck;
        return {
          content: [
            {
              type: 'text',
              text: `Chorus reply ${result.messageIdAck} received transport ACK from broker route ${params.brokerName}`,
            },
          ],
          details: result,
        };
      } catch (err) {
        const errMessage = `Error sending Chorus reply ${deliveryId}: ${err instanceof Error ? err.message : String(err)}`;
        return {
          content: [{ type: 'text', text: errMessage }],
          isError: true,
          details: { kind: 'error', messageIdAck: deliveryId, error: errMessage },
        };
      }
    },
  });
}

export default function (pi: ExtensionAPI) {
  void stopActiveRoom();
  clearEventListeners();
  registerChorusMessageRenderer(pi);
  registerChorusReplyTool(pi);

  eventUnsubscribers = [
    onChorusRoomPostRequest(pi, (request) => {
      if (!activeRoom || request.roomId !== activeRoom.broker.roomId) {
        throw new Error(`No active Chorus broker for room ${request.roomId}`);
      }
      return activeRoom.broker.postLocalMessage(request.message);
    }),
    onChorusRoomPostReceived(pi, (post) => {
      void handleRoomPostReceived(pi, post);
    }),
    onChorusRoomDelivery(pi, (delivery) => {
      void handleRoomDelivery(pi, delivery);
    }),
  ];

  pi.registerCommand('chorus', {
    description: 'Open or close an ephemeral Chorus room backed by a local Tattler broker',
    handler: async (_args, ctx) => {
      if (activeRoom) {
        await closeRoomUi(ctx);
        ctx.ui.notify('Chorus: room closed', 'info');
        return;
      }

      const roomInput = await ctx.ui.input('Chorus room ID:', 'chorus-dev');
      if (!roomInput) return;

      let selectedRoom: ChorusRoomId;
      try {
        selectedRoom = roomId(roomInput);
      } catch (err) {
        ctx.ui.notify(`Chorus: ${err instanceof Error ? err.message : String(err)}`, 'error');
        return;
      }

      let ownIdentity: TattlerIdentityV0;
      let peers: TattlerIdentityV0[];
      try {
        [ownIdentity, peers] = await Promise.all([requestOwnIdentity(pi), requestListPeers(pi)]);
        ownIdentityRequest = Promise.resolve(ownIdentity);
        peers = peers.filter((peer) => peer.socketPath !== ownIdentity.socketPath);
      } catch {
        ctx.ui.notify('Chorus: Tattler identity or peer discovery unavailable', 'error');
        return;
      }

      if (peers.length === 0) {
        ctx.ui.notify('Chorus: no live peers available', 'warning');
        return;
      }

      const authorInput = await ctx.ui.input(
        'Chorus display name for your messages:',
        defaultLocalAuthorName(ownIdentity),
      );
      if (!authorInput) return;

      let authorName: string;
      try {
        authorName = localAuthorName(authorInput);
      } catch (err) {
        ctx.ui.notify(`Chorus: ${err instanceof Error ? err.message : String(err)}`, 'error');
        return;
      }

      const selectedPeers = await choosePeers(ctx, peers);
      if (!selectedPeers || selectedPeers.length === 0) {
        ctx.ui.notify('Chorus: no peers selected, room not opened', 'info');
        return;
      }

      try {
        await openRoom(pi, ctx, ownIdentity, selectedRoom, selectedPeers, authorName);
        ctx.ui.notify(
          `Chorus: opened #${selectedRoom} as ${authorName} with ${selectedPeers.length} peer${selectedPeers.length === 1 ? '' : 's'}`,
          'info',
        );
      } catch (err) {
        await closeRoomUi(ctx);
        ctx.ui.notify(`Chorus: failed to open room — ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    },
  });

  pi.on('session_shutdown', () => {
    clearEventListeners();
    ownIdentityRequest = undefined;
    void stopActiveRoom();
  });
}
