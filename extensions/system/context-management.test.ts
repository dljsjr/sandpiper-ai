import type {
  ContextUsage,
  ExtensionAPI,
  ExtensionContext,
  SessionCompactEvent,
  SessionStartEvent,
  TurnEndEvent,
} from '@earendil-works/pi-coding-agent';
import { describe, expect, it, vi } from 'vitest';
import { createContextManagementExtension } from './neutral-capability-extension.js';

function createContextManagementStub(extension = createContextManagementExtension()) {
  type Context = Pick<ExtensionContext, 'getContextUsage' | 'model'>;
  type Handler = (...args: readonly unknown[]) => unknown;
  const handlers = new Map<string, Handler>();
  const sendMessage = vi.fn();
  let usage: ContextUsage | undefined;
  const ctx: Context = { model: undefined, getContextUsage: () => usage };
  const pi: Pick<ExtensionAPI, 'on' | 'sendMessage'> = {
    on: ((event: string, handler: Handler) => {
      handlers.set(event, handler);
      return () => {
        handlers.delete(event);
      };
    }) as ExtensionAPI['on'],
    sendMessage,
  };
  extension(pi as ExtensionAPI);

  async function emit(event: TurnEndEvent | SessionCompactEvent | SessionStartEvent) {
    if (event.type === 'session_compact') {
      // Pi cannot estimate post-compaction usage until the next assistant response.
      usage = { tokens: null, contextWindow: 1000, percent: null };
    }
    await handlers.get(event.type)?.(event, ctx);
  }

  async function turn(percent: number) {
    usage = { tokens: percent * 10, contextWindow: 1000, percent };
    const message: TurnEndEvent['message'] = {
      role: 'assistant',
      content: [{ type: 'text', text: 'Done.' }],
      api: 'anthropic-messages',
      provider: 'anthropic',
      model: 'test-model',
      usage: {
        input: percent * 10,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: percent * 10,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: 'stop',
      timestamp: 0,
    };
    await emit({
      type: 'turn_end',
      turnIndex: 0,
      message,
      toolResults: [],
      messageEntryId: 'assistant-entry',
      toolResultEntryIds: [],
      entries: [],
      continue: false,
      outcome: 'completed',
      context: {
        contextEntries: [],
        contextMessages: [message],
        llmMessages: [message],
        pendingMessages: [],
        canContinue: true,
      },
    });
  }

  return { emit, turn, sendMessage };
}

describe('context management notifications', () => {
  it('sends the 50% warning as plain hidden instructions through the real formatter', async () => {
    const { turn, sendMessage } = createContextManagementStub();

    await turn(51);

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        display: false,
        content: expect.stringContaining('<instructions>Context usage is above 50%.</instructions>'),
      }),
      { deliverAs: 'nextTurn', triggerTurn: false },
    );
    expect(sendMessage.mock.calls[0]?.[0].content).not.toContain('&lt;');
  });

  it('sends the 80% alert without nested markup while preserving formatter escaping', async () => {
    const { turn, sendMessage } = createContextManagementStub();

    await turn(81);

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        display: false,
        content: expect.stringContaining(
          '<instructions>Context usage is above 80%. Make sure you&apos;ve persisted anything you don&apos;t want to forget before continuing your current work.</instructions>',
        ),
      }),
      { deliverAs: 'nextTurn', triggerTurn: false },
    );
    expect(sendMessage.mock.calls[0]?.[0].content).not.toContain('&lt;');
  });

  it.each(['manual', 'threshold', 'overflow'] as const)(
    'resumes usage notifications in 10-percent steps after %s compaction below the old peak',
    async (reason) => {
      const { emit, turn, sendMessage } = createContextManagementStub();
      await turn(81);
      sendMessage.mockClear();

      await emit({
        type: 'session_compact',
        reason,
        willRetry: reason === 'overflow',
        fromExtension: false,
        compactionEntry: {
          type: 'compaction',
          id: 'compaction-entry',
          parentId: 'assistant-entry',
          timestamp: '2026-11-11T00:00:00.000Z',
          summary: 'Earlier work summarized.',
          firstKeptEntryId: 'kept-entry',
          tokensBefore: 810,
        },
      });
      expect(sendMessage).not.toHaveBeenCalled();

      await turn(15);
      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(sendMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          details: {
            sourceType: 'harness',
            sourceId: 'system',
            data: { contextUsage: { contextWindow: 1000, percentUsed: 15, tokensUsed: 150 } },
          },
        }),
        { deliverAs: 'nextTurn', triggerTurn: false },
      );

      await turn(16);
      expect(sendMessage).toHaveBeenCalledTimes(1);
      await turn(21);
      expect(sendMessage).toHaveBeenCalledTimes(2);
    },
  );

  it.each(['new', 'resume', 'fork', 'reload'] as const)(
    'starts with fresh thresholds when Pi reinstantiates the extension for %s',
    async (reason) => {
      const extension = createContextManagementExtension();
      const previous = createContextManagementStub(extension);
      await previous.emit({ type: 'session_start', reason: 'startup' });
      await previous.turn(81);

      // Pi reloads/rebinds inline factories before session_start, even when reusing the factory function.
      const replacement = createContextManagementStub(extension);
      await replacement.emit({
        type: 'session_start',
        reason,
        ...(reason === 'reload' ? {} : { previousSessionFile: '/fixtures/previous-session.jsonl' }),
      });
      await replacement.turn(15);

      expect(replacement.sendMessage).toHaveBeenCalledTimes(1);
      expect(replacement.sendMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('<contextUsage contextWindow="1000" percentUsed="15" tokensUsed="150"/>'),
        }),
        { deliverAs: 'nextTurn', triggerTurn: false },
      );
      await replacement.turn(51);
      expect(replacement.sendMessage.mock.lastCall?.[0].content).toContain(
        '<instructions>Context usage is above 50%.</instructions>',
      );
      await replacement.turn(81);
      expect(replacement.sendMessage.mock.lastCall?.[0].content).toContain('<instructions>Context usage is above 80%.');
    },
  );
});
