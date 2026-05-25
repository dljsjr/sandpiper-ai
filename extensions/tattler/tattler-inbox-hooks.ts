import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import {
  drainPendingInboxToBatch,
  TATTLER_PENDING_BATCH_CUSTOM_TYPE,
  type TattlerPendingBatchDetails,
  type TattlerPendingInbox,
} from './tattler-inbox';

interface TattlerPendingInboxHookOptions {
  onPendingInboxEmpty?(): void;
}

export function registerTattlerPendingInboxHooks(
  pi: Pick<ExtensionAPI, 'on'>,
  inbox: TattlerPendingInbox,
  options: TattlerPendingInboxHookOptions = {},
): void {
  const handedToTurnBatchIds = new Set<string>();

  pi.on('before_agent_start', () => {
    const drain = drainPendingInboxToBatch(inbox);
    if (!drain) {
      return;
    }

    drain.markHandedToTurn();
    handedToTurnBatchIds.add(drain.batch.batchId);
    return { message: drain.message };
  });

  pi.on('message_end', (event) => {
    if (event.message.role !== 'custom' || event.message.customType !== TATTLER_PENDING_BATCH_CUSTOM_TYPE) {
      return;
    }

    const details = event.message.details as Partial<TattlerPendingBatchDetails> | undefined;
    if (details?.kind !== 'batch' || typeof details.batchId !== 'string') {
      return;
    }

    inbox.markBatchDelivered(details.batchId);
    handedToTurnBatchIds.delete(details.batchId);
    notifyIfEmpty();
  });

  pi.on('agent_end', () => {
    for (const batchId of handedToTurnBatchIds) {
      inbox.releaseBatch(batchId);
    }
    handedToTurnBatchIds.clear();
    notifyIfEmpty();
  });

  function notifyIfEmpty(): void {
    if (inbox.counts().total === 0) {
      options.onPendingInboxEmpty?.();
    }
  }
}
