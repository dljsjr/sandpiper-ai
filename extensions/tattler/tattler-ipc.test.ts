import { once } from 'node:events';
import { unlink } from 'node:fs/promises';
import * as net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEventBus } from '@earendil-works/pi-coding-agent';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createTattlerPendingInbox, type TattlerPendingBatchCustomMessage } from './tattler-inbox';
import { createServerWithNotificationSender, sendAgentMessage, sendPayloadFrame } from './tattler-ipc';
import { onChorusRoomDelivery, onChorusRoomPostReceived } from './tattler-pi-events';
import {
  buildMessage,
  type ChorusReplyRouteV0,
  type ChorusRoomDeliveryV0,
  createChorusRoomPost,
  roomId,
  serializeToJsonl,
  type TattlerAgentMessageV0,
  type TattlerIdentityV0,
} from './tattler-protocol';

interface SentMessage {
  readonly message: TattlerPendingBatchCustomMessage;
  readonly options: { readonly deliverAs: 'steer'; readonly triggerTurn?: boolean };
}

function fakeRuntime(
  options: {
    readonly idle?: boolean;
    readonly persistPendingInboxSnapshot?: () => void;
    readonly notifyPendingInbox?: () => void;
  } = {},
) {
  const notifications: SentMessage[] = [];
  const pendingInbox = createTattlerPendingInbox();
  return {
    events: createEventBus(),
    notifications,
    pendingInbox,
    persistPendingInboxSnapshot: options.persistPendingInboxSnapshot,
    notifyPendingInbox: options.notifyPendingInbox,
    isIdle: () => options.idle ?? true,
    sendMessage(message: SentMessage['message'], options: SentMessage['options']) {
      notifications.push({ message, options });
    },
  };
}

const openServers: Array<{ readonly server: net.Server; readonly socketPath: string }> = [];

async function listen(runtime: ReturnType<typeof fakeRuntime>) {
  const socketPath = join(tmpdir(), `tattler-ipc-${crypto.randomUUID()}.sock`);
  const server = createServerWithNotificationSender(runtime);
  openServers.push({ server, socketPath });
  server.listen(socketPath);
  await once(server, 'listening');

  const peer: TattlerIdentityV0 = buildMessage('tattler.identity.v0', {
    name: 'receiver',
    shortId: 'receiver',
    socketPath,
  });

  return { peer, server, socketPath };
}

async function readReplyLine(socket: net.Socket): Promise<string> {
  let buffer = '';
  for await (const chunk of socket) {
    buffer += chunk;
    const newlineIdx = buffer.indexOf('\n');
    if (newlineIdx !== -1) {
      return buffer.slice(0, newlineIdx).trim();
    }
  }

  throw new Error('socket ended before reply');
}

async function sendRawLine(socketPath: string, line: string): Promise<string> {
  const socket = new net.Socket();
  socket.setEncoding('utf8');
  try {
    socket.connect(socketPath);
    await once(socket, 'connect');
    const replyLine = readReplyLine(socket);
    socket.write(`${line}\n`);
    return await replyLine;
  } finally {
    socket.destroy();
  }
}

afterEach(async () => {
  await Promise.all(
    openServers.splice(0).map(async ({ server, socketPath }) => {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
      await unlink(socketPath).catch(() => undefined);
    }),
  );
});

