import { errorMessage } from 'sandpiper-ai-core';
import {
  buildMessage,
  type ChorusReplyRouteV0,
  type ChorusRoomDeliveryV0,
  type ChorusRoomId,
  type ChorusRoomPostV0,
  createChorusRoomPost,
  MAX_MESSAGE_BYTES,
  type SendAgentMessageResult,
  type TattlerIdentityV0,
  type TattlerMessageId,
  type TattlerSendableFrame,
} from '../tattler/tattler-protocol';

export interface ChorusRoomPostResult {
  readonly postId: TattlerMessageId;
}

export type ChorusEntryStatus = 'pending' | 'acked' | 'partial' | 'failed' | 'received';

export interface ChorusTranscriptEntry {
  readonly id: TattlerMessageId;
  readonly roomId: ChorusRoomId;
  readonly from: string;
  readonly message: string;
  readonly self: boolean;
  readonly postId?: TattlerMessageId;
  readonly broker?: ChorusReplyRouteV0;
  status: ChorusEntryStatus;
  readonly peerStatuses: Map<string, ChorusEntryStatus>;
}

export interface ChorusRoomBrokerOptions {
  readonly roomId: ChorusRoomId;
  readonly ownIdentity: TattlerIdentityV0;
  readonly localAuthorName?: string;
  readonly brokerRoute: ChorusReplyRouteV0;
  readonly peers: readonly TattlerIdentityV0[];
  readonly sendFrame: (peer: TattlerIdentityV0, frame: TattlerSendableFrame) => Promise<SendAgentMessageResult>;
  readonly onUpdate?: () => void;
  readonly onLocalParticipantMessage?: (post: ChorusRoomPostV0) => void;
}

export interface ChorusIncomingMessageDetails {
  readonly roomId: ChorusRoomId;
  readonly from: string;
  readonly message: string;
  readonly postId: TattlerMessageId;
  readonly broker: ChorusReplyRouteV0;
  readonly self?: boolean;
  readonly status?: 'sent' | 'acked';
}

export interface ChorusReplyOptions {
  readonly activeBroker?: ChorusRoomBroker;
  readonly roomId: ChorusRoomId;
  readonly from: string;
  readonly postId: TattlerMessageId | string;
  readonly broker: ChorusReplyRouteV0;
  readonly message: string;
  readonly sendFrame: (peer: TattlerIdentityV0, frame: TattlerSendableFrame) => Promise<SendAgentMessageResult>;
}

export type ChorusReplyResult =
  | { readonly kind: 'local-post'; readonly postId: TattlerMessageId }
  | { readonly kind: 'remote-delivery'; readonly messageIdAck: TattlerMessageId };

export function createChorusRoomDeliveryFrame(
  room: ChorusRoomId,
  from: string,
  postId: TattlerMessageId | string,
  message: string,
): ChorusRoomDeliveryV0 {
  assertMessageSize(message);
  return buildMessage('chorus.room-delivery.v0', {
    roomId: room,
    from,
    message,
    postId: postId as TattlerMessageId,
  });
}

export class ChorusRoomBroker {
  readonly roomId: ChorusRoomId;
  readonly ownIdentity: TattlerIdentityV0;
  readonly localAuthorName: string;
  readonly brokerRoute: ChorusReplyRouteV0;
  readonly peers: readonly TattlerIdentityV0[];
  readonly entries: ChorusTranscriptEntry[] = [];
  private readonly sendFrame: ChorusRoomBrokerOptions['sendFrame'];
  private readonly onUpdate?: () => void;
  private readonly onLocalParticipantMessage?: (post: ChorusRoomPostV0) => void;
  private pendingFanout = Promise.resolve();

  constructor(options: ChorusRoomBrokerOptions) {
    this.roomId = options.roomId;
    this.ownIdentity = options.ownIdentity;
    this.localAuthorName = options.localAuthorName ?? options.ownIdentity.name;
    this.brokerRoute = options.brokerRoute;
    this.peers = options.peers;
    this.sendFrame = options.sendFrame;
    this.onUpdate = options.onUpdate;
    this.onLocalParticipantMessage = options.onLocalParticipantMessage;
  }

  postLocalMessage(message: string): ChorusRoomPostResult {
    const { post, result } = this.postRoomMessage(this.localAuthorName, message, this.peers, true);
    this.onLocalParticipantMessage?.(post);
    return result;
  }

  postAuthoredMessage(from: string, message: string): ChorusRoomPostResult {
    return this.postRoomMessage(from, message, this.peers, this.isLocalAuthor(from)).result;
  }

