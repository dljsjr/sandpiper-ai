import {
  pendingMessageKey,
  TATTLER_PENDING_BATCH_CUSTOM_TYPE,
  TATTLER_PENDING_INBOX_ENTRY_KEY,
  type TattlerPendingBatchDetails,
  type TattlerPendingInbox,
  type TattlerPendingMessage,
} from './tattler-inbox';

export interface TattlerPendingInboxSnapshotItem {
  readonly key: string;
  readonly sequence: number;
  readonly message: TattlerPendingMessage;
}

export interface TattlerPendingInboxSnapshot {
  readonly version: 1;
  readonly items: readonly TattlerPendingInboxSnapshotItem[];
}

interface SessionEntryLike {
  readonly type: string;
  readonly customType?: string;
  readonly data?: unknown;
  readonly details?: unknown;
}

export function createTattlerPendingInboxSnapshot(inbox: TattlerPendingInbox): TattlerPendingInboxSnapshot {
  return {
    version: 1,
    items: inbox.snapshot().map((item) => ({
      key: item.key,
      sequence: item.sequence,
      message: item.message,
    })),
  };
}

export function restoreTattlerPendingInboxFromSession(
  inbox: TattlerPendingInbox,
  entries: readonly SessionEntryLike[],
): void {
  const latestSnapshot = findLatestPendingInboxSnapshot(entries);
  if (!latestSnapshot) {
    return;
  }

  const deliveredKeys = deliveredPendingMessageKeys(entries);
  const restorableItems = [...latestSnapshot.items]
    .sort((a, b) => a.sequence - b.sequence)
    .filter((item) => !deliveredKeys.has(item.key));

  inbox.clear();
  for (const item of restorableItems) {
    inbox.enqueue(item.message);
  }
}

function findLatestPendingInboxSnapshot(entries: readonly SessionEntryLike[]): TattlerPendingInboxSnapshot | undefined {
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index];
    if (entry?.type !== 'custom' || entry.customType !== TATTLER_PENDING_INBOX_ENTRY_KEY) {
      continue;
    }

    if (isPendingInboxSnapshot(entry.data)) {
      return entry.data;
    }
  }

  return;
}

function deliveredPendingMessageKeys(entries: readonly SessionEntryLike[]): Set<string> {
  const keys = new Set<string>();
  for (const entry of entries) {
    if (entry.type !== 'custom_message' || entry.customType !== TATTLER_PENDING_BATCH_CUSTOM_TYPE) {
      continue;
    }

    const details = entry.details;
    if (!isPendingBatchDetails(details)) {
      continue;
    }

    for (const message of details.messages) {
      keys.add(pendingMessageKey(message));
    }
  }

  return keys;
}

function isPendingInboxSnapshot(value: unknown): value is TattlerPendingInboxSnapshot {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const snapshot = value as Partial<TattlerPendingInboxSnapshot>;
  return snapshot.version === 1 && Array.isArray(snapshot.items) && snapshot.items.every(isPendingInboxSnapshotItem);
}

function isPendingInboxSnapshotItem(value: unknown): value is TattlerPendingInboxSnapshotItem {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const item = value as Partial<TattlerPendingInboxSnapshotItem>;
  return typeof item.key === 'string' && typeof item.sequence === 'number' && isPendingMessage(item.message);
}

function isPendingBatchDetails(value: unknown): value is TattlerPendingBatchDetails {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const details = value as Partial<TattlerPendingBatchDetails>;
  return details.kind === 'batch' && typeof details.batchId === 'string' && Array.isArray(details.messages);
}

function isPendingMessage(value: unknown): value is TattlerPendingMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const message = value as Partial<TattlerPendingMessage>;
  switch (message.kind) {
    case 'tattler.agent-message.v0':
      return (
        typeof message.id === 'string' &&
        typeof message.from === 'string' &&
        typeof message.message === 'string' &&
        message.visible === false
      );
    case 'chorus.room-message.v0':
      return (
        typeof message.id === 'string' &&
        typeof message.roomId === 'string' &&
        typeof message.from === 'string' &&
        typeof message.message === 'string' &&
        typeof message.postId === 'string' &&
        typeof message.broker === 'object' &&
        message.broker !== null &&
        typeof message.visible === 'boolean'
      );
    default:
      return false;
  }
}
