import { describe, expect, test } from 'vitest';
import { createTattlerPendingInboxNotifier } from './tattler-pending-cue';

interface SentCue {
  readonly message: {
    readonly content: string;
    readonly details: {
      readonly data?: Record<string, unknown>;
    };
  };
  readonly options: { readonly deliverAs: string; readonly triggerTurn?: boolean };
}

describe('Tattler pending inbox cue', () => {
  test('dedupes while pending and can cue again after reset', () => {
    const sent: SentCue[] = [];
    let pendingCount = 1;
    const notifier = createTattlerPendingInboxNotifier(
      {
        sendMessage(message: SentCue['message'], options: SentCue['options']) {
          sent.push({ message, options });
        },
      },
      () => pendingCount,
    );

    notifier.notify();
    notifier.notify();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.message.content).toContain('call the tattler_receive tool');
    expect(sent[0]?.message.content).not.toContain('first payload');
    expect(sent[0]?.message.details.data).toEqual({ pendingMessageCount: 1 });

    pendingCount = 2;
    notifier.reset();
    notifier.notify();

    expect(sent).toHaveLength(2);
    expect(sent[1]?.message.details.data).toEqual({ pendingMessageCount: 2 });
  });
});
