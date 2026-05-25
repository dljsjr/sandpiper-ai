import { randomUUID } from 'node:crypto';
import type { ChorusReplyRouteV0, ChorusRoomId, TattlerAgentMessageV0, TattlerMessageId } from './tattler-protocol';

export const TATTLER_PENDING_BATCH_CUSTOM_TYPE = 'tattler:pending-batch';
export const TATTLER_PENDING_INBOX_ENTRY_KEY = 'tattler:pending-inbox';

export type PendingInboxState = 'pending' | 'reserved' | 'handedToTurn';

export interface TattlerPendingAgentMessage {
  readonly kind: 'tattler.agent-message.v0';
  readonly id: TattlerMessageId;
  readonly from: string;
  readonly message: string;
  readonly visible: false;
}

export interface TattlerPendingChorusMessage {
  readonly kind: 'chorus.room-message.v0';
  readonly id: TattlerMessageId;
  readonly roomId: ChorusRoomId;
  readonly from: string;
  readonly message: string;
  readonly postId: TattlerMessageId;
  readonly broker: ChorusReplyRouteV0;
  readonly self?: boolean;
  readonly visible: boolean;
}

export type TattlerPendingMessage = TattlerPendingAgentMessage | TattlerPendingChorusMessage;

export interface TattlerPendingInboxItem {
  readonly key: string;
  readonly sequence: number;
  readonly state: PendingInboxState;
  readonly batchId?: string;
  readonly message: TattlerPendingMessage;
}

export interface TattlerPendingBatch {
  readonly batchId: string;
  readonly items: readonly TattlerPendingInboxItem[];
}

export interface TattlerPendingBatchDetails {
  readonly kind: 'batch';
  readonly batchId: string;
  readonly messages: readonly TattlerPendingMessage[];
}

export interface TattlerPendingBatchCustomMessage {
  readonly customType: typeof TATTLER_PENDING_BATCH_CUSTOM_TYPE;
  readonly content: string;
  readonly display: boolean;
  readonly details: TattlerPendingBatchDetails;
}

export interface TattlerPendingInboxCounts {
  readonly pending: number;
  readonly reserved: number;
  readonly handedToTurn: number;
  readonly total: number;
}

export interface TattlerPendingEnqueueResult {
  readonly accepted: boolean;
  readonly key: string;
}

export interface TattlerPendingInboxDrain {
  readonly batch: TattlerPendingBatch;
  readonly message: TattlerPendingBatchCustomMessage;
  markHandedToTurn(): void;
  markDelivered(): void;
  release(): void;
}

export class TattlerPendingInbox {
  private readonly items = new Map<string, TattlerPendingInboxItem>();
  private nextSequence = 0;

  clear(): void {
    this.items.clear();
    this.nextSequence = 0;
  }

  enqueueAgentMessage(message: TattlerAgentMessageV0): TattlerPendingEnqueueResult {
    return this.enqueue(createTattlerPendingAgentMessage(message));
  }

  enqueue(message: TattlerPendingMessage): TattlerPendingEnqueueResult {
    const key = pendingMessageKey(message);
    if (this.items.has(key)) {
      return { accepted: false, key };
    }

    this.items.set(key, {
      key,
      sequence: this.nextSequence++,
      state: 'pending',
      message,
    });
    return { accepted: true, key };
  }

  counts(): TattlerPendingInboxCounts {
    let pending = 0;
    let reserved = 0;
    let handedToTurn = 0;

    for (const item of this.items.values()) {
      if (item.state === 'pending') pending++;
      if (item.state === 'reserved') reserved++;
      if (item.state === 'handedToTurn') handedToTurn++;
    }

    return { pending, reserved, handedToTurn, total: this.items.size };
  }

  snapshot(): readonly TattlerPendingInboxItem[] {
    return [...this.items.values()].sort(bySequence);
  }

  reserveBatch(): TattlerPendingBatch | undefined {
    const batchId = `tattler-batch-${randomUUID()}`;
    const pendingItems = this.snapshot().filter((item) => item.state === 'pending');
    if (pendingItems.length === 0) {
      return undefined;
    }

    const reservedItems = pendingItems.map((item) => ({ ...item, state: 'reserved' as const, batchId }));
    for (const item of reservedItems) {
      this.items.set(item.key, item);
    }

    return { batchId, items: reservedItems };
  }

  markBatchHandedToTurn(batchId: string): void {
    for (const item of this.items.values()) {
      if (item.state === 'reserved' && item.batchId === batchId) {
        this.items.set(item.key, { ...item, state: 'handedToTurn' });
      }
    }
  }

  markBatchDelivered(batchId: string): void {
    for (const item of this.items.values()) {
      if ((item.state === 'reserved' || item.state === 'handedToTurn') && item.batchId === batchId) {
        this.items.delete(item.key);
      }
    }
  }