describe('Tattler IPC payload frames', () => {
  const broker: ChorusReplyRouteV0 = {
    name: 'session:broker',
    socketPath: '/tmp/tattler/broker.sock',
    shortId: 'broker',
  };

  test('preserves agent-message ACK and emits idle messages as single-message batches', async () => {
    const runtime = fakeRuntime();
    const { peer } = await listen(runtime);
    const message: TattlerAgentMessageV0 = buildMessage('tattler.agent-message.v0', {
      from: 'Piper',
      message: 'hello',
    });

    await expect(sendAgentMessage(peer, message)).resolves.toEqual({ messageIdAck: message.id });

    expect(runtime.notifications).toHaveLength(1);
    expect(runtime.notifications[0]?.message).toMatchObject({
      customType: 'tattler:pending-batch',
      display: false,
      details: {
        kind: 'batch',
        messages: [
          {
            kind: 'tattler.agent-message.v0',
            id: message.id,
            from: 'Piper',
            message: 'hello',
            visible: false,
          },
        ],
      },
    });
    expect(runtime.notifications[0]?.message.content).toContain('<tattler_inbox pending="1" visibility="hidden">');
    expect(runtime.notifications[0]?.message.content).toContain('<message from="Piper"');
    expect(runtime.notifications[0]?.options).toEqual({ triggerTurn: true, deliverAs: 'steer' });
  });

  test('ACKs agent messages while busy and keeps them in the pending inbox instead of steering Pi', async () => {
    const persistPendingInboxSnapshot = vi.fn();
    const runtime = fakeRuntime({ idle: false, persistPendingInboxSnapshot });
    const { peer } = await listen(runtime);
    const message: TattlerAgentMessageV0 = buildMessage('tattler.agent-message.v0', {
      from: 'Piper',
      message: 'pause and read this later',
    });

    await expect(sendAgentMessage(peer, message)).resolves.toEqual({ messageIdAck: message.id });

    expect(runtime.notifications).toHaveLength(0);
    expect(runtime.pendingInbox.counts()).toEqual({ pending: 1, reserved: 0, handedToTurn: 0, total: 1 });
    expect(runtime.pendingInbox.snapshot()[0]?.message).toMatchObject({
      kind: 'tattler.agent-message.v0',
      id: message.id,
      from: 'Piper',
      message: 'pause and read this later',
    });
    expect(persistPendingInboxSnapshot).toHaveBeenCalledTimes(1);
  });

  test('nudges once when the first busy agent message makes the pending inbox non-empty', async () => {
    const notifyPendingInbox = vi.fn();
    const runtime = fakeRuntime({ idle: false, notifyPendingInbox });
    const { peer } = await listen(runtime);

    await expect(
      sendAgentMessage(
        peer,
        buildMessage('tattler.agent-message.v0', {
          from: 'Piper',
          message: 'first pending note',
        }),
      ),
    ).resolves.toMatchObject({ messageIdAck: expect.any(String) });
    await expect(
      sendAgentMessage(
        peer,
        buildMessage('tattler.agent-message.v0', {
          from: 'Muninn',
          message: 'second pending note',
        }),
      ),
    ).resolves.toMatchObject({ messageIdAck: expect.any(String) });

    expect(runtime.pendingInbox.counts()).toEqual({ pending: 2, reserved: 0, handedToTurn: 0, total: 2 });
    expect(notifyPendingInbox).toHaveBeenCalledTimes(1);
  });

  test('ACKs room posts and emits the local room-post received event', async () => {
    const runtime = fakeRuntime();
    const { peer } = await listen(runtime);
    const post = createChorusRoomPost(roomId('chorus-dev'), 'Piper', broker, 'ship it');
    const received = new Promise<string>((resolve) => {
      onChorusRoomPostReceived(runtime, (event) => {
        resolve(`${event.roomId}:${event.from}:${event.message}:${event.broker.socketPath}`);
      });
    });

    await expect(sendPayloadFrame(peer, post)).resolves.toEqual({ messageIdAck: post.id });
    await expect(received).resolves.toEqual('chorus-dev:Piper:ship it:/tmp/tattler/broker.sock');
  });

  test('ACKs room deliveries and emits the room delivery event', async () => {
    const runtime = fakeRuntime();
    const { peer } = await listen(runtime);
    const post = createChorusRoomPost(roomId('chorus-dev'), 'Huginn', broker, 'scout note');
    const delivery: ChorusRoomDeliveryV0 = buildMessage('chorus.room-delivery.v0', {
      roomId: post.roomId,
      from: post.from,
      message: post.message,
      postId: post.id,
    });
    const received = new Promise<string>((resolve) => {
      onChorusRoomDelivery(runtime, (event) => {
        resolve(`${event.roomId}:${event.from}:${event.message}:${event.postId}`);
      });
    });

    await expect(sendPayloadFrame(peer, delivery)).resolves.toEqual({ messageIdAck: delivery.id });
    await expect(received).resolves.toEqual(`chorus-dev:Huginn:scout note:${post.id}`);
  });

  test('rejects malformed room posts with a protocol error instead of dispatching an event', async () => {
    const runtime = fakeRuntime();
    const { socketPath } = await listen(runtime);
    let dispatched = false;
    onChorusRoomPostReceived(runtime, () => {
      dispatched = true;
    });

    const replyLine = await sendRawLine(
      socketPath,
      JSON.stringify({
        format: 'chorus.room-post.v0',
        id: '019e5397-room-post',
        roomId: 'chorus-dev',
        from: 'Piper',
        message: 'missing broker',
      }),
    );

    expect(JSON.parse(replyLine)).toMatchObject({
      format: 'tattler.error.v0',
      error: {
        code: 'protocol-error',
        correlatedMessageId: '019e5397-room-post',
      },
    });
    expect(dispatched).toBe(false);
  });

  test('generic send helper preserves ACK parsing for room frames', async () => {
    const runtime = fakeRuntime();
    const { peer } = await listen(runtime);
    const post = createChorusRoomPost(roomId('chorus-dev'), 'Muninn', broker, 'steward note');

    const rawPost = serializeToJsonl(post);

    await expect(sendPayloadFrame(peer, post)).resolves.toEqual({ messageIdAck: post.id });
    expect(rawPost).toContain('"format":"chorus.room-post.v0"');
  });
});
