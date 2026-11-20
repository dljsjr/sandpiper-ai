// Tattler v0 validation spike.
// Intentionally single-file and not a stable API.
// Do not extend this into the v1 architecture without first extracting core/runtime boundaries.

import { unlinkSync } from 'node:fs';
import { stat, unlink } from 'node:fs/promises';
import type * as net from 'node:net';
import { join, normalize } from 'node:path';
import { StringEnum } from '@earendil-works/pi-ai';
import type { CustomEntry, ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { sessionShortIdGenerator } from '../../packages/core/src/utils.js';
import {
  identityFilePathFor,
  isIdentityFileHeldByLivePeer,
  listPeerSockets,
  removeIdentityFileIfOwn,
  sweepDeadEndpoints,
  writeIdentityFile,
} from './tattler-identity';
import { createTattlerPendingInbox, TATTLER_PENDING_INBOX_ENTRY_KEY } from './tattler-inbox';
import { registerTattlerPendingInboxHooks } from './tattler-inbox-hooks';
import { createTattlerPendingInboxSnapshot, restoreTattlerPendingInboxFromSession } from './tattler-inbox-persistence';
import { registerTattlerPendingBatchRenderer } from './tattler-inbox-renderer';
import {
  createServerWithNotificationSender,
  probeSocket,
  sendAgentMessage,
  shutdownTattlerServer,
} from './tattler-ipc';
import { createTattlerPendingInboxNotifier, trackAgentRun } from './tattler-pending-cue';
import { onListPeersRequest, onOwnIdentityRequest, onTattlerPendingMessageQueueRequest } from './tattler-pi-events';
import {
  buildMessage,
  MAX_MESSAGE_BYTES,
  MAX_PROTOCOL_REQUEST_BYTES,
  type MessageProps,
  type SendAgentMessageResult,
  serializeToJsonl,
  stripProtocolFrame,
  TATTLER_ID_ENTRY_KEY,
  type TattlerAgentMessageV0,
  type TattlerIdentityV0,
} from './tattler-protocol';
import { registerTattlerReceiveTool } from './tattler-receive';
import { runtimeDir } from './tattler-runtime-dir';

// extension-global variable for now
let server: net.Server | undefined;
let ownEndpoint: OwnEndpoint | undefined;
let stopRemovingEndpointOnExit: (() => void) | undefined;
let stopEndpointWatch: (() => void) | undefined;

// Another session's sweep can remove a long-suspended session's files, since its socket may refuse
// connections while its backlog is full. Checking once a second restores them when it runs again.
const ENDPOINT_WATCH_INTERVAL_MS = 1_000;

interface OwnEndpoint {
  readonly socketPath: string;
  identityFile?: string;
}

// A session waits this long before treating another session's refused socket as dead, so it never
// removes one that is between bind and listen.
const DEAD_ENDPOINT_MIN_AGE_MS = 10_000;

// process.exit skips session_shutdown (Pi's emergencyTerminalExit and uncaughtCrash call it), and
// Node does not remove a Unix socket file on exit, so remove the endpoint from the exit event, which
// allows only synchronous work.
function removeEndpointOnExit(endpoint: OwnEndpoint): void {
  stopRemovingEndpointOnExit?.();
  const removeEndpoint = () => {
    try {
      unlinkSync(endpoint.socketPath);
    } catch {}
    if (endpoint.identityFile) removeIdentityFileIfOwn(endpoint.identityFile, endpoint.socketPath);
  };
  process.on('exit', removeEndpoint);
  stopRemovingEndpointOnExit = () => {
    process.off('exit', removeEndpoint);
    stopRemovingEndpointOnExit = undefined;
  };
}
let eventResponderUnsubscribers: Array<() => void> = [];

function clearEventResponders(): void {
  for (const unsubscribe of eventResponderUnsubscribers.splice(0)) {
    unsubscribe();
  }
}

//#region Pi API Integration
// ============================================================================
// Begin Pi API Integration
// ============================================================================
const TATTLER_ROUTING_PROMPT_GUIDELINE =
  'Use send_peer_message directly when you know the recipient name, shortId, or socket path; use list_peers only when routing is unknown.';

function registerListPeersTool(tattlerRuntimeDir: string, ownIdentity: TattlerIdentityV0, pi: ExtensionAPI) {
  pi.registerTool({
    name: 'list_peers',
    label: 'List Peers',
    exposure: 'deferred',
    promptSnippet:
      'Lists routing information for other Tattler participants with active endpoints for Tattler messages',
    promptGuidelines: [TATTLER_ROUTING_PROMPT_GUIDELINE],
    description: 'List other agent peers with live sockets, which means they are candidates for receiving messages',
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
      const peerSockets = await listPeerSockets(tattlerRuntimeDir, ownIdentity);
      const thisSession = `This session: ${ownIdentity.name} [shortId: ${ownIdentity.shortId}]`;
      if (peerSockets.length === 0) {
        return {
          content: [{ type: 'text', text: `${thisSession}\nNo active peers available` }],
          details: { peers: [] },
        };
      }

      const lines = peerSockets.map((peer) => {
        return `- ${peer.name}         [shortId: ${peer.shortId}]`;
      });

      const resultText = `${thisSession}\nPeers:\n${lines.join('\n')}`;

      return {
        content: [{ type: 'text', text: resultText }],
        details: { peerSockets },
      };
    },
  });
}

