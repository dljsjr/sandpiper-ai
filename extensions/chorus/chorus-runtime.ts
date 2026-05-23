import { errorMessage } from 'sandpiper-ai-core';
import {
  buildMessage,
  type ChorusReplyRouteV0,
  type ChorusRoomDeliveryV0,
  type ChorusRoomId,
  createChorusRoomPost,
  MAX_MESSAGE_BYTES,
  type SendAgentMessageResult,
  type TattlerIdentityV0,
  type TattlerMessageId,
  type TattlerSendableFrame,
} from '../tattler/tattler-protocol';

export const CHORUS_MESSAGE_CUSTOM_TYPE = 'chorus-room-message';

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
  readonly brokerRoute: ChorusReplyRouteV0;
  readonly peers: readonly TattlerIdentityV0[];
  readonly sendFrame: (peer: TattlerIdentityV0, frame: TattlerSendableFrame) => Promise<SendAgentMessageResult>;
  readonly onUpdate?: () => void;
}

export interface ChorusIncomingMessageDetails {
  readonly roomId: ChorusRoomId;
  readonly from: string;
  readonly message: string;
  readonly postId: TattlerMessageId;
  readonly broker: ChorusReplyRouteV0;
}

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
  readonly brokerRoute: ChorusReplyRouteV0;
  readonly peers: readonly TattlerIdentityV0[];
  readonly entries: ChorusTranscriptEntry[] = [];
  private readonly sendFrame: ChorusRoomBrokerOptions['sendFrame'];
  private readonly onUpdate?: () => void;
  private pendingFanout = Promise.resolve();

  constructor(options: ChorusRoomBrokerOptions) {
    this.roomId = options.roomId;
    this.ownIdentity = options.ownIdentity;
    this.brokerRoute = options.brokerRoute;
    this.peers = options.peers;
    this.sendFrame = options.sendFrame;
    this.onUpdate = options.onUpdate;
  }

  postLocalMessage(message: string): ChorusRoomPostResult {
    assertMessageSize(message);
    const post = createChorusRoomPost(this.roomId, this.ownIdentity.name, this.brokerRoute, message);
    const entry: ChorusTranscriptEntry = {
      id: post.id,
      roomId: post.roomId,
      from: post.from,
      message: post.message,
      self: true,
      status: this.peers.length === 0 ? 'acked' : 'pending',
      peerStatuses: new Map(this.peers.map((peer) => [peer.name, 'pending'])),
    };
    this.entries.push(entry);
    this.notifyUpdated();
    this.pendingFanout = this.pendingFanout.then(() => this.fanOut(post, entry));

    return { postId: post.id };
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
      self: post.from === this.ownIdentity.name,
      status: 'received',
      peerStatuses: new Map(),
    });
    this.notifyUpdated();
    return true;
  }

  recordDelivery(delivery: ChorusRoomDeliveryV0): boolean {
    if (delivery.roomId !== this.roomId) {
      return false;
    }

    this.entries.push({
      id: delivery.id,
      roomId: delivery.roomId,
      from: delivery.from,
      message: delivery.message,
      postId: delivery.postId,
      self: delivery.from === this.ownIdentity.name,
      status: 'received',
      peerStatuses: new Map(),
    });
    this.notifyUpdated();
    return true;
  }

  async waitForIdle(): Promise<void> {
    await this.pendingFanout;
  }

  private async fanOut(frame: TattlerSendableFrame, entry: ChorusTranscriptEntry): Promise<void> {
    const results = await Promise.allSettled(
      this.peers.map(async (peer) => {
        await this.sendFrame(peer, frame);
        entry.peerStatuses.set(peer.name, 'acked');
      }),
    );

    for (const [index, result] of results.entries()) {
      const peer = this.peers[index];
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

export function createChorusUserMessageContent(details: ChorusIncomingMessageDetails): string {
  return `<chorus_room_message roomId="${escapeXml(details.roomId)}" postId="${escapeXml(details.postId)}" from="${escapeXml(details.from)}" brokerName="${escapeXml(details.broker.name)}" brokerShortId="${escapeXml(details.broker.shortId)}" brokerSocketPath="${escapeXml(details.broker.socketPath)}">
<instructions>This is a Chorus room message from another agent. If you reply substantively, use the send_chorus_reply tool with this roomId, postId, and broker route. Do not reply with a plain Tattler DM.</instructions>
<message>${escapeXml(details.message)}</message>
</chorus_room_message>`;
}

export function assertMessageSize(message: string): void {
  const messageLength = Buffer.byteLength(message, 'utf8');
  if (messageLength > MAX_MESSAGE_BYTES) {
    throw new Error(`Chorus message length ${messageLength} > ${MAX_MESSAGE_BYTES}`);
  }
}

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
