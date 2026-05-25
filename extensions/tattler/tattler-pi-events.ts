import type { TattlerPendingEnqueueResult, TattlerPendingMessage } from './tattler-inbox';
import type {
  ChorusRoomDeliveryV0,
  ChorusRoomId,
  ChorusRoomPostV0,
  TattlerIdentityV0,
  TattlerMessageId,
} from './tattler-protocol';
import { createChorusRoomDelivery } from './tattler-protocol';

export const DEFAULT_EVENT_REQUEST_TIMEOUT_MS = 5_000;

// These helpers are contract adapters over `pi.events`, not a shared state
// module. Extension load instances may not share ES module globals, so every
// cross-extension Tattler↔Chorus interaction must travel through the event bus.
interface PiEventBusLike {
  on(channel: string, handler: (data: unknown) => void): () => void;
  emit(channel: string, data: unknown): void;
}

export interface HasPiEventBus {
  readonly events: PiEventBusLike;
}

type Awaitable<T> = T | Promise<T>;
type EventReply<T> = (response: T) => void;
type EventReject = (error: Error) => void;

const TattlerPiEventBusKey = {
  listPeers: 'tattler:request:listPeers',
  ownIdentity: 'tattler:request:ownIdentity',
  pendingMessageQueue: 'tattler:request:pendingMessageQueue',
} as const;

const ChorusPiEventBusKey = {
  ready: 'chorus:ready',
  readyRequest: 'chorus:request:ready',
  roomPost: 'chorus:request:roomPost',
  roomPostReceived: 'chorus:event:roomPostReceived',
  roomDelivery: 'chorus:event:roomDelivery',
} as const;

interface EventRequestOptions {
  readonly timeoutMs?: number;
}

interface EventRequest<TResponse> {
  readonly reply: EventReply<TResponse>;
  readonly reject: EventReject;
}

interface ChorusRoomPostEventRequest extends ChorusRoomPostRequest, EventRequest<ChorusRoomPostResponse> {}

export type TattlerPendingMessageQueueResponse =
  | ({ readonly queued: true } & TattlerPendingEnqueueResult)
  | { readonly queued: false };

interface TattlerPendingMessageQueueEventRequest extends EventRequest<TattlerPendingMessageQueueResponse> {
  readonly message: TattlerPendingMessage;
}

export interface ChorusReadyEvent {
  /** Monotonic generation for this extension-runtime registration. */
  readonly generation: number;
}

export interface ChorusRoomPostRequest {
  /** Local-user post request. The broker supplies sender identity before emitting wire frames. */
  readonly roomId: ChorusRoomId;
  readonly message: string;
}

export interface ChorusRoomPostResponse {
  readonly postId: TattlerMessageId;
}

export type ChorusRoomPostReceivedHandler = (post: ChorusRoomPostV0) => void;
export type ChorusRoomDeliveryHandler = (delivery: ChorusRoomDeliveryV0) => void;

function request<T>(eventKey: string, pi: HasPiEventBus, options: EventRequestOptions = {}): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_EVENT_REQUEST_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error(`Timed out waiting for event response on ${eventKey}`));
    }, timeoutMs);

    const finish = (complete: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      complete();
    };

    pi.events.emit(eventKey, {
      reply: (response: T) => finish(() => resolve(response)),
      reject: (error: Error) => finish(() => reject(error)),
    } satisfies EventRequest<T>);
  });
}

function isEventRequest<T>(data: unknown): data is EventRequest<T> {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const requestBody = data as Partial<EventRequest<T>>;
  return typeof requestBody.reply === 'function' && typeof requestBody.reject === 'function';
}

function respond<T>(data: unknown, handler: () => Awaitable<T>): void {
  if (!isEventRequest<T>(data)) {
    return;
  }

  void Promise.resolve()
    .then(handler)
    .then(data.reply, (err: unknown) => {
      data.reject(err instanceof Error ? err : new Error(String(err)));
    });
}

export async function requestListPeers(pi: HasPiEventBus, options?: EventRequestOptions): Promise<TattlerIdentityV0[]> {
  return request<TattlerIdentityV0[]>(TattlerPiEventBusKey.listPeers, pi, options);
}

export function onListPeersRequest(pi: HasPiEventBus, handler: () => Awaitable<TattlerIdentityV0[]>): () => void {
  return pi.events.on(TattlerPiEventBusKey.listPeers, (data) => {
    respond(data, handler);
  });
}

export async function requestOwnIdentity(pi: HasPiEventBus, options?: EventRequestOptions): Promise<TattlerIdentityV0> {
  return request<TattlerIdentityV0>(TattlerPiEventBusKey.ownIdentity, pi, options);
}

export function onOwnIdentityRequest(pi: HasPiEventBus, handler: () => Awaitable<TattlerIdentityV0>): () => void {
  return pi.events.on(TattlerPiEventBusKey.ownIdentity, (data) => {
    respond(data, handler);
  });
}

