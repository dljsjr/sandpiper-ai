import { errorMessage, isRecord } from 'sandpiper-ai-core';
import { v7 as uuidv7 } from 'uuid';

// socket/wire protocol constants
export const TATTLER_ID_ENTRY_KEY = 'tattler-id';
export const SEND_ACK_TIMEOUT_MS = 5_000;
export const MAX_MESSAGE_BYTES = 4096;
export const MAX_PROTOCOL_REPLY_BYTES = 2048;
export const MAX_PROTOCOL_REQUEST_BYTES = MAX_MESSAGE_BYTES + 2048;

// ============================================================================
// Message Formats
// ============================================================================
//#region Message Formats

const TattlerProtocolFormat: unique symbol = Symbol('TattlerProtocolFormat');
export type TattlerFormatKey =
  | 'tattler.identity.v0'
  | 'tattler.ack.v0'
  | 'tattler.error.v0'
  | 'tattler.agent-message.v0';

declare const tattlerMessageIdBrand: unique symbol;
export type TattlerMessageId = string & {
  readonly [tattlerMessageIdBrand]: true;
};

export interface TattlerMessageBase<K extends TattlerFormatKey> {
  readonly [TattlerProtocolFormat]: K;
  readonly id: TattlerMessageId;
}

// v0 invariant: every persisted identity property is an addressable route key.
// Revisit for TAT-7 once identity grows non-routing metadata.
export interface TattlerIdentityV0 extends TattlerMessageBase<'tattler.identity.v0'> {
  name: string;
  socketPath: string;
  shortId: string;
}

export interface TattlerCorrelationPayload {
  readonly correlatedMessageId?: TattlerMessageId;
}

export interface TattlerAckV0Payload extends TattlerCorrelationPayload {
  readonly correlatedMessageId: TattlerMessageId;
}

export interface TattlerAckV0 extends TattlerMessageBase<'tattler.ack.v0'> {
  readonly ack: TattlerAckV0Payload;
}

export type TattlerErrorV0Payload = {
  readonly code: string;
  readonly message: string;
} & TattlerCorrelationPayload;

export interface TattlerErrorV0 extends TattlerMessageBase<'tattler.error.v0'> {
  readonly error: TattlerErrorV0Payload;
}

export interface TattlerAgentMessageV0 extends TattlerMessageBase<'tattler.agent-message.v0'> {
  readonly from: string;
  readonly message: string;
}

export type TattlerProtocolFrame = TattlerAckV0 | TattlerErrorV0 | TattlerAgentMessageV0;

//#endregion

// ============================================================================
// Message Helpers
// ============================================================================
//#region Message Helper Utils
function newMessageId(): TattlerMessageId {
  return uuidv7() as TattlerMessageId;
}

export type MessageProps<K extends TattlerFormatKey, T extends TattlerMessageBase<K>> = Omit<
  T,
  typeof TattlerProtocolFormat | 'id'
> &
  Partial<Pick<T, 'id'>>;

export function buildMessage<K extends TattlerFormatKey, T extends TattlerMessageBase<K>>(
  formatKey: K,
  props: MessageProps<K, T>,
): T {
  const { id: maybeId, ...remainingProps } = { ...props };

  return {
    [TattlerProtocolFormat]: formatKey,
    id: maybeId || newMessageId(),
    ...remainingProps,
  } as T;
}

export function stripProtocolFrame<K extends TattlerFormatKey, T extends TattlerMessageBase<K>>(
  message: T,
): MessageProps<K, T> {
  const { id, [TattlerProtocolFormat]: K, ...base } = { ...message };
  return base;
}

export function serializeToJsonl<K extends TattlerFormatKey, T extends TattlerMessageBase<K>>(message: T): string {
  const outObj = { ...message, format: message[TattlerProtocolFormat] };
  return `${JSON.stringify(outObj)}\n`;
}
//#endregion

// ============================================================================
// Socket/Protocol Implementation
// ============================================================================
//#region Socket/Protocol Implementation

export interface SendAgentMessageResult {
  readonly messageIdAck: TattlerMessageId;
}

