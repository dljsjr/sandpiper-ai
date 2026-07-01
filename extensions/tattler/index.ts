// Tattler v0 validation spike.
// Intentionally single-file and not a stable API.
// Do not extend this into the v1 architecture without first extracting core/runtime boundaries.

import { appendFile, stat, unlink } from 'node:fs/promises';
import type * as net from 'node:net';
import { basename, dirname, join, normalize } from 'node:path';
import { StringEnum } from '@earendil-works/pi-ai';
import type { CustomEntry, ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { sessionShortIdGenerator } from 'sandpiper-ai-core';
import sanitize from 'sanitize-filename';
import { Type } from 'typebox';
import { listPeerSockets } from './tattler-identity';
import { createTattlerPendingInbox, TATTLER_PENDING_INBOX_ENTRY_KEY } from './tattler-inbox';
import { registerTattlerPendingInboxHooks } from './tattler-inbox-hooks';
import { createTattlerPendingInboxSnapshot, restoreTattlerPendingInboxFromSession } from './tattler-inbox-persistence';
import { registerTattlerPendingBatchRenderer } from './tattler-inbox-renderer';
import { createServerWithNotificationSender, isSocketAlive, sendAgentMessage } from './tattler-ipc';
import { createTattlerPendingInboxNotifier } from './tattler-pending-cue';
import { onListPeersRequest, onOwnIdentityRequest, onTattlerPendingMessageQueueRequest } from './tattler-pi-events';
import {
  buildMessage,
  MAX_MESSAGE_BYTES,
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

// we have to use `require` here because `tmp` is old, and relies on
// an explicit reference to `module.exports` in its code.
const tmp = require('tmp');

// extension-global variable for now
let server: net.Server | undefined;
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
    promptSnippet:
      'Lists routing information for other Tattler participants with active endpoints for Tattler messages',
    promptGuidelines: [TATTLER_ROUTING_PROMPT_GUIDELINE],
    description: 'List other agent peers with live sockets, which means they are candidates for receiving messages',
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
      const peerSockets = await listPeerSockets(tattlerRuntimeDir, ownIdentity);
      if (peerSockets.length === 0) {
        return {
          content: [{ type: 'text', text: 'No active peers available' }],
          details: { peers: [] },
        };
      }

      const lines = peerSockets.map((peer) => {
        return `- ${peer.name}         [shortId: ${peer.shortId}]`;
      });

      const resultText = `Peers:\n${lines.join('\n')}`;

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
      const addressType = (params.addressType || 'name') as keyof TattlerIdentityV0;
      // TODO: don't probe for live sockets every single time we send a message; this could add significant latency.
      // fine for initial dogfooding though.
      const peer = (await listPeerSockets(tattlerRuntimeDir, ownIdentity)).find(
        (peer) => Object.hasOwn(peer, addressType) && peer[addressType] === params.id,
      );

      if (!peer) {
        const errMessage = `No live peer with id ${params.id} to receive message`;
        return { content: [{ type: 'text', text: errMessage }], isError: true, details: { error: errMessage } };
      }

      const messageLength = Buffer.byteLength(params.message, 'utf8');
      if (messageLength > MAX_MESSAGE_BYTES) {
        const errMessage = `Message ${params.id} length ${messageLength} > ${MAX_MESSAGE_BYTES}         (maximum allowed message size)`;
        return { content: [{ type: 'text', text: errMessage }], isError: true, details: { error: errMessage } };
      }

      // TODO(TAT-7) shortId is a local session locator, not a stable agent identity. Useful for v0, replace it
      // with stable agent identity once the agent directory is implemented
      const message: TattlerAgentMessageV0 = buildMessage('tattler.agent-message.v0', {
        message: params.message,
        from: ownIdentity.name,
      });

      try {
        const sendResult: SendAgentMessageResult = await sendAgentMessage(peer, message);
        return {
          content: [{ type: 'text', text: `message ${sendResult.messageIdAck} acknowledged by ${peer.name}` }],
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
  const pendingInboxNotifier = createTattlerPendingInboxNotifier(pi, () => pendingInbox.counts().total);
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
      // If the socket file exists, but is dead, we unlink it so we can recreate it.
      // If, however, it exists and is *not* dead, we grow the number of shortIdSections
      // and try again. This is functionally equivalent to checking for UUID
      // collision.
      if (await stat(socketPath, { throwIfNoEntry: false })) {
        if (await isSocketAlive(socketPath)) {
          continue;
        }
        await unlink(socketPath);
      }

      try {
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
        server = serverDef;
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

    tmp.setGracefulCleanup();
    const fileSanitizedIdentity = sanitize(ownIdentity.name);
    const idFileName = `${fileSanitizedIdentity}.id`;
    // /reload keeps the same session UUID (and, with a fixed `--tattler-id`, /new keeps the same
    // override name too), so this identity file can already exist from the session we're replacing.
    // tmp.fileSync creates with O_EXCL and throws EEXIST on a pre-existing file, so clear it first.
    const idFilePath = normalize(join(tattlerRuntimeDir, idFileName));
    if (await stat(idFilePath, { throwIfNoEntry: false })) {
      await unlink(idFilePath);
    }
    const idTmpFile = tmp.fileSync({
      name: idFileName,
      tmpdir: dirname(tattlerRuntimeDir),
      dir: basename(tattlerRuntimeDir),
      mode: 0o644,
      discardDescriptor: true,
    });

    await appendFile(idTmpFile.name, serializeToJsonl(ownIdentity));

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
    clearEventResponders();
    pendingInbox.clear();
    pendingInboxNotifier.reset();
    activeContext = undefined;
    if (server) {
      const closingServer = server;
      server = undefined;
      // node doesn't unlink the UDS file on close, and close() itself doesn't settle
      // synchronously — /reload reuses this exact socketPath (same session UUID), so
      // await the close and remove the file now instead of leaving the next
      // session_start's isSocketAlive probe to race against it.
      await new Promise<void>((resolve) => closingServer.close(() => resolve()));
      const socketPath = ownIdentity?.socketPath;
      if (socketPath && (await stat(socketPath, { throwIfNoEntry: false }))) {
        await unlink(socketPath);
      }
    }
  });
}
//#endregion
