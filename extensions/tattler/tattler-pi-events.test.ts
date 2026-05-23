import { createEventBus } from '@earendil-works/pi-coding-agent';
import { describe, expect, test } from 'vitest';
import {
  announceChorusReady,
  emitChorusRoomDelivery,
  onChorusReady,
  onChorusReadyRequest,
  onChorusRoomDelivery,
  onChorusRoomPostRequest,
  onListPeersRequest,
  requestChorusReady,
  requestChorusRoomPost,
  requestListPeers,
  roomPostToDelivery,
} from './tattler-pi-events';
import {
  buildMessage,
  type ChorusReplyRouteV0,
  createChorusRoomPost,
  roomId,
  type TattlerIdentityV0,
  type TattlerMessageId,
} from './tattler-protocol';

const broker: ChorusReplyRouteV0 = {
  name: 'session:broker',
  socketPath: '/tmp/tattler/broker.sock',
  shortId: 'broker',
};

function fakeExtensionPair() {
  const events = createEventBus();
  return {
    producer: { events },
    consumer: { events },
  };
}

describe('Chorus Pi event-bus contracts', () => {
  test('announces broker readiness for listeners already registered', () => {
    const { producer, consumer } = fakeExtensionPair();
    const seen: number[] = [];

    const unsubscribe = onChorusReady(consumer, (event) => {
      seen.push(event.generation);
    });

    announceChorusReady(producer, { generation: 1 });
    unsubscribe();
    announceChorusReady(producer, { generation: 2 });

    expect(seen).toEqual([1]);
  });

  test('supports late readiness probes through an event-bus responder', async () => {
    const { producer, consumer } = fakeExtensionPair();
    const ready = { generation: 2 };

    onChorusReadyRequest(producer, () => ready);

    await expect(requestChorusReady(consumer)).resolves.toEqual(ready);
  });

  test('times out readiness probes when no broker is registered', async () => {
    const { consumer } = fakeExtensionPair();

    await expect(requestChorusReady(consumer, { timeoutMs: 1 })).rejects.toThrow(
      'Timed out waiting for event response on chorus:request:ready',
    );
  });

  test('uses callback replies so concurrent peer requests do not race on a shared response channel', async () => {
    const { producer, consumer } = fakeExtensionPair();
    const piper: TattlerIdentityV0 = buildMessage('tattler.identity.v0', {
      name: 'Piper',
      shortId: 'piper',
      socketPath: '/tmp/piper.sock',
    });
    const huginn: TattlerIdentityV0 = buildMessage('tattler.identity.v0', {
      name: 'Huginn',
      shortId: 'huginn',
      socketPath: '/tmp/huginn.sock',
    });
    let requestCount = 0;

    onListPeersRequest(producer, () => {
      requestCount += 1;
      return requestCount === 1 ? [piper] : [huginn];
    });

    const first = requestListPeers(consumer);
    const second = requestListPeers(consumer);

    await expect(first).resolves.toEqual([piper]);
    await expect(second).resolves.toEqual([huginn]);
  });

  test('times out peer requests when no responder exists instead of resolving from the request payload', async () => {
    const { consumer } = fakeExtensionPair();

    await expect(requestListPeers(consumer, { timeoutMs: 1 })).rejects.toThrow(
      'Timed out waiting for event response on tattler:request:listPeers',
    );
  });

  test('uses callback replies for room posts so concurrent callers receive their own accepted post id', async () => {
    const { producer, consumer } = fakeExtensionPair();
    const room = roomId('chorus-dev');
    let requestCount = 0;

    onChorusRoomPostRequest(producer, async (request) => {
      expect(request.roomId).toEqual(room);
      requestCount += 1;
      return { postId: `019e5397-accepted-${requestCount}` as TattlerMessageId };
    });

    const first = requestChorusRoomPost(consumer, { roomId: room, message: 'ship it' });
    const second = requestChorusRoomPost(consumer, { roomId: room, message: 'ship it again' });

    await expect(first).resolves.toEqual({ postId: '019e5397-accepted-1' });
    await expect(second).resolves.toEqual({ postId: '019e5397-accepted-2' });
  });

  test('rejects room post requests when the broker handler throws', async () => {
    const { producer, consumer } = fakeExtensionPair();

    onChorusRoomPostRequest(producer, () => {
      throw new Error('broker unavailable');
    });

    await expect(requestChorusRoomPost(consumer, { roomId: roomId('chorus-dev'), message: 'ship it' })).rejects.toThrow(
      'broker unavailable',
    );
  });

  test('uses broadcast events for room deliveries', () => {
    const { producer, consumer } = fakeExtensionPair();
    const post = createChorusRoomPost(roomId('chorus-dev'), 'Piper', broker, 'hello everyone');
    const delivery = roomPostToDelivery(post);
    const seen: string[] = [];

    onChorusRoomDelivery(consumer, (event) => {
      seen.push(`${event.roomId}:${event.from}:${event.message}:${event.postId}`);
    });

    emitChorusRoomDelivery(producer, delivery);

    expect(seen).toEqual([`chorus-dev:Piper:hello everyone:${post.id}`]);
  });
});