// v0 dogfood shortcut: every identity property is routable so identity-shape
// changes automatically show up in the tool schema. The production agent
// directory should define an explicit, versioned routing surface.
const __IdentityTemplate: MessageProps<'tattler.identity.v0', TattlerIdentityV0> = stripProtocolFrame(
  buildMessage('tattler.identity.v0', {
    name: '',
    socketPath: '',
    shortId: '',
  }),
);

const TattlerAddressType = StringEnum(Object.keys(__IdentityTemplate), {
  description:
    'Tag indicating how to use the provided `id` to route the message to its desired recipient. Defaults to `name`',
  default: 'name',
});

function registerSendMessageTool(tattlerRuntimeDir: string, ownIdentity: TattlerIdentityV0, pi: ExtensionAPI) {
  pi.registerTool({
    name: 'send_peer_message',
    label: 'Send Peer Message',
    exposure: 'deferred',
    description: 'Send a message to a live/active peer',
    promptSnippet:
      'Send a message to another Tattler participant. Use `addressType` to control how the `id` property should be interpreted',
    promptGuidelines: [TATTLER_ROUTING_PROMPT_GUIDELINE],
    parameters: Type.Object({
      addressType: Type.Optional(TattlerAddressType),
      id: Type.String({ description: 'Target Peer ID (generalized by address type)' }),
      message: Type.String({
        description: `The authored message to send to the peer, written as your own response prose and limited to ${MAX_MESSAGE_BYTES} bytes`,
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const refuse = (errMessage: string) => ({
        content: [{ type: 'text' as const, text: errMessage }],
        isError: true,
        details: { error: errMessage },
      });
      if (params.message.trim() === '') {
        return refuse('Message is empty');
      }
      const messageLength = Buffer.byteLength(params.message, 'utf8');
      if (messageLength > MAX_MESSAGE_BYTES) {
        return refuse(
          `Message length ${messageLength} bytes > ${MAX_MESSAGE_BYTES} bytes (maximum allowed message size)`,
        );
      }

      // TODO(TAT-7) shortId is a local session locator, not a stable agent identity. Useful for v0, replace it
      // with stable agent identity once the agent directory is implemented
      const message: TattlerAgentMessageV0 = buildMessage('tattler.agent-message.v0', {
        message: params.message,
        from: ownIdentity.name,
      });
      // JSON encoding doubles quotes, backslashes, and newlines, so a message within its own limit
      // can still produce a frame the peer rejects with an uncorrelated error.
      const frameLength = Buffer.byteLength(serializeToJsonl(message), 'utf8');
      if (frameLength > MAX_PROTOCOL_REQUEST_BYTES) {
        return refuse(
          `Message frame ${frameLength} bytes > ${MAX_PROTOCOL_REQUEST_BYTES} bytes once encoded; quotes, backslashes, and line breaks count double. Shorten the message.`,
        );
      }

      const addressType = (params.addressType || 'name') as keyof TattlerIdentityV0;
      // TODO: don't probe for live sockets every single time we send a message; this could add significant latency.
      // fine for initial dogfooding though.
      const peer = (await listPeerSockets(tattlerRuntimeDir, ownIdentity)).find(
        (peer) => Object.hasOwn(peer, addressType) && peer[addressType] === params.id,
      );
      if (!peer) {
        return refuse(`No live peer with id ${params.id} to receive message`);
      }

      try {
        const sendResult: SendAgentMessageResult = await sendAgentMessage(peer, message);
        const deliveredText = `Message ${sendResult.messageIdAck} delivered to ${peer.name}. This confirms delivery only; any reply from ${peer.name} arrives as a separate message.`;
        return {
          content: [{ type: 'text', text: deliveredText }],
          details: sendResult,
        };
      } catch (sendErr) {
        const errMessage = `Error sending message ${message.id}: ${sendErr}`;
        return { content: [{ type: 'text', text: errMessage }], isError: true, details: { error: errMessage } };
      }
    },
  });
}
//#endregion

//#region Extension Factory
// ============================================================================
// Extension Factory
// ============================================================================
export default async function (pi: ExtensionAPI) {
  const pendingInbox = createTattlerPendingInbox();
  let activeContext: Pick<ExtensionContext, 'isIdle'> | undefined;
  const pendingInboxNotifier = createTattlerPendingInboxNotifier(
    pi,
    () => pendingInbox.counts().total,
    trackAgentRun(pi),
  );
  registerTattlerPendingInboxHooks(pi, pendingInbox, {
    onPendingInboxEmpty: pendingInboxNotifier.reset,
  });
  registerTattlerPendingBatchRenderer(pi);
  registerTattlerReceiveTool(pi, pendingInbox, { isIdle: () => activeContext?.isIdle() ?? true });
  const persistPendingInboxSnapshot = (): void => {
    pi.appendEntry(TATTLER_PENDING_INBOX_ENTRY_KEY, createTattlerPendingInboxSnapshot(pendingInbox));
  };
  const notifyPendingInbox = pendingInboxNotifier.notify;

  let tattlerRuntimeDir: string;
  let ownIdentity: TattlerIdentityV0;
  try {
    tattlerRuntimeDir = await runtimeDir();
  } catch (runtimeDirError) {
    console.error(
      `couldn't obtain usable runtime directory, Tattler will be unavailable for this agent session: `,
      runtimeDirError,
    );
    return;
  }

  pi.registerFlag('tattler-id', {
    description: `Use the given string for this session's Tattler ID instead of \`session:<shortUuid>\`.
The ID is persisted in the non-transcript session store via \`appendEntry\`. This flag is ignored if \`--resume\`
is used to resume an existing session.
      `,
    type: 'string',
  });

  const listenOn = async (socketPath: string): Promise<net.Server> => {
    const serverDef = createServerWithNotificationSender({
      events: pi.events,
      sendMessage: pi.sendMessage.bind(pi),
      pendingInbox,
      isIdle: () => activeContext?.isIdle() ?? true,
      persistPendingInboxSnapshot,
      notifyPendingInbox,
    });
    // Adapted from https://github.com/mitsuhiko/agent-stuff, Apache 2.0
    try {
      await new Promise<void>((resolve, reject) => {
        serverDef.once('error', reject);
        serverDef.listen(socketPath, () => {
          serverDef.removeListener('error', reject);
          resolve();
        });
      });
    } catch (netErr) {
      serverDef.close();
      throw netErr;
    }
    return serverDef;
  };

  // Restores the identity file if it is missing, and listens again if the socket file is gone. A
  // socket file that is there but is not ours is left alone.
  const watchEndpoint = (endpoint: OwnEndpoint, socketInode: number): void => {
    stopEndpointWatch?.();
    let checking = false;
    let inode = socketInode;
    const check = async () => {
      const identityFile = endpoint.identityFile;
      if (checking || ownEndpoint !== endpoint || !identityFile) return;
      checking = true;
      try {
        const socketStat = await stat(endpoint.socketPath, { throwIfNoEntry: false });
        if (socketStat === undefined) {
          // Close the old server first: closing it can unlink the path, which by then would be the
          // new socket's.
          const previous = server;
          server = undefined;
          if (previous) await shutdownTattlerServer(previous);
          const restored = await listenOn(endpoint.socketPath);
          if (ownEndpoint !== endpoint) {
            // The session shut down while this check ran.
            await shutdownTattlerServer(restored);
            await unlink(endpoint.socketPath).catch(() => {});
            return;
          }
          server = restored;
          inode = (await stat(endpoint.socketPath)).ino;
        } else if (socketStat.ino !== inode) {
          return;
        }
        if ((await stat(identityFile, { throwIfNoEntry: false })) === undefined) {
          await writeIdentityFile(identityFile, ownIdentity);
        }
      } catch (watchErr) {
        console.warn('Tattler could not restore its endpoint: ', watchErr);
      } finally {
        checking = false;
      }
    };
    const timer = setInterval(() => void check(), ENDPOINT_WATCH_INTERVAL_MS);
    timer.unref();
    stopEndpointWatch = () => {
      clearInterval(timer);
      stopEndpointWatch = undefined;
    };
  };

  pi.on('session_start', async (evt, ctx) => {
    clearEventResponders();
    pendingInbox.clear();
    pendingInboxNotifier.reset();
    restoreTattlerPendingInboxFromSession(pendingInbox, ctx.sessionManager.getEntries());
    activeContext = ctx;

    const sessionUuid = ctx.sessionManager.getSessionId();
    const existingTattlerId = ctx.sessionManager
      .getEntries()
      .toReversed()
      .find(
        (entry) =>
          entry.type === 'custom' && entry.customType === TATTLER_ID_ENTRY_KEY && typeof entry.data === 'string',
      );

    const flagTattlerId =
      (evt.reason === 'startup' || evt.reason === 'new') && !existingTattlerId
        ? (pi.getFlag('tattler-id') as string)
        : undefined;

    const tattlerIdOverride =
      existingTattlerId && existingTattlerId.type === 'custom'
        ? (existingTattlerId as CustomEntry<string>).data
        : flagTattlerId;

    for (const shortId of sessionShortIdGenerator(sessionUuid)) {
      const socketPath = normalize(join(tattlerRuntimeDir, `${shortId}.sock`));
      // A socket file that refuses connections is dead: unlink it and reuse the path. Anything
      // else, including a socket too busy to answer, may be a live session, so grow the number of
      // shortIdSections and try again. This is functionally equivalent to checking for UUID
      // collision.
      if (await stat(socketPath, { throwIfNoEntry: false })) {
        if ((await probeSocket(socketPath)) !== 'refused') {
          continue;
        }
        await unlink(socketPath);
      }

      try {
        server = await listenOn(socketPath);
        ownIdentity = buildMessage('tattler.identity.v0', {
          name: tattlerIdOverride ? tattlerIdOverride : `session:${shortId}`,
          shortId: shortId,
          socketPath,
        });
        if (existingTattlerId === undefined) {
          pi.appendEntry(TATTLER_ID_ENTRY_KEY, ownIdentity.name);
        }
        break;
      } catch (netErr) {
        console.warn(`error creating UDS IPC server at ${socketPath}: `, netErr);
      }
    }

    if (!server) {
      console.error("Couldn't create IPC server, Tattler will be unavailable for this agent session");
      return;
    }
    const endpoint: OwnEndpoint = { socketPath: ownIdentity.socketPath };
    removeEndpointOnExit(endpoint);
    // A SIGKILLed session leaves its socket and identity file; clear those without delaying startup.
    void sweepDeadEndpoints(tattlerRuntimeDir, { minAgeMs: DEAD_ENDPOINT_MIN_AGE_MS }).catch(() => {});

    // A live peer keeps its name: two sessions with one name would share one identity file. The
    // chosen name stays stored, so a later start takes it once it is free. On /reload the existing
    // file names our own socket and is replaced.
    let identityFile = identityFilePathFor(tattlerRuntimeDir, ownIdentity.name);
    if (identityFile === undefined || (await isIdentityFileHeldByLivePeer(identityFile, ownIdentity.socketPath))) {
      const defaultName = `session:${ownIdentity.shortId}`;
      console.warn(`Tattler name "${ownIdentity.name}" is in use or unusable; this session uses ${defaultName}`);
      ownIdentity = buildMessage('tattler.identity.v0', {
        name: defaultName,
        shortId: ownIdentity.shortId,
        socketPath: ownIdentity.socketPath,
      });
      identityFile = identityFilePathFor(tattlerRuntimeDir, defaultName) as string;
    }
    await writeIdentityFile(identityFile, ownIdentity);
    endpoint.identityFile = identityFile;
    ownEndpoint = endpoint;
    watchEndpoint(endpoint, (await stat(endpoint.socketPath)).ino);

    eventResponderUnsubscribers = [
      onListPeersRequest(pi, () => listPeerSockets(tattlerRuntimeDir, ownIdentity)),
      onOwnIdentityRequest(pi, () => ownIdentity),
      onTattlerPendingMessageQueueRequest(pi, (message) => {
        if (activeContext?.isIdle() !== false) {
          return { queued: false };
        }

        const wasEmpty = pendingInbox.counts().total === 0;
        const enqueueResult = pendingInbox.enqueue(message);
        if (enqueueResult.accepted) {
          persistPendingInboxSnapshot();
          if (wasEmpty) {
            notifyPendingInbox();
          }
        }

        return { queued: true, ...enqueueResult };
      }),
    ];
    registerListPeersTool(tattlerRuntimeDir, ownIdentity, pi);
    registerSendMessageTool(tattlerRuntimeDir, ownIdentity, pi);
  });

  pi.on('session_shutdown', async (_evt, _ctx) => {
    // No manual clearEventResponders() here: Pi 0.84.0's runtime.invalidate() (called on this
    // same session_shutdown/dispose boundary) already unsubscribes every pi.events.on()
    // registration for this runtime. The session_start-top clearEventResponders() call stays,
    // as a cheap, idempotent, defensive guard against any future same-bus double-start path.
    pendingInbox.clear();
    pendingInboxNotifier.reset();
    activeContext = undefined;
    stopEndpointWatch?.();
    stopRemovingEndpointOnExit?.();
    const endpoint = ownEndpoint;
    ownEndpoint = undefined;
    if (endpoint?.identityFile) removeIdentityFileIfOwn(endpoint.identityFile, endpoint.socketPath);
    if (server) {
      const closingServer = server;
      server = undefined;
      // node doesn't unlink the UDS file on close, and close() itself doesn't settle
      // synchronously — /reload reuses this exact socketPath (same session UUID), so
      // await the close and remove the file now instead of leaving the next
      // session_start's isSocketAlive probe to race against it. The close is
      // connection-destroying and timeboxed: a lingering peer connection would
      // otherwise hold close()'s callback hostage and hang the whole pi exit.
      await shutdownTattlerServer(closingServer);
      const socketPath = ownIdentity?.socketPath;
      if (socketPath && (await stat(socketPath, { throwIfNoEntry: false }))) {
        await unlink(socketPath);
      }
    }
  });
}
//#endregion