export function extractMessageId(frame: unknown): TattlerMessageId | undefined {
  if (!isRecord(frame) || typeof frame.id !== 'string' || frame.id.trim().length === 0) {
    return undefined;
  }

  return frame.id as TattlerMessageId;
}

function requiredStringField(frame: Record<string, unknown>, fieldName: string): string {
  const value = frame[fieldName];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Incoming agent message missing required string field [${fieldName}]`);
  }

  return value;
}

export function parseProtocolJsonLine(jsonLine: string): unknown {
  try {
    return JSON.parse(jsonLine) as unknown;
  } catch (err) {
    throw new Error(`Malformed protocol JSON: ${errorMessage(err)}`);
  }
}

export function parseIncomingAgentMessage(frame: unknown): TattlerAgentMessageV0 {
  if (!isRecord(frame)) {
    throw new Error('Incoming protocol frame must be a JSON object');
  }

  if (frame.format !== 'tattler.agent-message.v0') {
    throw new Error(`Unsupported incoming protocol frame format [${String(frame.format)}]`);
  }

  const message = requiredStringField(frame, 'message');
  const messageLength = Buffer.byteLength(message, 'utf8');
  if (messageLength > MAX_MESSAGE_BYTES) {
    throw new Error(`Incoming agent message length ${messageLength} > ${MAX_MESSAGE_BYTES}`);
  }

  return buildMessage('tattler.agent-message.v0', {
    id: requiredStringField(frame, 'id') as TattlerMessageId,
    from: requiredStringField(frame, 'from'),
    message,
  });
}

export function createAck(correlatedMessageId: TattlerMessageId): TattlerAckV0 {
  return buildMessage('tattler.ack.v0', {
    ack: { correlatedMessageId },
  });
}

export function createProtocolError(message: string, correlatedMessageId?: TattlerMessageId): TattlerErrorV0 {
  return buildMessage('tattler.error.v0', {
    error: {
      code: 'protocol-error',
      message,
      ...(correlatedMessageId === undefined ? {} : { correlatedMessageId }),
    },
  });
}

function ackToSendResult(pendingId: TattlerMessageId, ack: TattlerAckV0): SendAgentMessageResult {
  if (pendingId !== ack.ack.correlatedMessageId) {
    throw new Error(`Received unexpected ACK for message ID ${ack.ack.correlatedMessageId}, expected ID ${pendingId}`);
  }

  return { messageIdAck: ack.ack.correlatedMessageId };
}

function protocolErrorToError(pendingId: TattlerMessageId, err: TattlerErrorV0): Error {
  if (err.error.correlatedMessageId === undefined) {
    return new Error(`Received protocol error:\n${JSON.stringify(err.error, null, 2)}`);
  }

  if (pendingId !== err.error.correlatedMessageId) {
    return new Error(
      `Received unexpected error correlated to ID ${err.error.correlatedMessageId}, expected ${pendingId}:\n${JSON.stringify(err.error, null, 2)}`,
    );
  }

  return new Error(`Peer rejected message ID ${pendingId}:\n${JSON.stringify(err.error, null, 2)}`);
}

export function parseSendReplyLine(pendingId: TattlerMessageId, jsonLine: string): SendAgentMessageResult {
  let protocolReply: TattlerMessageBase<TattlerFormatKey>;
  try {
    const protocolReplyRaw: unknown & {
      format?: TattlerFormatKey;
    } = JSON.parse(jsonLine);
    if (protocolReplyRaw.format === undefined) {
      throw new Error('missing format key');
    }
    const { format, ...props } = { ...protocolReplyRaw };
    protocolReply = buildMessage(format as TattlerFormatKey, props);
  } catch (err) {
    throw new Error(`Problem while parsing protocol reply for message ${pendingId}: ${err}`);
  }

  switch (protocolReply[TattlerProtocolFormat]) {
    case 'tattler.ack.v0':
      return ackToSendResult(pendingId, protocolReply as TattlerAckV0);

    case 'tattler.error.v0':
      throw protocolErrorToError(pendingId, protocolReply as TattlerErrorV0);

    default:
      throw new Error(
        `Unexpected message format [${protocolReply[TattlerProtocolFormat]}] while waiting for protocol reply for message ${pendingId}`,
      );
  }
}
