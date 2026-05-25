import { describe, expect, test } from 'vitest';
import {
  createTattlerPendingInbox,
  drainPendingInboxToBatch,
  TATTLER_PENDING_BATCH_CUSTOM_TYPE,
  TATTLER_PENDING_INBOX_ENTRY_KEY,
} from './tattler-inbox';
import { createTattlerPendingInboxSnapshot, restoreTattlerPendingInboxFromSession } from './tattler-inbox-persistence';
import { buildMessage, roomId, type TattlerAgentMessageV0, type TattlerMessageId } from './tattler-protocol';

describe('Tattler pending inbox persistence', () => {
  test('restores pending messages from the latest same-session snapshot after clearing memory', () => {
    const inbox = createTattlerPendingInbox();
    const message: TattlerAgentMessageV0 = buildMessage('tattler.agent-message.v0', {
      id: 'msg-1' as TattlerMessageId,
      from: 'Piper',
      message: 'recover after reload',
    });
    inbox.enqueueAgentMessage(message);
    const snapshot = createTattlerPendingInboxSnapshot(inbox);
    inbox.clear();

    restoreTattlerPendingInboxFromSession(inbox, [
      { type: 'custom', customType: TATTLER_PENDING_INBOX_ENTRY_KEY, data: snapshot },
    ]);

    expect(inbox.counts()).toEqual({ pending: 1, reserved: 0, handedToTurn: 0, total: 1 });
    expect(inbox.snapshot()[0]?.message).toMatchObject({
      kind: 'tattler.agent-message.v0',
      id: 'msg-1',
      from: 'Piper',
      message: 'recover after reload',
    });
  });

  test('does not restore messages already delivered by a persisted batch custom message', () => {
    const inbox = createTattlerPendingInbox();
    inbox.enqueueAgentMessage(
      buildMessage('tattler.agent-message.v0', {
        id: 'hidden-1' as TattlerMessageId,
        from: 'Muninn',
        message: 'already delivered hidden note',
      }),
    );
    inbox.enqueue({
      kind: 'chorus.room-message.v0',
      id: 'delivery-1' as TattlerMessageId,
      roomId: roomId('chorus-dev'),
      from: 'Piper',
      message: 'already delivered visible note',
      postId: 'post-1' as TattlerMessageId,
      broker: { name: 'chorus:chorus-dev', shortId: 'chorus-dev', socketPath: '/tmp/chorus.sock' },
      visible: true,
    });
    const staleSnapshot = createTattlerPendingInboxSnapshot(inbox);
    const drain = drainPendingInboxToBatch(inbox);

    const restored = createTattlerPendingInbox();
    restoreTattlerPendingInboxFromSession(restored, [
      { type: 'custom', customType: TATTLER_PENDING_INBOX_ENTRY_KEY, data: staleSnapshot },
      {
        type: 'custom_message',
        customType: TATTLER_PENDING_BATCH_CUSTOM_TYPE,
        details: drain?.message.details,
      },
    ]);

    expect(restored.counts()).toEqual({ pending: 0, reserved: 0, handedToTurn: 0, total: 0 });
  });
});
