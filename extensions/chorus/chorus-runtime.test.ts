import { describe, expect, test } from 'vitest';
import {
  buildMessage,
  createChorusRoomPost,
  roomId,
  type TattlerIdentityV0,
  type TattlerSendableFrame,
} from '../tattler/tattler-protocol';
import {
  createChorusRoomBroker,
  createChorusRoomDeliveryFrame,
  createChorusUserMessageContent,
  isChorusBrokerAuthor,
  sendChorusReply,
} from './chorus-runtime';

function identity(name: string, socketPath = `/tmp/${name}.sock`): TattlerIdentityV0 {
  return buildMessage('tattler.identity.v0', {
    name,
    shortId: name,
    socketPath,
  });
}

describe('Chorus broker runtime', () => {
  test('records local posts and fans them out with the broker reply route', async () => {
    const sent: Array<{ peer: TattlerIdentityV0; frame: TattlerSendableFrame }> = [];
    const broker = createChorusRoomBroker({
      roomId: roomId('chorus-dev'),
      ownIdentity: identity('Piper'),
      brokerRoute: { name: 'chorus:chorus-dev', shortId: 'chorus-dev', socketPath: '/tmp/chorus-dev.sock' },
      peers: [identity('Huginn'), identity('Muninn')],
      sendFrame: async (peer, frame) => {
        sent.push({ peer, frame });
        return { messageIdAck: frame.id };
      },
    });

    const result = broker.postLocalMessage('hello room');
    await broker.waitForIdle();

    expect(result.postId).toEqual(broker.entries[0]?.id);
    expect(broker.entries).toMatchObject([{ from: 'Piper', message: 'hello room', self: true, status: 'acked' }]);
    expect(sent).toHaveLength(2);
    expect(sent.map(({ peer }) => peer.name)).toEqual(['Huginn', 'Muninn']);
    expect(sent[0]?.frame).toMatchObject({
      roomId: 'chorus-dev',
      from: 'Piper',
      broker: { socketPath: '/tmp/chorus-dev.sock' },
      message: 'hello room',
    });
  });

  test('uses configured local author name for messages typed in the room UI', async () => {
    const sent: Array<{ peer: TattlerIdentityV0; frame: TattlerSendableFrame }> = [];
    const broker = createChorusRoomBroker({
      roomId: roomId('chorus-dev'),
      ownIdentity: identity('Piper'),
      localAuthorName: 'Doug',
      brokerRoute: { name: 'chorus:chorus-dev', shortId: 'chorus-dev', socketPath: '/tmp/chorus-dev.sock' },
      peers: [identity('Huginn')],
      sendFrame: async (peer, frame) => {
        sent.push({ peer, frame });
        return { messageIdAck: frame.id };
      },
    });

    broker.postLocalMessage('human-authored message');
    await broker.waitForIdle();

    expect(broker.entries).toMatchObject([
      { from: 'Doug', message: 'human-authored message', self: true, status: 'acked' },
    ]);
    expect(sent[0]?.frame).toMatchObject({
      from: 'Doug',
      message: 'human-authored message',
      broker: { socketPath: '/tmp/chorus-dev.sock' },
    });
  });

  test('records received room posts and rebroadcasts participant deliveries to the rest of the room', async () => {
    const sent: Array<{ peer: TattlerIdentityV0; frame: TattlerSendableFrame }> = [];
    const broker = createChorusRoomBroker({
      roomId: roomId('chorus-dev'),
      ownIdentity: identity('Piper'),
      brokerRoute: { name: 'chorus:chorus-dev', shortId: 'chorus-dev', socketPath: '/tmp/chorus-dev.sock' },
      peers: [identity('Huginn'), identity('Muninn'), identity('Steward')],
      sendFrame: async (peer, frame) => {
        sent.push({ peer, frame });
        return { messageIdAck: frame.id };
      },
    });
    const post = createChorusRoomPost(roomId('chorus-dev'), 'Huginn', broker.brokerRoute, 'remote post');
    const delivery = createChorusRoomDeliveryFrame(roomId('chorus-dev'), 'Huginn', post.id, 'reply note');

    expect(broker.recordRoomPost(post)).toBe(true);
    const deliveryResult = broker.acceptDelivery(delivery);
    await broker.waitForIdle();

    expect(deliveryResult?.postId).toEqual(broker.entries[1]?.id);
    expect(broker.entries).toMatchObject([
      { from: 'Huginn', message: 'remote post', self: false, status: 'received' },
      { from: 'Huginn', message: 'reply note', self: false, postId: post.id, status: 'acked' },
    ]);
    expect(sent.map(({ peer }) => peer.name)).toEqual(['Muninn', 'Steward']);
    for (const { frame } of sent) {
      expect(frame).toMatchObject({
        from: 'Huginn',
        message: 'reply note',
        broker: { socketPath: '/tmp/chorus-dev.sock' },
      });
    }
  });

  test('routes local broker replies through local post fanout instead of sending to self', async () => {
    const sent: Array<{ peer: TattlerIdentityV0; frame: TattlerSendableFrame }> = [];
    const broker = createChorusRoomBroker({
      roomId: roomId('chorus-dev'),
      ownIdentity: identity('Piper'),
      localAuthorName: 'Doug',
      brokerRoute: { name: 'chorus:chorus-dev', shortId: 'chorus-dev', socketPath: '/tmp/chorus-dev.sock' },
      peers: [identity('Huginn')],
      sendFrame: async (peer, frame) => {
        sent.push({ peer, frame });
        return { messageIdAck: frame.id };
      },
    });

    const result = await sendChorusReply({
      activeBroker: broker,
      roomId: roomId('chorus-dev'),
      from: 'Piper',
      postId: 'remote-post',
      broker: broker.brokerRoute,
      message: 'local reply',
      sendFrame: async () => {
        throw new Error('remote send path should not be used for the active local broker');
      },
    });
    await broker.waitForIdle();

    expect(result).toMatchObject({ kind: 'local-post', postId: broker.entries[0]?.id });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.peer.name).toBe('Huginn');
    expect(sent[0]?.frame).toMatchObject({
      from: 'Piper',
      message: 'local reply',
      broker: { socketPath: '/tmp/chorus-dev.sock' },
    });
  });

  test('distinguishes broker route authors from local participant authors', () => {
    const broker = { name: 'chorus:chorus-dev:Piper', shortId: 'chorus-piper', socketPath: '/tmp/chorus-dev.sock' };

    expect(isChorusBrokerAuthor('chorus:chorus-dev:Piper', broker)).toBe(true);
    expect(isChorusBrokerAuthor('chorus-piper', broker)).toBe(true);
    expect(isChorusBrokerAuthor('Piper', broker)).toBe(false);
    expect(isChorusBrokerAuthor('Doug', broker)).toBe(false);
  });

  test('builds model-facing Chorus message content with broker route metadata', () => {
    const frame = createChorusRoomDeliveryFrame(roomId('chorus-dev'), 'Huginn', 'original-post', 'reply note');
    const content = createChorusUserMessageContent({
      roomId: frame.roomId,
      from: frame.from,
      message: frame.message,
      postId: frame.postId,
      broker: { name: 'chorus:chorus-dev', shortId: 'chorus-dev', socketPath: '/tmp/chorus-dev.sock' },
    });

    expect(content).toContain('<chorus_room_message');
    expect(content).toContain('roomId="chorus-dev"');
    expect(content).toContain('brokerSocketPath="/tmp/chorus-dev.sock"');
    expect(content).toContain('reply note');
  });
});
