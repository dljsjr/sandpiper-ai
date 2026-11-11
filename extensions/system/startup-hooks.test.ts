import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerBackgroundProcessLifecycleHooks } from './background-process-hooks.js';
import { SANDPIPER_PROMPT_CONTRIBUTION_CHANNEL } from './prompt-contributions.js';
import { registerSessionContinuityHooks, registerStartupPromptHooks } from './startup-hooks.js';
import { createBackgroundLifecycleProcessManagerStub, createEventStub } from './test-helpers.js';

const mockBuildSandpiperStartupPrompt = vi.hoisted(() => vi.fn());
const mockGetAgentDir = vi.hoisted(() => vi.fn(() => '/agent'));

type TestEventHandler = (...args: readonly unknown[]) => unknown;
type TestBusHandler = (payload: unknown) => unknown;
type TestCommand = {
  readonly handler: (args: string, ctx: unknown) => unknown;
};

function createStartupPromptHookStub(
  flags: Record<string, boolean | string | undefined> = {},
  initialEntries: readonly unknown[] = [],
) {
  const handlers = new Map<string, TestEventHandler>();
  const commands = new Map<string, TestCommand>();
  const busHandlers = new Map<string, Set<TestBusHandler>>();
  const appendedEntries: Array<{ readonly customType: string; readonly data: unknown }> = [];
  const sessionEntries: unknown[] = [...initialEntries];
  const events = {
    emit: vi.fn((channel: string, payload: unknown) => {
      for (const handler of busHandlers.get(channel) ?? []) {
        handler(payload);
      }
    }),
    on: vi.fn((channel: string, handler: TestBusHandler) => {
      const handlersForChannel = busHandlers.get(channel) ?? new Set<TestBusHandler>();
      handlersForChannel.add(handler);
      busHandlers.set(channel, handlersForChannel);
      return () => {
        handlersForChannel.delete(handler);
      };
    }),
  };

  const pi = {
    getFlag: ((name: string) => flags[name]) as Parameters<typeof registerStartupPromptHooks>[0]['getFlag'],
    on: ((event: string, handler: TestEventHandler) => {
      handlers.set(event, handler);
    }) as Parameters<typeof registerStartupPromptHooks>[0]['on'],
    registerCommand: ((name: string, command: TestCommand) => {
      commands.set(name, command);
    }) as Parameters<typeof registerStartupPromptHooks>[0]['registerCommand'],
    registerFlag: vi.fn() as Parameters<typeof registerStartupPromptHooks>[0]['registerFlag'],
    appendEntry: ((customType: string, data?: unknown) => {
      appendedEntries.push({ customType, data });
      sessionEntries.push({ type: 'custom', customType, data });
    }) as Parameters<typeof registerStartupPromptHooks>[0]['appendEntry'],
    events: events as Parameters<typeof registerStartupPromptHooks>[0]['events'],
  } as Parameters<typeof registerStartupPromptHooks>[0];

  return {
    pi,
    handlers,
    commands,
    events,
    appendedEntries,
    sessionEntries,
  };
}

function beforeAgentStartEvent(systemPromptOptions: Record<string, unknown> = {}) {
  return { systemPrompt: 'base prompt', systemPromptOptions: { ...systemPromptOptions } };
}

function createPromptSessionContext(entries: readonly unknown[] = []) {
  return {
    cwd: '/repo',
    sessionManager: {
      getEntries: () => entries,
    },
  };
}

vi.mock('@earendil-works/pi-coding-agent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@earendil-works/pi-coding-agent')>();
  return {
    ...actual,
    getAgentDir: mockGetAgentDir,
  };
});

vi.mock('../../packages/core/src/startup-prompt.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../packages/core/src/startup-prompt.js')>();
  return {
    ...actual,
    buildSandpiperStartupPrompt: (...args: unknown[]) => mockBuildSandpiperStartupPrompt(...args),
  };
});