  releaseBatch(batchId: string): void {
    for (const item of this.items.values()) {
      if ((item.state === 'reserved' || item.state === 'handedToTurn') && item.batchId === batchId) {
        this.items.set(item.key, { ...item, state: 'pending', batchId: undefined });
      }
    }
  }
}

export function createTattlerPendingInbox(): TattlerPendingInbox {
  return new TattlerPendingInbox();
}

export function createTattlerPendingAgentMessage(message: TattlerAgentMessageV0): TattlerPendingAgentMessage {
  return {
    kind: 'tattler.agent-message.v0',
    id: message.id,
    from: message.from,
    message: message.message,
    visible: false,
  };
}

export function drainPendingInboxToBatch(inbox: TattlerPendingInbox): TattlerPendingInboxDrain | undefined {
  const batch = inbox.reserveBatch();
  if (!batch) {
    return undefined;
  }

  return {
    batch,
    message: createTattlerPendingBatchMessage(batch),
    markHandedToTurn: () => inbox.markBatchHandedToTurn(batch.batchId),
    markDelivered: () => inbox.markBatchDelivered(batch.batchId),
    release: () => inbox.releaseBatch(batch.batchId),
  };
}

export function createTattlerPendingBatchMessage(batch: TattlerPendingBatch): TattlerPendingBatchCustomMessage {
  return createTattlerPendingBatchMessageFromMessages(
    batch.items.map((item) => item.message),
    { batchId: batch.batchId },
  );
}

export function createTattlerPendingBatchMessageFromMessages(
  messages: readonly TattlerPendingMessage[],
  options: { readonly batchId?: string; readonly modelVisible?: boolean } = {},
): TattlerPendingBatchCustomMessage {
  const batchId = options.batchId ?? `tattler-batch-${randomUUID()}`;
  return {
    customType: TATTLER_PENDING_BATCH_CUSTOM_TYPE,
    content: options.modelVisible === false ? '' : createTattlerPendingBatchContent(batchId, messages),
    display: messages.some((message) => message.visible),
    details: {
      kind: 'batch',
      batchId,
      messages,
    },
  };
}

export function pendingMessageKey(message: TattlerPendingMessage): string {
  switch (message.kind) {
    case 'tattler.agent-message.v0':
      return `${message.kind}:${message.id}`;
    case 'chorus.room-message.v0':
      return `${message.kind}:${message.roomId}:${message.postId}`;
  }
}

function createTattlerPendingBatchContent(batchId: string, messages: readonly TattlerPendingMessage[]): string {
  const lines = [
    `<tattler_pending_message_batch batchId="${escapeXml(batchId)}" count="${messages.length}">`,
    '  <instructions>These Tattler/Chorus messages arrived while you were busy. Process them in arrival order. Respond only when a message warrants a substantive reply; do not acknowledge every message.</instructions>',
  ];

  for (const message of messages) {
    lines.push(...formatPendingMessageContent(message, 1));
  }

  lines.push('</tattler_pending_message_batch>');
  return lines.join('\n');
}

function formatPendingMessageContent(message: TattlerPendingMessage, level: number): string[] {
  const prefix = '  '.repeat(level);
  switch (message.kind) {
    case 'tattler.agent-message.v0':
      return [
        `${prefix}<tattler_agent_message id="${escapeXml(message.id)}" from="${escapeXml(message.from)}">`,
        `${prefix}  <instructions>This is a hidden coordination message from another coding agent. The user cannot see it unless you explicitly summarize it.</instructions>`,
        `${prefix}  <message>${escapeXml(message.message)}</message>`,
        `${prefix}</tattler_agent_message>`,
      ];
    case 'chorus.room-message.v0':
      return [
        `${prefix}<chorus_room_message roomId="${escapeXml(message.roomId)}" postId="${escapeXml(message.postId)}" from="${escapeXml(message.from)}" brokerName="${escapeXml(message.broker.name)}" brokerShortId="${escapeXml(message.broker.shortId)}" brokerSocketPath="${escapeXml(message.broker.socketPath)}">`,
        `${prefix}  <instructions>This is a Chorus room message from a room participant. Do not reply to every room message. Reply only if you are directly addressed, own the relevant work lane, have new information, or silence would block progress. If you reply substantively, use the send_chorus_reply tool with this roomId, postId, and broker route. If no reply is needed and no other work remains for this turn, use the done tool instead of writing a courtesy acknowledgement. Do not reply with a plain Tattler DM.</instructions>`,
        `${prefix}  <message>${escapeXml(message.message)}</message>`,
        `${prefix}</chorus_room_message>`,
      ];
  }
}

function bySequence(a: TattlerPendingInboxItem, b: TattlerPendingInboxItem): number {
  return a.sequence - b.sequence;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
