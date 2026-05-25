import {
  SystemNotificationDelivery,
  type SystemNotificationSender,
  SystemNotificationSourceType,
  sendSystemNotification,
} from 'sandpiper-ai-core';

export interface TattlerPendingInboxNotifier {
  notify(): void;
  reset(): void;
}

export function createTattlerPendingInboxNotifier(
  sender: SystemNotificationSender,
  pendingMessageCount: () => number,
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
        triggerTurn: false,
        instructions:
          'Pending Tattler/Chorus messages arrived while you were busy. If these messages may affect your current work, call the tattler_receive tool by itself to end this turn and receive them as a batch. This cue is best-effort; the pending inbox is the source of truth.',
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
