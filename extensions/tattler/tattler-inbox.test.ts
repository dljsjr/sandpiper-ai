import { describe, expect, test } from 'vitest';
import { createTattlerPendingInbox } from './tattler-inbox';
import { buildMessage, type TattlerAgentMessageV0, type TattlerMessageId } from './tattler-protocol';

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
});
