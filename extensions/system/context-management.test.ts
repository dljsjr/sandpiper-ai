import type { ContextUsage, ExtensionAPI, ExtensionContext, SessionEntry } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';
import { createContextManagementExtension } from './neutral-capability-extension.js';

type Handler = (event: unknown, ctx: ExtensionContext) => unknown;

interface ModelLike {
  readonly provider: string;
  readonly id: string;
  readonly name: string;
}

const WINDOW = 1_000_000;

function usageAt(percent: number | null): ContextUsage {
  return { tokens: percent === null ? null : (percent * WINDOW) / 100, contextWindow: WINDOW, percent };
}

function createStub(branch: readonly SessionEntry[] = [], model?: ModelLike) {
  const handlers = new Map<string, Handler>();
  const pi = {
    on: ((event: string, handler: Handler) => {
      handlers.set(event, handler);
    }) as ExtensionAPI['on'],
  };
  createContextManagementExtension()(pi as ExtensionAPI);
  let usage: ContextUsage | undefined;
  const ctx = {
    model,
    getContextUsage: () => usage,
    sessionManager: { getBranch: () => branch },
  } as unknown as ExtensionContext;

  return {
    turnEnd(percent: number | null, outcome: 'completed' | 'aborted' | 'error' = 'completed') {
      usage = usageAt(percent);
      return handlers.get('turn_end')?.({ type: 'turn_end', entries: [], continue: false, outcome }, ctx);
    },
    startRun() {
      return handlers.get('before_agent_start')?.(
        { type: 'before_agent_start', messageType: 'user', prompt: 'hi' },
        ctx,
      );
    },
  };
}

function usageReport(percentUsed: number): SessionEntry {
  return {
    type: 'custom_message',
    id: `usage-${percentUsed}`,
    parentId: null,
    timestamp: '2026-11-19T00:00:00.000Z',
    customType: 'sandpiper:context-usage',
    content: '',
    display: false,
    details: { version: 1, percentUsed, tokensUsed: (percentUsed * WINDOW) / 100, contextWindow: WINDOW },
  } as SessionEntry;
}

function modelReport(model: ModelLike): SessionEntry {
  return {
    type: 'custom_message',
    id: `model-${model.id}`,
    parentId: null,
    timestamp: '2026-11-19T00:00:00.000Z',
    customType: 'sandpiper:model',
    content: '',
    display: false,
    details: { version: 1, ...model },
  } as SessionEntry;
}

const compaction = { type: 'compaction', id: 'compaction', parentId: null, timestamp: '' } as SessionEntry;

describe('context usage reports', () => {
  it('appends a bare element with the tokens left at the end of the turn that crosses a 10% step', () => {
    expect(createStub().turnEnd(51.4)).toEqual({
      entries: [
        {
          type: 'custom_message',
          customType: 'sandpiper:context-usage',
          content: '<contextUsage percentUsed="51" tokensLeft="486k" contextWindow="1M"/>',
          display: false,
          details: { version: 1, percentUsed: 51, tokensUsed: 514_000, contextWindow: WINDOW },
        },
      ],
    });
  });

  it('reports each 10% step once, reading the last report from the session branch', () => {
    const stub = createStub([usageReport(51)]);

    expect(stub.turnEnd(58)).toBeUndefined();
    expect(stub.turnEnd(61)).toMatchObject({ entries: [{ details: { percentUsed: 61 } }] });
  });

  it('adds the save-your-work alert to the report that crosses 80%', () => {
    const result = createStub([usageReport(71)]).turnEnd(80.2) as { entries: { content: string }[] };

    expect(result.entries[0]?.content).toBe(
      '<contextUsage percentUsed="80" tokensLeft="198k" contextWindow="1M"/>\n' +
        '<sandpiper_system_notification source_type="harness" source_id="system">\n' +
        '  <instructions>Context usage is above 80%. Make sure you&apos;ve persisted anything you don&apos;t want to forget before continuing your current work.</instructions>\n' +
        '</sandpiper_system_notification>',
    );
  });

  it('does not report again or re-alert when a reading dips and rises without a compaction', () => {
    const stub = createStub([usageReport(81)]);

    expect(stub.turnEnd(45)).toBeUndefined();
    expect(stub.turnEnd(83)).toBeUndefined();
  });

  it('starts over after a compaction in the branch', () => {
    expect(createStub([usageReport(81), compaction]).turnEnd(15)).toMatchObject({
      entries: [{ details: { percentUsed: 15 } }],
    });
  });

  it('skips turns that did not complete and readings Pi cannot estimate yet', () => {
    const stub = createStub();

    expect(stub.turnEnd(55, 'aborted')).toBeUndefined();
    expect(stub.turnEnd(null)).toBeUndefined();
  });

  it('keeps entries that earlier handlers proposed', () => {
    const handlers = new Map<string, Handler>();
    createContextManagementExtension()({
      on: ((event: string, handler: Handler) => {
        handlers.set(event, handler);
      }) as ExtensionAPI['on'],
    } as ExtensionAPI);
    const earlier = { type: 'custom', customType: 'other', data: {} };
    const ctx = {
      getContextUsage: () => usageAt(12),
      sessionManager: { getBranch: () => [] },
    } as unknown as ExtensionContext;

    const result = handlers.get('turn_end')?.(
      { type: 'turn_end', entries: [earlier], continue: false, outcome: 'completed' },
      ctx,
    ) as { entries: unknown[] };

    expect(result.entries[0]).toBe(earlier);
    expect(result.entries).toHaveLength(2);
  });
});

describe('model reports', () => {
  const opus: ModelLike = { provider: 'claude-cli', id: 'claude-opus-5-5', name: 'Claude Opus 5.5 (via CC CLI)' };

  it('names the model at the start of the first run on it', () => {
    expect(createStub([], opus).startRun()).toEqual({
      message: {
        customType: 'sandpiper:model',
        content: '<model provider="claude-cli" id="claude-opus-5-5" name="Claude Opus 5.5 (via CC CLI)"/>',
        display: false,
        details: { version: 1, provider: 'claude-cli', id: 'claude-opus-5-5', name: 'Claude Opus 5.5 (via CC CLI)' },
      },
    });
  });

  it('stays quiet while the model matches the last report in the branch, even as a new object', () => {
    expect(createStub([modelReport(opus)], { ...opus }).startRun()).toBeUndefined();
  });

  it('reports a switch to another model, escaping its attributes', () => {
    const other: ModelLike = { provider: 'local', id: 'q&a', name: 'A "quoted" model' };

    expect(createStub([modelReport(opus)], other).startRun()).toMatchObject({
      message: { content: '<model provider="local" id="q&amp;a" name="A &quot;quoted&quot; model"/>' },
    });
  });

  it('names the model again after a compaction, as the summary may drop the last report', () => {
    expect(createStub([modelReport(opus), compaction], opus).startRun()).toMatchObject({
      message: { customType: 'sandpiper:model', details: { id: 'claude-opus-5-5' } },
    });
  });

  it('stays quiet without a model', () => {
    expect(createStub([]).startRun()).toBeUndefined();
  });
});
