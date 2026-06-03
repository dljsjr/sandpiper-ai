import { describe, expect, test } from 'vitest';
import { createTattlerPendingInbox, drainPendingInboxToBatch } from './tattler-inbox';
import { buildMessage, roomId, type TattlerAgentMessageV0, type TattlerMessageId } from './tattler-protocol';

describe('Tattler pending inbox', () => {
  test('dedupes pending messages and clears them only after delivery is marked', () => {
    const inbox = createTattlerPendingInbox();
    const message: TattlerAgentMessageV0 = buildMessage('tattler.agent-message.v0', {
      id: 'msg-1' as TattlerMessageId,
      from: 'Piper',
      message: 'hello from piper',
    });

    expect(inbox.enqueueAgentMessage(message)).toEqual({ accepted: true, key: 'tattler.agent-message.v0:msg-1' });
    expect(inbox.enqueueAgentMessage(message)).toEqual({ accepted: false, key: 'tattler.agent-message.v0:msg-1' });
    expect(inbox.counts()).toEqual({ pending: 1, reserved: 0, handedToTurn: 0, total: 1 });

    const batch = inbox.reserveBatch();
    expect(batch?.items).toHaveLength(1);
    expect(batch?.items[0]).toMatchObject({
      key: 'tattler.agent-message.v0:msg-1',
      state: 'reserved',
      message: { kind: 'tattler.agent-message.v0', id: 'msg-1', from: 'Piper', message: 'hello from piper' },
    });
    expect(inbox.counts()).toEqual({ pending: 0, reserved: 1, handedToTurn: 0, total: 1 });

    expect(inbox.reserveBatch()).toBeUndefined();

    inbox.markBatchHandedToTurn(batch!.batchId);
    expect(inbox.counts()).toEqual({ pending: 0, reserved: 0, handedToTurn: 1, total: 1 });

    inbox.markBatchDelivered(batch!.batchId);
    expect(inbox.counts()).toEqual({ pending: 0, reserved: 0, handedToTurn: 0, total: 0 });
  });

  test('marks mixed batches displayable while keeping model content canonical', () => {
    const inbox = createTattlerPendingInbox();
    const hiddenMessage: TattlerAgentMessageV0 = buildMessage('tattler.agent-message.v0', {
      id: 'hidden-1' as TattlerMessageId,
      from: 'Muninn',
      message: 'hidden coordination note',
    });
    inbox.enqueueAgentMessage(hiddenMessage);
    inbox.enqueue({
      kind: 'chorus.room-message.v0',
      id: 'delivery-1' as TattlerMessageId,
      roomId: roomId('chorus-dev'),
      from: 'Piper',
      message: 'visible room note',
      postId: 'post-1' as TattlerMessageId,
      broker: { name: 'chorus:chorus-dev', shortId: 'chorus-dev', socketPath: '/tmp/chorus.sock' },
      visible: true,
    });

    const drain = drainPendingInboxToBatch(inbox);

    expect(drain?.message.display).toBe(true);
    expect(drain?.message.content).toContain('<tattler_inbox pending="1" visibility="hidden">');
    expect(drain?.message.content).toContain('<message from="Muninn" id="hidden-1">hidden coordination note</message>');
    expect(drain?.message.content).toContain(
      '<chorus_inbox roomId="chorus-dev" pending="1" visibility="visible" replyTool="send_chorus_reply">',
    );
    expect(drain?.message.content).toContain(
      '<message from="Piper" postId="post-1" brokerName="chorus:chorus-dev" brokerShortId="chorus-dev" brokerSocketPath="/tmp/chorus.sock">visible room note</message>',
    );
    expect(drain?.message.content).not.toContain('reply_policy');
    expect(drain?.message.content).not.toContain('reply_contract');
    expect(drain?.message.content).not.toContain('<instructions>');
    expect(drain?.message.content).not.toContain('<tattler_pending_message_batch');
    expect(drain?.message.content).not.toContain('<tattler_agent_message');
    expect(drain?.message.content).not.toContain('<chorus_room_message');
    expect(drain?.message.details.messages).toHaveLength(2);
  });

  test('escapes slim envelope content and coalesces consecutive Chorus room messages', () => {
    const inbox = createTattlerPendingInbox();
    const broker = { name: 'chorus:chorus-dev', shortId: 'chorus-dev', socketPath: '/tmp/chorus&dev.sock' };
    inbox.enqueue({
      kind: 'chorus.room-message.v0',
      id: 'delivery-1' as TattlerMessageId,
      roomId: roomId('chorus-dev'),
      from: 'Piper',
      message: 'first </message> & <tag attr="x">',
      postId: 'post-1' as TattlerMessageId,
      broker,
      visible: true,
    });
    inbox.enqueue({
      kind: 'chorus.room-message.v0',
      id: 'delivery-2' as TattlerMessageId,
      roomId: roomId('chorus-dev'),
      from: 'Huginn',
      message: 'second note',
      postId: 'post-2' as TattlerMessageId,
      broker,
      visible: true,
    });

    const drain = drainPendingInboxToBatch(inbox);

    expect(drain?.message.content).toContain(
      '<chorus_inbox roomId="chorus-dev" pending="2" visibility="visible" replyTool="send_chorus_reply">',
    );
    expect(drain?.message.content).toContain('brokerSocketPath="/tmp/chorus&amp;dev.sock"');
    expect(drain?.message.content).toContain('first &lt;/message&gt; &amp; &lt;tag attr=&quot;x&quot;&gt;');
    expect(drain?.message.content).toContain('second note');
  });

  test('clears session-scoped pending state and sequence numbers', () => {
    const inbox = createTattlerPendingInbox();
    inbox.enqueueAgentMessage(buildMessage('tattler.agent-message.v0', { from: 'Piper', message: 'old session' }));

    inbox.clear();

    expect(inbox.counts()).toEqual({ pending: 0, reserved: 0, handedToTurn: 0, total: 0 });
    inbox.enqueueAgentMessage(buildMessage('tattler.agent-message.v0', { from: 'Piper', message: 'new session' }));
    expect(inbox.snapshot()[0]?.sequence).toBe(0);
  });
});