  recordRoomPost(post: ReturnType<typeof createChorusRoomPost>): boolean {
    if (post.roomId !== this.roomId) {
      return false;
    }

    this.entries.push({
      id: post.id,
      roomId: post.roomId,
      from: post.from,
      message: post.message,
      broker: post.broker,
      self: this.isLocalAuthor(post.from),
      status: 'received',
      peerStatuses: new Map(),
    });
    this.notifyUpdated();
    return true;
  }

  acceptDelivery(delivery: ChorusRoomDeliveryV0): ChorusRoomPostResult | undefined {
    if (delivery.roomId !== this.roomId) {
      return;
    }

    const recipients = this.peers.filter((peer) => peer.name !== delivery.from);
    return this.postRoomMessage(
      delivery.from,
      delivery.message,
      recipients,
      this.isLocalAuthor(delivery.from),
      delivery.postId,
    ).result;
  }

  isLocalAuthor(from: string): boolean {
    return from === this.localAuthorName || from === this.ownIdentity.name;
  }

  async waitForIdle(): Promise<void> {
    await this.pendingFanout;
  }

  private postRoomMessage(
    from: string,
    message: string,
    recipients: readonly TattlerIdentityV0[],
    self: boolean,
    postId?: TattlerMessageId,
  ): { readonly result: ChorusRoomPostResult; readonly post: ChorusRoomPostV0 } {
    assertMessageSize(message);
    const post = createChorusRoomPost(this.roomId, from, this.brokerRoute, message);
    const entry: ChorusTranscriptEntry = {
      id: post.id,
      roomId: post.roomId,
      from: post.from,
      message: post.message,
      postId,
      broker: post.broker,
      self,
      status: recipients.length === 0 ? 'acked' : 'pending',
      peerStatuses: new Map(recipients.map((peer) => [peer.name, 'pending'])),
    };
    this.entries.push(entry);
    this.notifyUpdated();
    this.pendingFanout = this.pendingFanout.then(() => this.fanOut(post, entry, recipients));

    return { result: { postId: post.id }, post };
  }

  private async fanOut(
    frame: TattlerSendableFrame,
    entry: ChorusTranscriptEntry,
    recipients: readonly TattlerIdentityV0[],
  ): Promise<void> {
    const results = await Promise.allSettled(
      recipients.map(async (peer) => {
        await this.sendFrame(peer, frame);
        entry.peerStatuses.set(peer.name, 'acked');
      }),
    );

    for (const [index, result] of results.entries()) {
      const peer = recipients[index];
      if (peer && result.status === 'rejected') {
        entry.peerStatuses.set(peer.name, 'failed');
        console.warn(
          `Chorus failed to fan out room message ${entry.id} to ${peer.name}: ${errorMessage(result.reason)}`,
        );
      }
    }

    const statuses = [...entry.peerStatuses.values()];
    entry.status = statuses.every((status) => status === 'acked')
      ? 'acked'
      : statuses.some((status) => status === 'acked')
        ? 'partial'
        : 'failed';
    this.notifyUpdated();
  }

  private notifyUpdated(): void {
    this.onUpdate?.();
  }
}

export function createChorusRoomBroker(options: ChorusRoomBrokerOptions): ChorusRoomBroker {
  return new ChorusRoomBroker(options);
}

export async function sendChorusReply(options: ChorusReplyOptions): Promise<ChorusReplyResult> {
  if (isLocalBrokerReply(options)) {
    return { kind: 'local-post', ...options.activeBroker.postAuthoredMessage(options.from, options.message) };
  }

  const delivery = createChorusRoomDeliveryFrame(options.roomId, options.from, options.postId, options.message);
  const sendResult = await options.sendFrame(brokerRouteToPeer(options.broker), delivery);
  return { kind: 'remote-delivery', messageIdAck: sendResult.messageIdAck };
}

function isLocalBrokerReply(options: ChorusReplyOptions): options is ChorusReplyOptions & {
  readonly activeBroker: ChorusRoomBroker;
} {
  return (
    options.activeBroker !== undefined &&
    options.roomId === options.activeBroker.roomId &&
    options.broker.socketPath === options.activeBroker.brokerRoute.socketPath
  );
}

export function brokerRouteToPeer(route: ChorusReplyRouteV0): TattlerIdentityV0 {
  return buildMessage('tattler.identity.v0', {
    name: route.name,
    shortId: route.shortId,
    socketPath: route.socketPath,
  });
}

export function isChorusBrokerAuthor(from: string, broker: ChorusReplyRouteV0): boolean {
  return from === broker.name || from === broker.shortId;
}

export function assertMessageSize(message: string): void {
  const messageLength = Buffer.byteLength(message, 'utf8');
  if (messageLength > MAX_MESSAGE_BYTES) {
    throw new Error(`Chorus message length ${messageLength} > ${MAX_MESSAGE_BYTES}`);
  }
}
