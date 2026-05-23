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

  test('records received room posts and deliveries that match the active room', () => {
    const broker = createChorusRoomBroker({
      roomId: roomId('chorus-dev'),
      ownIdentity: identity('Piper'),
      brokerRoute: { name: 'chorus:chorus-dev', shortId: 'chorus-dev', socketPath: '/tmp/chorus-dev.sock' },
      peers: [],
      sendFrame: async (_peer, frame) => ({ messageIdAck: frame.id }),
    });
    const post = createChorusRoomPost(roomId('chorus-dev'), 'Huginn', broker.brokerRoute, 'remote post');
    const delivery = createChorusRoomDeliveryFrame(roomId('chorus-dev'), 'Muninn', post.id, 'reply note');

    expect(broker.recordRoomPost(post)).toBe(true);
    expect(broker.recordDelivery(delivery)).toBe(true);

    expect(broker.entries).toMatchObject([
      { from: 'Huginn', message: 'remote post', self: false, status: 'received' },
      { from: 'Muninn', message: 'reply note', self: false, postId: post.id },
    ]);
  });

  test('routes local broker replies through local post fanout instead of sending to self', async () => {
    const sent: Array<{ peer: TattlerIdentityV0; frame: TattlerSendableFrame }> = [];
    const broker = createChorusRoomBroker({
      roomId: roomId('chorus-dev'),
      ownIdentity: identity('Piper'),
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
