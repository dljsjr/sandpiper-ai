import { describe, expect, test } from 'vitest';
import {
  createTattlerPendingBatchDetails,
  createTattlerPendingInbox,
  drainPendingInboxToBatch,
  TATTLER_PENDING_BATCH_CUSTOM_TYPE,
  TATTLER_PENDING_BATCH_ENTRY_TYPE,
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

  test('restores correctly when a session mixes legacy custom_message batches with new display-only entries', () => {
    // A session that has lived across the appendEntry migration: an older, already-delivered
    // batch persisted as a legacy 'custom_message' (TATTLER_PENDING_BATCH_CUSTOM_TYPE), plus a
    // newer display-only self-echo persisted as a 'custom' entry (TATTLER_PENDING_BATCH_ENTRY_TYPE).
    // Neither the customType nor the entry `type` match what the two scans look for
    // (TATTLER_PENDING_INBOX_ENTRY_KEY for snapshots, TATTLER_PENDING_BATCH_CUSTOM_TYPE +
    // 'custom_message' for delivered-key dedup), so the entry-based batch must be ignored
    // cleanly by both -- not mistaken for a snapshot, not mistaken for a delivery marker, and
    // must not prevent unrelated still-pending messages from restoring.
    const inbox = createTattlerPendingInbox();
    inbox.enqueueAgentMessage(
      buildMessage('tattler.agent-message.v0', {
        id: 'hidden-1' as TattlerMessageId,
        from: 'Muninn',
        message: 'already delivered hidden note',
      }),
    );
    const legacyDrain = drainPendingInboxToBatch(inbox);
    inbox.enqueueAgentMessage(
      buildMessage('tattler.agent-message.v0', {
        id: 'still-pending-1' as TattlerMessageId,
        from: 'Muninn',
        message: 'queued after the delivered batch, still pending',
      }),
    );
    const staleSnapshot = createTattlerPendingInboxSnapshot(inbox);

    const displayOnlyEntryDetails = createTattlerPendingBatchDetails(
      [
        {
          kind: 'chorus.room-message.v0',
          id: 'self-echo-1' as TattlerMessageId,
          roomId: roomId('chorus-dev'),
          from: 'Piper',
          message: 'self-authored echo, never queued',
          postId: 'post-9' as TattlerMessageId,
          broker: { name: 'chorus:chorus-dev', shortId: 'chorus-dev', socketPath: '/tmp/chorus.sock' },
          self: true,
          visible: true,
        },
      ],
      'entry-batch-1',
    );

    const restored = createTattlerPendingInbox();
    restoreTattlerPendingInboxFromSession(restored, [
      { type: 'custom', customType: TATTLER_PENDING_INBOX_ENTRY_KEY, data: staleSnapshot },
      {
        type: 'custom_message',
        customType: TATTLER_PENDING_BATCH_CUSTOM_TYPE,
        details: legacyDrain?.message.details,
      },
      { type: 'custom', customType: TATTLER_PENDING_BATCH_ENTRY_TYPE, data: displayOnlyEntryDetails },
    ]);

    // The legacy delivered message is correctly excluded, the still-pending one correctly
    // restores, and the display-only entry neither resurrects as a pending item nor breaks
    // the scan for the other two.
    expect(restored.counts()).toEqual({ pending: 1, reserved: 0, handedToTurn: 0, total: 1 });
    expect(restored.snapshot()[0]?.message).toMatchObject({
      kind: 'tattler.agent-message.v0',
      id: 'still-pending-1',
      message: 'queued after the delivered batch, still pending',
    });
  });
});