export async function requestTattlerPendingMessageQueue(
  pi: HasPiEventBus,
  message: TattlerPendingMessage,
  options?: EventRequestOptions,
): Promise<TattlerPendingMessageQueueResponse> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_EVENT_REQUEST_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error(`Timed out waiting for event response on ${TattlerPiEventBusKey.pendingMessageQueue}`));
    }, timeoutMs);

    const finish = (complete: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      complete();
    };

    pi.events.emit(TattlerPiEventBusKey.pendingMessageQueue, {
      message,
      reply: (response: TattlerPendingMessageQueueResponse) => finish(() => resolve(response)),
      reject: (error: Error) => finish(() => reject(error)),
    } satisfies TattlerPendingMessageQueueEventRequest);
  });
}

export function onTattlerPendingMessageQueueRequest(
  pi: HasPiEventBus,
  handler: (message: TattlerPendingMessage) => Awaitable<TattlerPendingMessageQueueResponse>,
): () => void {
  return pi.events.on(TattlerPiEventBusKey.pendingMessageQueue, (data) => {
    if (!isEventRequest<TattlerPendingMessageQueueResponse>(data)) {
      return;
    }

    const { message, reply, reject } = data as TattlerPendingMessageQueueEventRequest;
    void Promise.resolve()
      .then(() => handler(message))
      .then(reply, (err: unknown) => {
        reject(err instanceof Error ? err : new Error(String(err)));
      });
  });
}

export function announceChorusReady(pi: HasPiEventBus, event: ChorusReadyEvent): void {
  pi.events.emit(ChorusPiEventBusKey.ready, event);
}

export function onChorusReady(pi: HasPiEventBus, handler: (event: ChorusReadyEvent) => void): () => void {
  return pi.events.on(ChorusPiEventBusKey.ready, (event) => {
    handler(event as ChorusReadyEvent);
  });
}

export async function requestChorusReady(pi: HasPiEventBus, options?: EventRequestOptions): Promise<ChorusReadyEvent> {
  return request<ChorusReadyEvent>(ChorusPiEventBusKey.readyRequest, pi, options);
}

export function onChorusReadyRequest(pi: HasPiEventBus, handler: () => Awaitable<ChorusReadyEvent>): () => void {
  return pi.events.on(ChorusPiEventBusKey.readyRequest, (data) => {
    respond(data, handler);
  });
}

export async function requestChorusRoomPost(
  pi: HasPiEventBus,
  requestBody: ChorusRoomPostRequest,
  options?: EventRequestOptions,
): Promise<ChorusRoomPostResponse> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_EVENT_REQUEST_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error(`Timed out waiting for event response on ${ChorusPiEventBusKey.roomPost}`));
    }, timeoutMs);

    const finish = (complete: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      complete();
    };

    pi.events.emit(ChorusPiEventBusKey.roomPost, {
      ...requestBody,
      reply: (response: ChorusRoomPostResponse) => finish(() => resolve(response)),
      reject: (error: Error) => finish(() => reject(error)),
    } satisfies ChorusRoomPostEventRequest);
  });
}

export function onChorusRoomPostRequest(
  pi: HasPiEventBus,
  handler: (request: ChorusRoomPostRequest) => Awaitable<ChorusRoomPostResponse>,
): () => void {
  return pi.events.on(ChorusPiEventBusKey.roomPost, (data) => {
    if (!isEventRequest<ChorusRoomPostResponse>(data)) {
      return;
    }

    const { reply, reject, ...requestBody } = data as ChorusRoomPostEventRequest;
    void Promise.resolve()
      .then(() => handler(requestBody))
      .then(reply, (err: unknown) => {
        reject(err instanceof Error ? err : new Error(String(err)));
      });
  });
}

export function emitChorusRoomPostReceived(pi: HasPiEventBus, post: ChorusRoomPostV0): void {
  pi.events.emit(ChorusPiEventBusKey.roomPostReceived, post);
}

export function onChorusRoomPostReceived(pi: HasPiEventBus, handler: ChorusRoomPostReceivedHandler): () => void {
  return pi.events.on(ChorusPiEventBusKey.roomPostReceived, (post) => {
    handler(post as ChorusRoomPostV0);
  });
}

export function emitChorusRoomDelivery(pi: HasPiEventBus, delivery: ChorusRoomDeliveryV0): void {
  pi.events.emit(ChorusPiEventBusKey.roomDelivery, delivery);
}

export function onChorusRoomDelivery(pi: HasPiEventBus, handler: ChorusRoomDeliveryHandler): () => void {
  return pi.events.on(ChorusPiEventBusKey.roomDelivery, (delivery) => {
    handler(delivery as ChorusRoomDeliveryV0);
  });
}

export function roomPostToDelivery(post: ChorusRoomPostV0): ChorusRoomDeliveryV0 {
  return createChorusRoomDelivery(post);
}