describe('startup hooks', () => {
  beforeEach(() => {
    mockGetAgentDir.mockClear();
    mockGetAgentDir.mockReturnValue('/agent');
    mockBuildSandpiperStartupPrompt.mockImplementation(async (input: { agentDir?: string; cwd: string }) => {
      return JSON.stringify({
        agentDir: input.agentDir,
        cwd: input.cwd,
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('builds startup prompt from agentDir and cwd on before_agent_start', async () => {
    const { pi, handlers, sessionEntries } = createStartupPromptHookStub();
    registerStartupPromptHooks(pi);

    const handler = handlers.get('before_agent_start');
    if (!handler) {
      throw new Error('before_agent_start handler not registered');
    }

    const event = beforeAgentStartEvent();
    const result = await handler(event, createPromptSessionContext(sessionEntries));

    expect(result).toBeUndefined();
    expect(event.systemPromptOptions.customPrompt).toContain('"agentDir":"/agent"');
    expect(event.systemPromptOptions.customPrompt).toContain('"cwd":"/repo"');
    expect(mockGetAgentDir).toHaveBeenCalled();
  });

  it('clears the inputs Sandpiper renders itself so Pi does not render them again', async () => {
    const { pi, handlers, sessionEntries } = createStartupPromptHookStub();
    registerStartupPromptHooks(pi);
    const event = beforeAgentStartEvent({
      appendSystemPrompt: 'appended',
      contextFiles: [{ path: '/repo/AGENTS.md', content: 'rules' }],
      skills: [{ name: 'jj' }],
    });

    await handlers.get('before_agent_start')?.(event, createPromptSessionContext(sessionEntries));

    expect(event.systemPromptOptions).toMatchObject({ appendSystemPrompt: '', contextFiles: [], skills: [] });
  });

  it('persists one local session start date and reuses it across later turns', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 8, 9, 10, 0, 0));
      const { pi, handlers, appendedEntries, sessionEntries } = createStartupPromptHookStub();
      registerStartupPromptHooks(pi);
      const sessionContext = createPromptSessionContext(sessionEntries);

      await handlers.get('session_start')?.({ reason: 'startup' }, sessionContext);
      const beforeAgentStart = handlers.get('before_agent_start');
      await beforeAgentStart?.({ systemPrompt: 'base prompt', systemPromptOptions: {} }, sessionContext);
      expect(appendedEntries).toEqual([
        {
          customType: 'sandpiper:session-start-date',
          data: { version: 1, date: '2026-09-09' },
        },
      ]);

      vi.setSystemTime(new Date(2026, 8, 10, 10, 0, 0));
      await beforeAgentStart?.({ systemPrompt: 'base prompt', systemPromptOptions: {} }, sessionContext);

      expect(mockBuildSandpiperStartupPrompt).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ sessionStartDate: '2026-09-09' }),
      );
      expect(mockBuildSandpiperStartupPrompt).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ sessionStartDate: '2026-09-09' }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('restores the persisted session start date after process restart', async () => {
    const { pi, handlers, appendedEntries, sessionEntries } = createStartupPromptHookStub({}, [
      {
        type: 'custom',
        customType: 'sandpiper:session-start-date',
        data: { version: 1, date: '2026-09-08' },
      },
    ]);
    registerStartupPromptHooks(pi);
    const sessionContext = createPromptSessionContext(sessionEntries);

    await handlers.get('session_start')?.({ reason: 'resume' }, sessionContext);
    await handlers.get('before_agent_start')?.(
      { systemPrompt: 'base prompt', systemPromptOptions: {} },
      sessionContext,
    );

    expect(appendedEntries).toEqual([]);
    expect(mockBuildSandpiperStartupPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ sessionStartDate: '2026-09-08' }),
    );
  });

  // Guardrail: the prompt-contribution channel is a PUBLIC extension API (external consumers like
  // pi-yaams's memory bootstrap inject through it). These tests fail loudly if the channel wiring is
  // removed again — the exact regression eff4bda53 introduced when the collector was swept up as
  // "dead code" (no *internal* emitters) and no test guarded it.
  it('appends prompt contributions registered on the contribution channel (first-turn only)', async () => {
    mockBuildSandpiperStartupPrompt.mockResolvedValueOnce('<system_prompt>sandpiper</system_prompt>');

    const { pi, handlers, events, sessionEntries } = createStartupPromptHookStub();
    registerStartupPromptHooks(pi);
    const sessionContext = createPromptSessionContext(sessionEntries);

    const onStart = handlers.get('session_start');
    const beforeAgentStart = handlers.get('before_agent_start');
    if (!onStart || !beforeAgentStart) {
      throw new Error('startup prompt lifecycle hooks not registered');
    }

    await onStart({ reason: 'startup' }, sessionContext);
    events.emit(SANDPIPER_PROMPT_CONTRIBUTION_CHANNEL, {
      id: 'yaams-memory-bootstrap',
      getContent: () => '<memory source="yaams">recent facts</memory>',
    });

    const event = beforeAgentStartEvent();
    await beforeAgentStart(event, sessionContext);

    expect(event.systemPromptOptions.customPrompt).toBe(
      '<system_prompt>sandpiper</system_prompt>\n\n<memory source="yaams">recent facts</memory>',
    );
  });

  it('renders the contributed prompt from an extension command without starting an agent turn', async () => {
    mockBuildSandpiperStartupPrompt.mockResolvedValueOnce('<system_prompt>sandpiper</system_prompt>');

    const onPrompt = vi.fn();
    const { pi, handlers, commands, events, sessionEntries } = createStartupPromptHookStub();
    registerStartupPromptHooks(pi, undefined, {
      commandName: '__sandpiper-system-prompt',
      onPrompt,
    });

    const sessionContext = createPromptSessionContext(sessionEntries);
    await handlers.get('session_start')?.({ reason: 'startup' }, sessionContext);
    events.emit(SANDPIPER_PROMPT_CONTRIBUTION_CHANNEL, {
      id: 'diagnostic-contribution',
      getContent: () => '<diagnostic>included</diagnostic>',
    });

    const command = commands.get('__sandpiper-system-prompt');
    if (!command) {
      throw new Error('system prompt diagnostic command not registered');
    }

    await command.handler('', {
      ...sessionContext,
      getSystemPrompt: () => 'base prompt',
      getSystemPromptOptions: () => ({ cwd: '/repo' }),
    });

    expect(onPrompt).toHaveBeenCalledWith(
      '<system_prompt>sandpiper</system_prompt>\n\n<diagnostic>included</diagnostic>',
      { identity: undefined },
    );
  });

  it('dedupes prompt contributions by id and preserves prepend/append phases', async () => {
    mockBuildSandpiperStartupPrompt.mockResolvedValueOnce('<system_prompt>sandpiper</system_prompt>');

    const { pi, handlers, events, sessionEntries } = createStartupPromptHookStub();
    registerStartupPromptHooks(pi);
    const sessionContext = createPromptSessionContext(sessionEntries);

    await handlers.get('session_start')?.({ reason: 'startup' }, sessionContext);
    events.emit(SANDPIPER_PROMPT_CONTRIBUTION_CHANNEL, {
      id: 'header',
      phase: 'prepend',
      getContent: () => '<header>first</header>',
    });
    events.emit(SANDPIPER_PROMPT_CONTRIBUTION_CHANNEL, {
      id: 'header',
      phase: 'prepend',
      getContent: () => '<header>duplicate</header>',
    });
    events.emit(SANDPIPER_PROMPT_CONTRIBUTION_CHANNEL, {
      id: 'footer',
      phase: 'append',
      getContent: () => '<footer>tail</footer>',
    });

    const event = beforeAgentStartEvent();
    await handlers.get('before_agent_start')?.(event, sessionContext);

    expect(event.systemPromptOptions.customPrompt).toBe(
      '<header>first</header>\n\n<system_prompt>sandpiper</system_prompt>\n\n<footer>tail</footer>',
    );
  });

  it('sets session env vars on session_start', async () => {
    vi.stubEnv('SANDPIPER_SESSION_ID', '');
    vi.stubEnv('SANDPIPER_SESSION_FILE', '');
    const { pi, handlers } = createEventStub();

    registerSessionContinuityHooks(pi as Parameters<typeof registerSessionContinuityHooks>[0]);

    const onStart = handlers.get('session_start');
    if (!onStart) {
      throw new Error('session_start handler not registered');
    }

    const getSessionFile = vi.fn(() => '/tmp/session.jsonl');
    const getSessionId = vi.fn(() => 'session-1234');
    const sessionCtx = { sessionManager: { getSessionFile, getSessionId } };

    await onStart({ reason: 'startup' }, sessionCtx);

    expect(process.env.SANDPIPER_SESSION_ID).toBe('session-1234');
    expect(process.env.SANDPIPER_SESSION_FILE).toBe('/tmp/session.jsonl');
  });

  it('kills all background processes on shutdown without registering completion context hooks', async () => {
    const { pi, handlers } = createEventStub();
    const killAll = vi.fn();
    const processManager = createBackgroundLifecycleProcessManagerStub({ killAll });

    registerBackgroundProcessLifecycleHooks(
      pi as Parameters<typeof registerBackgroundProcessLifecycleHooks>[0],
      processManager as Parameters<typeof registerBackgroundProcessLifecycleHooks>[1],
    );

    const onShutdown = handlers.get('session_shutdown');
    if (!onShutdown) {
      throw new Error('background process lifecycle hook not registered');
    }

    expect(handlers.has('context')).toBe(false);

    await onShutdown({}, {});
    expect(killAll).toHaveBeenCalled();
  });
});
