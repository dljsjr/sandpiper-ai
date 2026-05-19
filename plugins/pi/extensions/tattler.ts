// Tattler v0 validation spike.
// Intentionally single-file and not a stable API.
// Do not extend this into the v1 architecture without first extracting core/runtime boundaries.

import { once } from 'node:events';
import { mkdir, readdir, stat, unlink } from 'node:fs/promises';
import * as net from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from '@sinclair/typebox';
import { v7 as uuidv7 } from 'uuid';

// ============================================================================
// Constants
// ============================================================================
//#region Constants
const VERBOSE = process.env.TATTLER_DEBUG === '1';

// runtime directory constants
const __PI_CODING_AGENT_RESOLVE_DIR = dirname(fileURLToPath(import.meta.resolve('@earendil-works/pi-coding-agent')));
const CONFIG_DIR_NAME: string = (await import(join(__PI_CODING_AGENT_RESOLVE_DIR, 'config.js'))).CONFIG_DIR_NAME;
const XDG_RUNTIME_DIR_ENV_KEY = 'XDG_RUNTIME_DIR';

// extension-global variables for now, structured state storage later
let tattlerRuntimeDir: string;
let ownSocketPath: string;
let ownShortId: string;
let server: net.Server | undefined;

// socket/wire protocol constants
const MAX_MESSAGE_BYTES = 4096;
const SEND_ACK_TIMEOUT_MS = 5_000;
const MAX_PROTOCOL_REPLY_BYTES = 2048;
//#endregion

// ============================================================================
// General Utilities/Helpers
// ============================================================================
//#region General Utilities/Helpers
async function firstDefined<T>(candidates: Array<() => Promise<T>>): Promise<T> {
  for (const candidate of candidates) {
    try {
      return await candidate();
    } catch (candidateError) {
      if (VERBOSE) {
        console.warn('Encountered error while attempting to find suitable runtime dir: ', candidateError);
      }
    }
  }
  throw new Error("Couldn't locate a usable runtime directory base!");
}

