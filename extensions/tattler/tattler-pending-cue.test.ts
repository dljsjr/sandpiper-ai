import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { describe, expect, test } from 'vitest';
import { createTattlerPendingInboxNotifier, trackAgentRun } from './tattler-pending-cue';

interface SentCue {
  readonly message: {
    readonly content: string;
    readonly details: {
      readonly data?: Record<string, unknown>;
    };
  };
  readonly options: { readonly deliverAs: string; readonly triggerTurn?: boolean };
}

function recordingSender(sent: SentCue[]) {
  return {
    sendMessage(message: SentCue['message'], options: SentCue['options']) {
      sent.push({ message, options });
    },
  };
}

describe('Tattler pending inbox cue', () => {
  test('dedupes while pending and can cue again after reset', () => {
    const sent: SentCue[] = [];
    let pendingCount = 1;
    const notifier = createTattlerPendingInboxNotifier(
      recordingSender(sent),
      () => pendingCount,
      () => true,
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

  test('steers into a running agent loop', () => {
    const sent: SentCue[] = [];
    const notifier = createTattlerPendingInboxNotifier(
      recordingSender(sent),
      () => 1,
      () => true,
    );

    notifier.notify();

    expect(sent[0]?.options).toEqual({ deliverAs: 'steer', triggerTurn: true });
  });

  test('does not start a run when the agent is busy outside a run', () => {
    const sent: SentCue[] = [];
    const notifier = createTattlerPendingInboxNotifier(
      recordingSender(sent),
      () => 1,
      () => false,
    );

    notifier.notify();

    expect(sent[0]?.options).toEqual({ deliverAs: 'steer', triggerTurn: false });
  });
});

describe('agent run tracking', () => {
  test('is active from agent_start until agent_settled', () => {
    const handlers = new Map<string, () => void>();
    const pi = {
      on: (event: string, handler: () => void) => {
        handlers.set(event, handler);
      },
    } as unknown as ExtensionAPI;
    const isActive = trackAgentRun(pi);

    expect(isActive()).toBe(false);
    handlers.get('agent_start')?.();
    expect(isActive()).toBe(true);
    handlers.get('agent_settled')?.();
    expect(isActive()).toBe(false);
  });
});
