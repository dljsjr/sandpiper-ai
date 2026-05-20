// Tattler v0 validation spike.
// Intentionally single-file and not a stable API.
// Do not extend this into the v1 architecture without first extracting core/runtime boundaries.

import { once } from 'node:events';
import { appendFile, mkdir, readdir, readFile, stat, unlink } from 'node:fs/promises';
import * as net from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StringEnum } from '@earendil-works/pi-ai';
import type { CustomEntry, ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { type SystemNotificationSender, SystemNotificationSourceType, sendSystemNotification } from 'sandpiper-ai-core';
import sanitize from 'sanitize-filename';
import { Type } from 'typebox';
import { v7 as uuidv7 } from 'uuid';

// we have to use `require` here because `tmp` is old, and relies on
// an explicit reference to `module.exports` in its code.
const tmp = require('tmp');

// ============================================================================
// Constants
// ============================================================================
//#region Constants
const VERBOSE = process.env.TATTLER_DEBUG === '1';

const TATTLER_ID_ENTRY_KEY = 'tattler-id';

// runtime directory constants
const __PI_CODING_AGENT_RESOLVE_DIR = dirname(fileURLToPath(import.meta.resolve('@earendil-works/pi-coding-agent')));
const CONFIG_DIR_NAME: string = (await import(join(__PI_CODING_AGENT_RESOLVE_DIR, 'config.js'))).CONFIG_DIR_NAME;
const XDG_RUNTIME_DIR_ENV_KEY = 'XDG_RUNTIME_DIR';

// extension-global variables for now, structured state storage later
let tattlerRuntimeDir: string;
let ownIdentity: TattlerIdentityV0;
let server: net.Server | undefined;

// socket/wire protocol constants
const MAX_MESSAGE_BYTES = 4096;
const SEND_ACK_TIMEOUT_MS = 5_000;
const MAX_PROTOCOL_REPLY_BYTES = 2048;
const MAX_PROTOCOL_REQUEST_BYTES = MAX_MESSAGE_BYTES + 2048;
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

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

//#endregion

// ============================================================================
// Message Formats
// ============================================================================
//#region Message Formats

const TattlerProtocolFormat: unique symbol = Symbol('TattlerProtocolFormat');
type TattlerFormatKey = 'tattler.identity.v0' | 'tattler.ack.v0' | 'tattler.error.v0' | 'tattler.agent-message.v0';

declare const tattlerMessageIdBrand: unique symbol;
type TattlerMessageId = string & {
  readonly [tattlerMessageIdBrand]: true;
};

interface TattlerMessageBase<K extends TattlerFormatKey> {
  readonly [TattlerProtocolFormat]: K;
  readonly id: TattlerMessageId;
}

// v0 invariant: every persisted identity property is an addressable route key.
// Revisit for TAT-7 once identity grows non-routing metadata.
interface TattlerIdentityV0 extends TattlerMessageBase<'tattler.identity.v0'> {
  name: string;
  socketPath: string;
  shortId: string;
}

interface TattlerCorrelationPayload {
  readonly correlatedMessageId?: TattlerMessageId;
}

interface TattlerAckV0Payload extends TattlerCorrelationPayload {
  readonly correlatedMessageId: TattlerMessageId;
}

interface TattlerAckV0 extends TattlerMessageBase<'tattler.ack.v0'> {
  readonly ack: TattlerAckV0Payload;
}
type TattlerErrorV0Payload = {
  readonly code: string;
  readonly message: string;
} & TattlerCorrelationPayload;

interface TattlerErrorV0 extends TattlerMessageBase<'tattler.error.v0'> {
  readonly error: TattlerErrorV0Payload;
}

interface TattlerAgentMessageV0 extends TattlerMessageBase<'tattler.agent-message.v0'> {
  readonly from: string;
  readonly message: string;
}

type TattlerProtocolFrame = TattlerAckV0 | TattlerErrorV0 | TattlerAgentMessageV0;

//#endregion

// ============================================================================
// Message Helpers
// ============================================================================
//#region Message Helper Utils
function newMessageId(): TattlerMessageId {
  return uuidv7() as TattlerMessageId;
}
//#endregion

type MessageProps<K extends TattlerFormatKey, T extends TattlerMessageBase<K>> = Omit<
  T,
  typeof TattlerProtocolFormat | 'id'
> &
  Partial<Pick<T, 'id'>>;

function buildMessage<K extends TattlerFormatKey, T extends TattlerMessageBase<K>>(
  formatKey: K,
  props: MessageProps<K, T>,
): T {
  const { id: maybeId, ...remainingProps } = { ...props };

  return {
    [TattlerProtocolFormat]: formatKey,
    id: maybeId || newMessageId(),
    ...remainingProps,
  } as T;
}

function stripProtocolFrame<K extends TattlerFormatKey, T extends TattlerMessageBase<K>>(
  message: T,
): MessageProps<K, T> {
  const { id, [TattlerProtocolFormat]: K, ...base } = { ...message };
  return base;
}

function serializeToJsonl<K extends TattlerFormatKey, T extends TattlerMessageBase<K>>(message: T): string {
  const outObj = { ...message, format: message[TattlerProtocolFormat] };
  return `${JSON.stringify(outObj)}\n`;
}

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

async function identityFromIdFile(identityFile: string): Promise<TattlerIdentityV0 | undefined> {
  const fileStat = await stat(identityFile, { throwIfNoEntry: false });
  if (!fileStat) {
    return;
  }

  try {
    const fromJson: unknown = JSON.parse(await readFile(identityFile, { encoding: 'utf8' }));

    if (
      fromJson &&
      typeof fromJson === 'object' &&
      Object.hasOwn(fromJson, 'name') &&
      Object.hasOwn(fromJson, 'socketPath') &&
      Object.hasOwn(fromJson, 'shortId')
    ) {
      const jsonMessageProps = fromJson as MessageProps<'tattler.identity.v0', TattlerIdentityV0>;
      const sockStat = await stat(jsonMessageProps.socketPath, { throwIfNoEntry: false });
      if (sockStat?.isSocket() && (await isSocketAlive(jsonMessageProps.socketPath))) {
        return buildMessage('tattler.identity.v0', jsonMessageProps);
      }
    }
  } catch (err) {
    console.warn(`error processing identity file ${identityFile} (skipping file): `, err);
  }
}

async function identityFromSocket(socketPath: string): Promise<TattlerIdentityV0 | undefined> {
  if (!(await isSocketAlive(socketPath))) return;

  const shortId = basename(socketPath, extname(socketPath));
  return buildMessage('tattler.identity.v0', {
    socketPath,
    shortId,
    name: `session:${shortId}`,
  });
}

async function listPeerSockets(): Promise<TattlerIdentityV0[]> {
  if (!(await checkRuntimeDir())) {
    return [];
  }

  const livePeers: TattlerIdentityV0[] = [];

  const socketFiles = new Set<string>();
  const identityFiles = new Set<string>();
  for (const entry of await readdir(tattlerRuntimeDir, { withFileTypes: true })) {
    const normalizedEntryPath = normalize(join(tattlerRuntimeDir, entry.name));
    if (entry.isSocket()) {
      if (normalizedEntryPath !== ownIdentity.socketPath) {
        socketFiles.add(normalizedEntryPath);
      }
    } else if (extname(entry.name) === '.id') {
      identityFiles.add(normalizedEntryPath);
    }
  }

  for (const idFile of identityFiles) {
    const id = await identityFromIdFile(idFile);
    if (id) {
      socketFiles.delete(id.socketPath);
      livePeers.push(id);
    }
  }

  for (const socketPath of socketFiles) {
    const id = await identityFromSocket(socketPath);
    if (id) {
      livePeers.push(id);
    }
  }

  return livePeers;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractMessageId(frame: unknown): TattlerMessageId | undefined {
  if (!isRecord(frame) || typeof frame.id !== 'string' || frame.id.trim().length === 0) {
    return undefined;
  }

  return frame.id as TattlerMessageId;
}

function requiredStringField(frame: Record<string, unknown>, fieldName: string): string {
  const value = frame[fieldName];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Incoming agent message missing required string field [${fieldName}]`);
  }

  return value;
}

function parseProtocolJsonLine(jsonLine: string): unknown {
  try {
    return JSON.parse(jsonLine) as unknown;
  } catch (err) {
    throw new Error(`Malformed protocol JSON: ${errorMessage(err)}`);
  }
}

function parseIncomingAgentMessage(frame: unknown): TattlerAgentMessageV0 {
  if (!isRecord(frame)) {
    throw new Error('Incoming protocol frame must be a JSON object');
  }

  if (frame.format !== 'tattler.agent-message.v0') {
    throw new Error(`Unsupported incoming protocol frame format [${String(frame.format)}]`);
  }

  const message = requiredStringField(frame, 'message');
  const messageLength = Buffer.byteLength(message, 'utf8');
  if (messageLength > MAX_MESSAGE_BYTES) {
    throw new Error(`Incoming agent message length ${messageLength} > ${MAX_MESSAGE_BYTES}`);
  }

  return buildMessage('tattler.agent-message.v0', {
    id: requiredStringField(frame, 'id') as TattlerMessageId,
    from: requiredStringField(frame, 'from'),
    message,
  });
}

function createAck(correlatedMessageId: TattlerMessageId): TattlerAckV0 {
  return buildMessage('tattler.ack.v0', {
    ack: { correlatedMessageId },
  });
}

function createProtocolError(message: string, correlatedMessageId?: TattlerMessageId): TattlerErrorV0 {
  return buildMessage('tattler.error.v0', {
    error: {
      code: 'protocol-error',
      message,
      ...(correlatedMessageId === undefined ? {} : { correlatedMessageId }),
    },
  });
}

function writeProtocolFrame(socket: net.Socket, frame: TattlerProtocolFrame): void {
  if (socket.destroyed || !socket.writable) {
    return;
  }

  socket.write(serializeToJsonl(frame));
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
  let protocolReply: TattlerMessageBase<TattlerFormatKey>;
  try {
    const protocolReplyRaw: unknown & {
      format?: TattlerFormatKey;
    } = JSON.parse(jsonLine);
    if (protocolReplyRaw.format === undefined) {
      throw new Error('missing format key');
    }
    const { format, ...props } = { ...protocolReplyRaw };
    protocolReply = buildMessage(format as TattlerFormatKey, props);
  } catch (err) {
    throw new Error(`Problem while parsing protocol reply for message ${pendingId}: ${err}`);
  }

  switch (protocolReply[TattlerProtocolFormat]) {
    case 'tattler.ack.v0':
      return ackToSendResult(pendingId, protocolReply as TattlerAckV0);

    case 'tattler.error.v0':
      throw protocolErrorToError(pendingId, protocolReply as TattlerErrorV0);

    default:
      throw new Error(
        `Unexpected message format [${protocolReply[TattlerProtocolFormat]}] while waiting for protocol reply for message ${pendingId}`,
      );
  }
}

async function readProtocolReplyLine(
  socket: net.Socket,
  peer: TattlerIdentityV0,
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
  peer: TattlerIdentityV0,
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
    peerConnection.write(serializeToJsonl(message));

    const replyLine = await replyLinePromise;
    return parseSendReplyLine(message.id, replyLine);
  } finally {
    peerConnection.destroy();
  }
}

async function readIncomingFrameLine(socket: net.Socket): Promise<string | undefined> {
  let buffer = '';

  for await (const chunk of socket.iterator({ destroyOnReturn: false })) {
    buffer += chunk;

    if (Buffer.byteLength(buffer, 'utf8') > MAX_PROTOCOL_REQUEST_BYTES) {
      throw new Error(`Incoming protocol frame exceeded ${MAX_PROTOCOL_REQUEST_BYTES} bytes`);
    }

    const newlineIdx = buffer.indexOf('\n');
    if (newlineIdx !== -1) {
      const line = buffer.slice(0, newlineIdx).trim();
      if (line.length === 0) {
        throw new Error('Incoming protocol frame was empty');
      }
      return line;
    }
  }

  if (buffer.trim().length === 0) {
    return undefined;
  }

  throw new Error('Peer ended with a partial incoming protocol frame');
}

async function serverHandler(socket: net.Socket, sender?: SystemNotificationSender): Promise<void> {
  socket.setEncoding('utf8');
  socket.on('error', (err) => {
    if (VERBOSE) {
      console.warn('Tattler socket error while receiving message: ', err);
    }
  });

  try {
    const line = await readIncomingFrameLine(socket);
    if (line === undefined) {
      return;
    }

    const frame = parseProtocolJsonLine(line);
    const correlatedMessageId = extractMessageId(frame);

    try {
      const message = parseIncomingAgentMessage(frame);
      writeProtocolFrame(socket, createAck(message.id));
      if (sender) {
        const instructions = `This is a remote message from another coding agent. You are the primary audience for the message. The identity of the agent who sent the message is encoded in the 'from' field.
- You are not obligated to respond to a message. The tattler protocol provides basic ACK/ERR semantics. Only respond if the originating message warrants substantive discussion.
- If the message warrants a response to the originating agent, you can use the 'list_peers' and 'send_peer_message' tools to send a message in response.
- The user cannot see any of this message content by default. If this message contains information the user should see, summarize or quote the relevant parts explicitly.
- If you are working autonomously as part of an agent team on a shared workload, and this is a message related to that coordination, you do not
need to surface anything to the user.
- Otherwise, if it makes sense to surface the contents of the message to the user, you can do so. Provide a human-facing summary or framing; don't surface the raw XML.
- If you are working on something, and the contents of the message contains information that indicates you may want to replan or restructure your
current work, you should do so.
- If you are working interactively/non-autonomously and the message requires you to pivot in a non-trivial way, discuss with the user.
`;
        const systemNotification = {
          sourceType: SystemNotificationSourceType.PeerMessage,
          sourceId: 'tattler',
          instructions,
          triggerTurn: true,
          data: {
            from: message.from,
            message: message.message,
            messageId: message.id,
          },
        };
        sendSystemNotification(sender, systemNotification);
      }
    } catch (protocolErr) {
      writeProtocolFrame(socket, createProtocolError(errorMessage(protocolErr), correlatedMessageId));
    }
  } catch (receiveErr) {
    writeProtocolFrame(socket, createProtocolError(errorMessage(receiveErr)));
  } finally {
    if (!socket.destroyed) {
      socket.end();
    }
  }
}

function createServerWithNotificationSender(sender: SystemNotificationSender): net.Server {
  const handler = async (socket: net.Socket) => {
    return serverHandler(socket, sender);
  };
  return net.createServer(handler);
}
//#endregion

//#region Pi API Integration
// ============================================================================
// Begin Pi API Integration
// ============================================================================
function registerListPeersTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'list_peers',
    label: 'List Peers',
    promptSnippet:
      'Lists routing information for other Tattler participants with active endpoints for Tattler messages',
    promptGuidelines: [
      "Use `list_peers` when you need to send a message to another Tattler participant, but you don't know their name/identity/socket information.",
      'If you are sending a reply to another message, try sending directly with the `name` address type first to save time. `list_peers` is your fallback.',
    ],
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

function registerSendMessageTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'send_peer_message',
    label: 'Send Peer Message',
    description: 'Send a message to a live/active peer',
    promptSnippet:
      'Send a message to another Tattler participant. Use `addressType` to control how the `id` property should be interpreted',
    promptGuidelines: [
      'Use `send_peer_message` directly without consulting `list_peers` if you know any of the shortId, name, or UDS socket path for your recipient',
    ],
    parameters: Type.Object({
      addressType: Type.Optional(TattlerAddressType),
      id: Type.String({ description: 'Target Peer ID (generalized by address type)' }),
      message: Type.String({
        description: `The message to send to the peer, limited in size to ${MAX_MESSAGE_BYTES} bytes`,
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const addressType = (params.addressType || 'name') as keyof TattlerIdentityV0;
      // TODO: don't probe for live sockets every single time we send a message; this could add significant latency.
      // fine for initial dogfooding though.
      const peer = (await listPeerSockets()).find(
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

  pi.registerFlag('tattler-id', {
    description: `Use the given string for this session's Tattler ID instead of \`session:<shortUuid>\`.
The ID is persisted in the non-transcript session store via \`appendEntry\`. This flag is ignored if \`--resume\`
is used to resume an existing session.
      `,
    type: 'string',
  });

  pi.on('session_start', async (evt, ctx) => {
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
          if (VERBOSE) {
            console.warn(`${socketPath} already has a listening server, trying next shortUuid expansion`);
          }
          continue;
        }
        await unlink(socketPath);
      }

      try {
        const serverDef = createServerWithNotificationSender(pi);
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
    const idTmpFile = tmp.fileSync({
      name: `${fileSanitizedIdentity}.id`,
      tmpdir: dirname(tattlerRuntimeDir),
      dir: basename(tattlerRuntimeDir),
      mode: 0o644,
      discardDescriptor: true,
    });

    await appendFile(idTmpFile.name, serializeToJsonl(ownIdentity));

    registerListPeersTool(pi);
    registerSendMessageTool(pi);
  });

  pi.on('session_shutdown', (_evt, _ctx) => {
    if (server) {
      server.close();
    }
  });
}
//#endregion