function* sessionShortIdGenerator(sessionUuid: string): Generator<string> {
  const shortIdSections = [];
  for (const match of sessionUuid.matchAll(/([^-]+)-?/g)) {
    shortIdSections.push(match[1]);
    yield shortIdSections.join('-');
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

//#endregion

// ============================================================================
// Message Formats
// ============================================================================
//#region Message Formats
type TattlerFormatKey = 'tattler.ack.v0' | 'tattler.error.v0' | 'tattler.agent-message.v0';

declare const tattlerMessageIdBrand: unique symbol;
type TattlerMessageId = string & {
  readonly [tattlerMessageIdBrand]: true;
};

interface TattlerPeerSocket {
  name: string;
  socketPath: string;
  shortId: string;
}

interface TattlerMessageBase {
  readonly format: TattlerFormatKey;
  readonly id: TattlerMessageId;
}

interface TattlerCorrelationPayload {
  readonly correlatedMessageId?: TattlerMessageId;
}

interface TattlerAckV0Payload extends TattlerCorrelationPayload {
  readonly correlatedMessageId: TattlerMessageId;
}

interface TattlerAckV0 extends TattlerMessageBase {
  readonly format: 'tattler.ack.v0';
  readonly ack: TattlerAckV0Payload;
}
type TattlerErrorV0Payload = {
  readonly code: string;
  readonly message: string;
} & TattlerCorrelationPayload;

interface TattlerErrorV0 extends TattlerMessageBase {
  readonly format: 'tattler.error.v0';
  readonly error: TattlerErrorV0Payload;
}

interface TattlerAgentMessageV0 extends TattlerMessageBase {
  readonly format: 'tattler.agent-message.v0';
  readonly from: string;
  readonly message: string;
}

//#endregion

// ============================================================================
// Message Helpers
// ============================================================================
//#region Message Helper Utils
function newMessageId(): TattlerMessageId {
  return uuidv7() as TattlerMessageId;
}
//#endregion

// ============================================================================
// Runtime Directory Helpers
// ============================================================================
//#region Runtime Directory Helpers
function harnessConfigName(): string {
  return CONFIG_DIR_NAME.replace(/^\./, '');
}

async function checkRuntimeDir(): Promise<boolean> {
  return (tattlerRuntimeDir && (await stat(tattlerRuntimeDir, { throwIfNoEntry: false }))?.isDirectory()) || false;
}

async function getTmpChecked(): Promise<string> {
  if (Object.hasOwn(process.env, 'TMPDIR') && process.env.TMPDIR) {
    try {
      await mkdir(process.env.TMPDIR, { recursive: true });
      return process.env.TMPDIR;
    } catch (mkdirErr) {
      throw new Error(`${process.env.TMPDIR} unavailable: `, { cause: mkdirErr });
    }
  }

  // if we're using /tmp and there's an access or other filesystem issue,
  // we're totally screwed, so we throw.
  try {
    await mkdir('/tmp', { recursive: true });
    return '/tmp';
  } catch (mkdirErr) {
    throw new Error('Unable to access "/tmp": ', { cause: mkdirErr });
  }
}

async function getXdgBasedir(): Promise<string> {
  const xdgRuntimeDir = process.env[XDG_RUNTIME_DIR_ENV_KEY];
  if (!xdgRuntimeDir) {
    throw new Error(`${XDG_RUNTIME_DIR_ENV_KEY} not set in environment`);
  }

  try {
    await mkdir(xdgRuntimeDir, { recursive: true });
    return xdgRuntimeDir;
  } catch (mkdirErr) {
    throw new Error(`${xdgRuntimeDir} unavailable: `, { cause: mkdirErr });
  }
}

async function darwinRuntimeBasedir(): Promise<string> {
  const osTmpdir = tmpdir();
  try {
    await mkdir(osTmpdir, { recursive: true });
    return osTmpdir;
  } catch (mkdirErr) {
    throw new Error(`${osTmpdir} unavailable: `, { cause: mkdirErr });
  }
}

async function linuxRuntimeBasedir(): Promise<string> {
  const uid = process.getuid?.();
  if (uid === undefined) {
    throw new Error('Unable to determine UID');
  }

  const runDir = `/run/user/${uid}`;
  try {
    const dirStats = await stat(runDir);
    if (!dirStats.isDirectory()) {
      const error = new Error(`${runDir} is not a directory`) as NodeJS.ErrnoException;
      error.code = 'ENOTDIR';
      throw error;
    }
    return runDir;
  } catch (runDirExistsErr) {
    throw new Error(`${runDir} unavailable: `, { cause: runDirExistsErr });
  }
}

// `XDG_RUNTIME_DIR` is the only XDG basedir spec member that doesn't have a default fallback.
// It does provide guidance on how to fall back, though.
// To be a "good citizen" various OS's, we have decided on the following policy for selecting
// a runtime dir, based on documentation from the various OS's:
//
// - If `XDG_RUNTIME_DIR` is set, we use `${XDG_RUNTIME_DIR}/<harness_name>`; even on macOS.
// - If it is *not* set, we branch based on OS:
//   - on macOS, we use the `tmpdir` as the root before the harness name dir, which maps to `/var/folders/.../.../T`.
//     It's stable based on the logged in user, and is meant to be used for runtime stuff like sockets.
//   - on Linux, we attempt to use `/run/user/<uid>/<harness_name>`, as this is a common convention.
//   - In the event that either of the above fail, we fall back to `${TMPDIR:-/tmp}/<harness_name>`
async function runtimeDir(): Promise<string> {
  const base = await firstDefined([
    getXdgBasedir,
    process.platform === 'darwin' ? darwinRuntimeBasedir : linuxRuntimeBasedir,
    getTmpChecked,
  ]);

  const runtimeDir = join(base, harnessConfigName());
  await mkdir(runtimeDir, { recursive: true, mode: 0o700 });
  return runtimeDir;
}
//#endregion

// ============================================================================
// Socket/Protocol Implementation
// ============================================================================
//#region Socket/Protocol Implementation

interface SendAgentMessageResult {
  readonly messageIdAck: TattlerMessageId;
}

// Adapted from https://github.com/mitsuhiko/agent-stuff, Apache 2.0
async function isSocketAlive(socketPath: string): Promise<boolean> {
  return await new Promise((resolve) => {
    const socket = net.createConnection(socketPath);
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 300);

    const cleanup = (alive: boolean) => {
      clearTimeout(timeout);
      socket.removeAllListeners();
      resolve(alive);
    };

    socket.once('connect', () => {
      socket.end();
      cleanup(true);
    });
    socket.once('error', () => {
      cleanup(false);
    });
  });
}

async function listPeerSockets(): Promise<TattlerPeerSocket[]> {
  if (!(await checkRuntimeDir())) {
    return [];
  }

  const livePeers: TattlerPeerSocket[] = [];
  for (const entry of await readdir(tattlerRuntimeDir, { withFileTypes: true })) {
    if (!entry.isSocket()) continue;
    const socketPath = join(tattlerRuntimeDir, entry.name);
    if (socketPath === ownSocketPath) continue;
    if (!(await isSocketAlive(socketPath))) continue;

    const shortId = basename(entry.name, extname(entry.name));
    livePeers.push({
      socketPath,
      shortId,
      name: `session:${shortId}`,
    });
  }

  return livePeers;
}
function ackToSendResult(pendingId: TattlerMessageId, ack: TattlerAckV0): SendAgentMessageResult {
  if (pendingId !== ack.ack.correlatedMessageId) {
    throw new Error(`Received unexpected ACK for message ID ${ack.ack.correlatedMessageId}, expected ID ${pendingId}`);
  }

  return { messageIdAck: ack.ack.correlatedMessageId };
}

function protocolErrorToError(pendingId: TattlerMessageId, err: TattlerErrorV0): Error {
  if (err.error.correlatedMessageId === undefined) {
    return new Error(`Received protocol error:\n${JSON.stringify(err.error, null, 2)}`);
  }

  if (pendingId !== err.error.correlatedMessageId) {
    return new Error(
      `Received unexpected error correlated to ID ${err.error.correlatedMessageId}, expected ${pendingId}:\n${JSON.stringify(err.error, null, 2)}`,
    );
  }

  return new Error(`Peer rejected message ID ${pendingId}:\n${JSON.stringify(err.error, null, 2)}`);
}

function parseSendReplyLine(pendingId: TattlerMessageId, jsonLine: string): SendAgentMessageResult {
  let protocolReply: TattlerMessageBase;
  try {
    protocolReply = JSON.parse(jsonLine) as TattlerMessageBase;
  } catch (err) {
    throw new Error(`Problem while parsing protocol reply for message ${pendingId}: ${err}`);
  }

  switch (protocolReply.format) {
    case 'tattler.ack.v0':
      return ackToSendResult(pendingId, protocolReply as TattlerAckV0);

    case 'tattler.error.v0':
      throw protocolErrorToError(pendingId, protocolReply as TattlerErrorV0);

    default:
      throw new Error(
        `Unexpected message format [${protocolReply.format}] while waiting for protocol reply for message ${pendingId}`,
      );
  }
}

async function readProtocolReplyLine(
  socket: net.Socket,
  peer: TattlerPeerSocket,
  messageId: TattlerMessageId,
): Promise<string> {
  let buffer = '';

  for await (const chunk of socket) {
    buffer += chunk;

    if (Buffer.byteLength(buffer, 'utf8') > MAX_PROTOCOL_REPLY_BYTES) {
      throw new Error(`Protocol reply from ${peer.name} exceeded ${MAX_PROTOCOL_REPLY_BYTES} bytes`);
    }

    const newlineIdx = buffer.indexOf('\n');
    if (newlineIdx !== -1) {
      return buffer.slice(0, newlineIdx).trim();
    }
  }

  if (buffer.trim().length > 0) {
    throw new Error(`Peer ${peer.name} ended with a partial protocol reply for message ${messageId}`);
  }

  throw new Error(`Peer ${peer.name} ended before acknowledging message ${messageId}`);
}

async function sendAgentMessage(
  peer: TattlerPeerSocket,
  message: TattlerAgentMessageV0,
): Promise<SendAgentMessageResult> {
  const peerConnection = new net.Socket();
  peerConnection.setEncoding('utf8');
  try {
    const connectPromise = once(peerConnection, 'connect');
    peerConnection.connect(peer.socketPath);

    await withTimeout(connectPromise, SEND_ACK_TIMEOUT_MS, `Timed out connecting to ${peer.name}`);

    const replyLinePromise = withTimeout(
      readProtocolReplyLine(peerConnection, peer, message.id),
      SEND_ACK_TIMEOUT_MS,
      `Timed out waiting for ACK from ${peer.name} for message ${message.id}`,
    );

    if (VERBOSE) {
      console.log(`sending message ${message.id} to ${peer.shortId}`);
    }
    peerConnection.write(`${JSON.stringify(message)}\n`);

    const replyLine = await replyLinePromise;
    return parseSendReplyLine(message.id, replyLine);
  } finally {
    peerConnection.destroy();
  }
}

function serverHandler(_socket: net.Socket): void {}
//#endregion

//#region Pi API Integration
// ============================================================================
// Begin Pi API Integration
// ============================================================================

function registerListPeersTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'list_peers',
    label: 'List Peers',
    description: 'List other agent peers with live sockets, which means they are candidates for receiving messages',
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
      const peerSockets = await listPeerSockets();
      if (peerSockets.length === 0) {
        return {
          content: [{ type: 'text', text: 'No active peers available' }],
          details: { peers: [] },
        };
      }

      const lines = peerSockets.map((peer) => {
        return `- ${peer.name}         [id: ${peer.shortId}]`;
      });

      const resultText = `Peers:\n${lines.join('\n')}`;

      return {
        content: [{ type: 'text', text: resultText }],
        details: { peerSockets },
      };
    },
  });
}

function registerSendMessageTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'send_peer_message',
    label: 'Send Peer Message',
    description: 'Send a message to a live/active peer, addressed by their ID',
    parameters: Type.Object({
      id: Type.String({ description: 'Target Peer ID' }),
      message: Type.String({
        description: `The message to send to the peer, limited in size to ${MAX_MESSAGE_BYTES} bytes`,
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      // TODO: don't probe for live sockets every single time we send a message; this could add significant latency.
      // fine for initial dogfooding though.
      const peer = (await listPeerSockets()).find((peer) => peer.shortId === params.id);

      if (!peer) {
        const errMessage = `No live peer with id ${params.id} to receive message`;
        return { content: [{ type: 'text', text: errMessage }], isError: true, details: { error: errMessage } };
      }

      const messageLength = Buffer.byteLength(params.message, 'utf8');
      if (messageLength > MAX_MESSAGE_BYTES) {
        const errMessage = `Message ${params.id} length ${messageLength} > ${MAX_MESSAGE_BYTES}         (maximum allowed message size)`;
        return { content: [{ type: 'text', text: errMessage }], isError: true, details: { error: errMessage } };
      }

      const message: TattlerAgentMessageV0 = {
        format: 'tattler.agent-message.v0',
        id: newMessageId(),
        message: params.message,
        from: ownShortId,
      };

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
  try {
    tattlerRuntimeDir = await runtimeDir();
    if (VERBOSE) {
      console.log(`config dir name: ${CONFIG_DIR_NAME}`);
      console.log(`harness config name: ${harnessConfigName()}`);
      console.log(`runtime dir: ${tattlerRuntimeDir}`);
    }
  } catch (runtimeDirError) {
    console.error(
      `couldn't obtain usable runtime directory, Tattler will be unavailable for this agent session: `,
      runtimeDirError,
    );
    return;
  }

  pi.on('session_start', async (_evt, ctx) => {
    const sessionUuid = ctx.sessionManager.getSessionId();
    for (const shortUuid of sessionShortIdGenerator(sessionUuid)) {
      const socketPath = join(tattlerRuntimeDir, `${shortUuid}.sock`);
      // If the socket file exists, but is dead, we unlink it so we can recreate it.
      // If, however, it exists and is *not* dead, we grow the number of shortIdSections
      // and try again. This is functionally equivalent to checking for UUID
      // collision.
      if (await stat(socketPath, { throwIfNoEntry: false })) {
        if (await isSocketAlive(socketPath)) {
          if (VERBOSE) {
            console.warn(`${socketPath} already has a listening server, trying next shortUuid expansion`);
          }
          continue;
        }
        await unlink(socketPath);
      }

      try {
        const serverDef = net.createServer(serverHandler);
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
        ownShortId = shortUuid;
        ownSocketPath = socketPath;
        break;
      } catch (netErr) {
        console.warn(`error creating UDS IPC server at ${socketPath}: `, netErr);
      }
    }

    if (!server) {
      console.error("Couldn't create IPC server, Tattler will be unavailable for this agent session");
      return;
    }

    registerListPeersTool(pi);
    registerSendMessageTool(pi);
  });
}
//#endregion
