import { describe, expect, test } from 'vitest';
import {
  type ChorusReplyRouteV0,
  createChorusRoomDelivery,
  createChorusRoomPost,
  parseIncomingPayloadFrame,
  roomId,
  serializeToJsonl,
  type TattlerMessageId,
} from './tattler-protocol';

const broker: ChorusReplyRouteV0 = {
  name: 'session:broker',
  socketPath: '/tmp/tattler/broker.sock',
  shortId: 'broker',
};

describe('Chorus room wire messages', () => {
  test('serializes room posts with explicit format and room metadata', () => {
    const post = createChorusRoomPost(roomId('vcg'), 'Piper', broker, 'hello room');

    const serialized = JSON.parse(serializeToJsonl(post)) as Record<string, unknown>;

    expect(serialized).toMatchObject({
      format: 'chorus.room-post.v0',
      roomId: 'vcg',
      from: 'Piper',
      broker,
      message: 'hello room',
    });
    expect(serialized.id).toEqual(post.id);
  });

  test('parses room posts as payload frames with an explicit broker reply route', () => {
    const parsed = parseIncomingPayloadFrame({
      format: 'chorus.room-post.v0',
      id: '019e5397-room-post' as TattlerMessageId,
      roomId: 'chorus-dev',
      from: 'Huginn',
      broker,
      message: 'scout note',
    });

    expect(parsed).toMatchObject({
      id: '019e5397-room-post',
      roomId: 'chorus-dev',
      from: 'Huginn',
      broker,
      message: 'scout note',
    });
  });

  test('rejects room posts without a broker reply route', () => {
    expect(() =>
      parseIncomingPayloadFrame({
        format: 'chorus.room-post.v0',
        id: '019e5397-room-post' as TattlerMessageId,
        roomId: 'chorus-dev',
        from: 'Huginn',
        message: 'scout note',
      }),
    ).toThrow('Incoming room message missing required reply route field [broker]');
  });

  test('creates deliveries that preserve the original post id for correlation', () => {
    const post = createChorusRoomPost(roomId('chorus-dev'), 'Muninn', broker, 'steward note');
    const delivery = createChorusRoomDelivery(post);

    expect(JSON.parse(serializeToJsonl(delivery))).toMatchObject({
      format: 'chorus.room-delivery.v0',
      roomId: 'chorus-dev',
      from: 'Muninn',
      message: 'steward note',
      postId: post.id,
    });
  });

  test('rejects empty room ids', () => {
    expect(() => roomId('   ')).toThrow('Chorus room ID must be a non-empty string');
  });

  test('rejects room ids with surrounding whitespace', () => {
    expect(() => roomId(' chorus-dev ')).toThrow('Chorus room ID must not contain surrounding whitespace');
  });

  test('rejects oversized room payloads', () => {
    expect(() =>
      parseIncomingPayloadFrame({
        format: 'chorus.room-post.v0',
        id: '019e5397-room-post' as TattlerMessageId,
        roomId: 'chorus-dev',
        from: 'Piper',
        broker,
        message: 'x'.repeat(4097),
      }),
    ).toThrow('Incoming message length 4097 > 4096');
  });
});
