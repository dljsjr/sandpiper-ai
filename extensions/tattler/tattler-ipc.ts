import { once } from 'node:events';
import * as net from 'node:net';
import { errorMessage, withTimeout } from '../../packages/core/src/utils.js';
import {
  createTattlerPendingAgentMessage,
  createTattlerPendingBatchMessageFromMessages,
  type TattlerPendingBatchCustomMessage,
  type TattlerPendingInbox,
} from './tattler-inbox';
import { emitChorusRoomDelivery, emitChorusRoomPostReceived, type HasPiEventBus } from './tattler-pi-events';
import {
  type ChorusRoomDeliveryV0,
  type ChorusRoomPostV0,
  createAck,
  createProtocolError,
  extractMessageId,
  MAX_PROTOCOL_REPLY_BYTES,
  MAX_PROTOCOL_REQUEST_BYTES,
  parseIncomingPayloadFrame,
  parseProtocolJsonLine,
  parseSendReplyLine,
  protocolFormat,
  SEND_ACK_TIMEOUT_MS,
  type SendAgentMessageResult,
  serializeToJsonl,
  type TattlerAgentMessageV0,
  type TattlerIdentityV0,
  type TattlerIncomingPayloadFrame,
  type TattlerMessageId,
  type TattlerProtocolFrame,
  type TattlerSendableFrame,
} from './tattler-protocol';

// Adapted from https://github.com/mitsuhiko/agent-stuff, Apache 2.0
/** `refused` means no process listens on the socket file; a timeout or other error is `unknown`. */
export type SocketProbeResult = 'alive' | 'refused' | 'unknown';

export async function probeSocket(socketPath: string): Promise<SocketProbeResult> {
  return await new Promise((resolve) => {
    const socket = net.createConnection(socketPath);
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve('unknown');
    }, 300);

    const cleanup = (result: SocketProbeResult) => {
      clearTimeout(timeout);
      socket.removeAllListeners();
      resolve(result);
    };

    socket.once('connect', () => {
      socket.end();
      cleanup('alive');
    });
    socket.once('error', (error: NodeJS.ErrnoException) => {
      cleanup(error.code === 'ECONNREFUSED' ? 'refused' : 'unknown');
    });
  });
}

export async function isSocketAlive(socketPath: string): Promise<boolean> {
  return (await probeSocket(socketPath)) === 'alive';
}

type TattlerMessageSender = {
  sendMessage(
    message: TattlerPendingBatchCustomMessage,
    options: { readonly deliverAs: 'steer'; readonly triggerTurn?: boolean },
  ): unknown;
};

type TattlerIpcRuntime = TattlerMessageSender &
  HasPiEventBus & {
    readonly pendingInbox?: TattlerPendingInbox;
    isIdle?(): boolean;
    persistPendingInboxSnapshot?(): void;
    notifyPendingInbox?(): void;
  };

function sendAgentMessageBatch(sender: TattlerMessageSender, message: TattlerAgentMessageV0): void {
  sender.sendMessage(createTattlerPendingBatchMessageFromMessages([createTattlerPendingAgentMessage(message)]), {
    triggerTurn: true,
    deliverAs: 'steer',
  });
}

function dispatchIncomingPayloadFrame(
  runtime: TattlerIpcRuntime | undefined,
  message: TattlerIncomingPayloadFrame,
): void {
  if (!runtime) {
    return;
  }

  try {
    switch (protocolFormat(message)) {
      case 'tattler.agent-message.v0': {
        const agentMessage = message as TattlerAgentMessageV0;
        if (runtime.pendingInbox && runtime.isIdle?.() === false) {
          const wasEmpty = runtime.pendingInbox.counts().total === 0;
          const enqueueResult = runtime.pendingInbox.enqueueAgentMessage(agentMessage);
          if (enqueueResult.accepted) {
            runtime.persistPendingInboxSnapshot?.();
            if (wasEmpty) {
              runtime.notifyPendingInbox?.();
            }
          }
          return;
        }

        sendAgentMessageBatch(runtime, agentMessage);
        return;
      }

      case 'chorus.room-post.v0':
        emitChorusRoomPostReceived(runtime, message as ChorusRoomPostV0);
        return;

      case 'chorus.room-delivery.v0':
        emitChorusRoomDelivery(runtime, message as ChorusRoomDeliveryV0);
        return;
    }
  } catch (dispatchErr) {
    console.error('Tattler socket error while dispatching message: ', dispatchErr);
  }
}

async function serverHandler(socket: net.Socket, runtime?: TattlerIpcRuntime): Promise<void> {
  socket.setEncoding('utf8');
  socket.on('error', (err) => {
    console.error('Tattler socket error while receiving message: ', err);
  });

  try {
    const line = await readIncomingFrameLine(socket);
    if (line === undefined) {
      return;
    }

    const frame = parseProtocolJsonLine(line);
    const correlatedMessageId = extractMessageId(frame);

    try {
      const message = parseIncomingPayloadFrame(frame);
      writeProtocolFrame(socket, createAck(message.id));
      dispatchIncomingPayloadFrame(runtime, message);
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

const serverConnections = new WeakMap<net.Server, Set<net.Socket>>();

export function createServerWithNotificationSender(sender: TattlerIpcRuntime): net.Server {
  const handler = async (socket: net.Socket) => {
    return serverHandler(socket, sender);
  };
  const server = net.createServer(handler);
  const connections = new Set<net.Socket>();
  serverConnections.set(server, connections);
  server.on('connection', (socket) => {
    connections.add(socket);
    socket.once('close', () => connections.delete(socket));
  });
  return server;
}

const SERVER_CLOSE_TIMEOUT_MS = 2_000;

/**
 * Close a Tattler server without letting a lingering peer connection stall
 * the caller forever: net.Server.close() only fires its callback once every
 * accepted connection has fully closed, so destroy tracked connections
 * first and timebox the close as a belt. Swallows a close timeout (logged)
 * — shutdown must proceed to socket-file cleanup regardless.
 */
export async function shutdownTattlerServer(
  server: net.Server,
  timeoutMs: number = SERVER_CLOSE_TIMEOUT_MS,
): Promise<void> {
  for (const socket of serverConnections.get(server) ?? []) {
    socket.destroy();
  }
  try {
    await withTimeout(
      new Promise<void>((resolve) => server.close(() => resolve())),
      timeoutMs,
      'Timed out waiting for the Tattler server to close',
    );
  } catch (closeErr) {
    console.error('Tattler server did not close cleanly during shutdown: ', closeErr);
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

export async function sendPayloadFrame(
  peer: TattlerIdentityV0,
  message: TattlerSendableFrame,
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

    peerConnection.write(serializeToJsonl(message));

    const replyLine = await replyLinePromise;
    return parseSendReplyLine(message.id, replyLine);
  } finally {
    peerConnection.destroy();
  }
}

export async function sendAgentMessage(
  peer: TattlerIdentityV0,
  message: TattlerAgentMessageV0,
): Promise<SendAgentMessageResult> {
  return sendPayloadFrame(peer, message);
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

function writeProtocolFrame(socket: net.Socket, frame: TattlerProtocolFrame): void {
  if (socket.destroyed || !socket.writable) {
    return;
  }

  socket.write(serializeToJsonl(frame));
}
