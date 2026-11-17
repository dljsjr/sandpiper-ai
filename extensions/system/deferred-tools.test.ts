import type {
  BuildSystemPromptOptions,
  ExtensionAPI,
  ExtensionContext,
  ToolInfo,
} from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { describe, expect, it, vi } from 'vitest';
import { deferredToolNames, registerDeferredToolHooks } from './deferred-tools.js';

type Handler = (event: unknown, ctx: ExtensionContext) => unknown;

function tool(name: string, overrides: Partial<ToolInfo> = {}): ToolInfo {
  return {
    name,
    description: name,
    parameters: Type.Object({}),
    exposure: 'direct',
    sourceInfo: { path: `<test:${name}>`, source: 'test', scope: 'temporary', origin: 'top-level' },
    ...overrides,
  };
}

const toolSearch = tool('tool_search', { exposure: 'model-only', reachesTools: () => 'all' });

function createDeferredToolHarness(tools: readonly ToolInfo[], initiallyActive: readonly string[] = ['read']) {
  const handlers = new Map<string, Handler[]>();
  let active = [...initiallyActive];
  const setActiveTools = vi.fn((names: string[]) => {
    active = names;
  });
  const notify = vi.fn();
  const pi = {
    on: (event: string, handler: Handler) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    },
    getAllTools: () => [...tools],
    getActiveTools: () => [...active],
    setActiveTools,
  } as unknown as ExtensionAPI;
  const ctx = { ui: { notify } } as unknown as ExtensionContext;
  registerDeferredToolHooks(pi);

  const emit = async (event: string, payload: unknown) => {
    for (const handler of handlers.get(event) ?? []) await handler(payload, ctx);
  };
  return {
    notify,
    setActiveTools,
    active: () => active,
    startSession: () => emit('session_start', { type: 'session_start', reason: 'startup' }),
    startRun: async () => {
      const systemPromptOptions: BuildSystemPromptOptions = { cwd: '/repo' };
      await emit('before_agent_start', { type: 'before_agent_start', systemPromptOptions });
      return systemPromptOptions;
    },
  };
}

describe('deferredToolNames', () => {
  it('names deferred tools outside an MCP namespace, sorted', () => {
    const names = deferredToolNames([
      tool('web_search', { exposure: 'deferred' }),
      tool('read'),
      tool('mcp__linear__issues', { exposure: 'deferred', namespace: { name: 'mcp__linear' } }),
      tool('scripted', { exposure: 'codemode' }),
      toolSearch,
      tool('list_peers', { exposure: 'deferred' }),
    ]);

    expect(names).toEqual(['list_peers', 'web_search']);
  });
});

describe('registerDeferredToolHooks', () => {
  it('sets the deferred tool names on every run', async () => {
    const harness = createDeferredToolHarness([
      tool('web_fetch', { exposure: 'deferred' }),
      tool('mcp__linear__issues', { exposure: 'deferred', namespace: { name: 'mcp__linear' } }),
      tool('read'),
      toolSearch,
      tool('list_peers', { exposure: 'deferred' }),
    ]);

    expect((await harness.startRun()).deferredTools).toEqual(['list_peers', 'web_fetch']);
    expect((await harness.startRun()).deferredTools).toEqual(['list_peers', 'web_fetch']);
  });

  it('activates tool_search at session start and before a run when a deferred tool is registered', async () => {
    const atStart = createDeferredToolHarness([tool('read'), toolSearch, tool('web_fetch', { exposure: 'deferred' })]);
    const beforeRun = createDeferredToolHarness([
      tool('read'),
      toolSearch,
      tool('web_fetch', { exposure: 'deferred' }),
    ]);

    await atStart.startSession();
    await beforeRun.startRun();

    expect(atStart.active()).toEqual(['read', 'tool_search']);
    expect(beforeRun.active()).toEqual(['read', 'tool_search']);
  });

  it('activates tool_search only once', async () => {
    const harness = createDeferredToolHarness([tool('read'), toolSearch, tool('web_fetch', { exposure: 'deferred' })]);

    await harness.startSession();
    await harness.startRun();
    await harness.startRun();

    expect(harness.setActiveTools).toHaveBeenCalledTimes(1);
  });

  it('leaves tool_search inactive when only MCP or non-deferred tools are registered', async () => {
    const harness = createDeferredToolHarness([
      tool('read'),
      toolSearch,
      tool('mcp__linear__issues', { exposure: 'deferred', namespace: { name: 'mcp__linear' } }),
    ]);

    await harness.startSession();
    await harness.startRun();

    expect(harness.setActiveTools).not.toHaveBeenCalled();
    expect(harness.notify).not.toHaveBeenCalled();
  });

  it('does not activate a tool_search that cannot reach tools', async () => {
    const harness = createDeferredToolHarness([
      tool('read'),
      tool('tool_search', { exposure: 'model-only' }),
      tool('web_fetch', { exposure: 'deferred' }),
    ]);

    await harness.startSession();

    expect(harness.setActiveTools).not.toHaveBeenCalled();
  });

  it('warns once per session when deferred tools cannot be loaded', async () => {
    const harness = createDeferredToolHarness([tool('read'), tool('web_fetch', { exposure: 'deferred' })]);

    await harness.startSession();
    await harness.startRun();
    await harness.startRun();

    expect(harness.notify).toHaveBeenCalledTimes(1);
    expect(harness.notify).toHaveBeenCalledWith(
      'Deferred tools (web_fetch) are only reachable from the tool_search tool, but it is not available; they cannot be called.',
      'warning',
    );

    await harness.startSession();

    expect(harness.notify).toHaveBeenCalledTimes(2);
  });

  it('does not warn when every deferred tool is already active', async () => {
    const harness = createDeferredToolHarness([tool('web_search', { exposure: 'deferred' })], ['web_search']);

    await harness.startSession();
    await harness.startRun();

    expect(harness.notify).not.toHaveBeenCalled();
  });
});
