import { once } from 'node:events';
import * as net from 'node:net';
import {
  errorMessage,
  type SystemNotificationSender,
  SystemNotificationSourceType,
  sendSystemNotification,
  withTimeout,
} from 'sandpiper-ai-core';
import {
  createAck,
  createProtocolError,
  extractMessageId,
  MAX_PROTOCOL_REPLY_BYTES,
  MAX_PROTOCOL_REQUEST_BYTES,
  parseIncomingAgentMessage,
  parseProtocolJsonLine,
  parseSendReplyLine,
  SEND_ACK_TIMEOUT_MS,
  type SendAgentMessageResult,
  serializeToJsonl,
  type TattlerAgentMessageV0,
  type TattlerIdentityV0,
  type TattlerMessageId,
  type TattlerProtocolFrame,
} from './tattler-protocol';

// Adapted from https://github.com/mitsuhiko/agent-stuff, Apache 2.0
export async function isSocketAlive(socketPath: string): Promise<boolean> {
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

async function serverHandler(socket: net.Socket, sender?: SystemNotificationSender): Promise<void> {
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

export function createServerWithNotificationSender(sender: SystemNotificationSender): net.Server {
  const handler = async (socket: net.Socket) => {
    return serverHandler(socket, sender);
  };
  return net.createServer(handler);
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

export async function sendAgentMessage(
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

    peerConnection.write(serializeToJsonl(message));

    const replyLine = await replyLinePromise;
    return parseSendReplyLine(message.id, replyLine);
  } finally {
    peerConnection.destroy();
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

function writeProtocolFrame(socket: net.Socket, frame: TattlerProtocolFrame): void {
  if (socket.destroyed || !socket.writable) {
    return;
  }

  socket.write(serializeToJsonl(frame));
}
