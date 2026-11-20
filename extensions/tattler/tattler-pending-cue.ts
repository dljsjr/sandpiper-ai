import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import {
  SystemNotificationDelivery,
  type SystemNotificationSender,
  SystemNotificationSourceType,
  sendSystemNotification,
} from '../../packages/core/src/system-notification.js';

export interface TattlerPendingInboxNotifier {
  notify(): void;
  reset(): void;
}

export function trackAgentRun(pi: Pick<ExtensionAPI, 'on'>): () => boolean {
  let active = false;
  pi.on('agent_start', () => {
    active = true;
  });
  pi.on('agent_settled', () => {
    active = false;
  });
  return () => active;
}

export function createTattlerPendingInboxNotifier(
  sender: SystemNotificationSender,
  pendingMessageCount: () => number,
  isAgentRunActive: () => boolean,
): TattlerPendingInboxNotifier {
  let notified = false;

  return {
    notify(): void {
      if (notified) {
        return;
      }

      notified = true;
      sendSystemNotification(sender, {
        sourceType: SystemNotificationSourceType.PeerMessage,
        sourceId: 'tattler-pending-inbox',
        deliverAs: SystemNotificationDelivery.Steer,
        // Pi steers a custom message into a running loop only with triggerTurn; without it the
        // message waits until the run ends (Pi 0.84.2+). Outside a run (for example during a manual
        // compaction) triggerTurn would start a new run instead, so only set it while one is active.
        triggerTurn: isAgentRunActive(),
        instructions:
          'Pending Tattler/Chorus messages arrived while you were busy. If these messages may affect your current work, call the tattler_receive tool by itself to end this turn and receive them as a batch. Otherwise they are delivered when this run ends.',
        data: {
          pendingMessageCount: pendingMessageCount(),
        },
      });
    },
    reset(): void {
      notified = false;
    },
  };
}
