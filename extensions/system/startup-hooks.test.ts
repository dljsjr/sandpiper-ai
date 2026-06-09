import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerBackgroundProcessLifecycleHooks } from './background-process-hooks.js';
import { SANDPIPER_PROMPT_CONTRIBUTION_CHANNEL } from './prompt-contributions.js';
import { createSystemRuntimeState } from './runtime.js';
import { registerSessionContinuityHooks, registerStartupPromptHooks } from './startup-hooks.js';
import { createBackgroundLifecycleProcessManagerStub, createEventStub } from './test-helpers.js';

const mockBuildSandpiperStartupPrompt = vi.hoisted(() => vi.fn());
const mockGetAgentDir = vi.hoisted(() => vi.fn(() => '/agent'));

type TestEventHandler = (...args: readonly unknown[]) => unknown;
type TestBusHandler = (payload: unknown) => unknown;

function createStartupPromptHookStub(flags: Record<string, boolean | string | undefined> = {}) {
  const handlers = new Map<string, TestEventHandler>();
  const busHandlers = new Map<string, Set<TestBusHandler>>();
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
    registerFlag: vi.fn() as Parameters<typeof registerStartupPromptHooks>[0]['registerFlag'],
    events: events as Parameters<typeof registerStartupPromptHooks>[0]['events'],
  } as Parameters<typeof registerStartupPromptHooks>[0];

  return {
    pi,
    handlers,
    events,
  };
}

vi.mock('@earendil-works/pi-coding-agent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@earendil-works/pi-coding-agent')>();
  return {
    ...actual,
    getAgentDir: mockGetAgentDir,
  };
});

vi.mock('sandpiper-ai-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('sandpiper-ai-core')>();
  return {
    ...actual,
    buildSandpiperStartupPrompt: (...args: unknown[]) => mockBuildSandpiperStartupPrompt(...args),
  };
});

describe('startup hooks', () => {
  beforeEach(() => {
    mockGetAgentDir.mockClear();
    mockGetAgentDir.mockReturnValue('/agent');
    mockBuildSandpiperStartupPrompt.mockImplementation(
      async (
        state: { startupContextPending: boolean; coldStartGuidancePending: boolean },
        input: { agentDir?: string; cwd: string },
      ) => {
        state.startupContextPending = false;
        state.coldStartGuidancePending = false;
        return JSON.stringify({
          agentDir: input.agentDir,
          cwd: input.cwd,
          projectTriggers: '',
          activeTaskContext: '',
          workingCopyContext: '',
          coldStartGuidance: 'Cold-Start Guidance',
        });
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds startup prompt sections and clears one-shot state after before_agent_start', async () => {
    const state = createSystemRuntimeState();
    state.startupContextPending = true;
    state.coldStartGuidancePending = true;

    const { pi, handlers } = createStartupPromptHookStub();
    registerStartupPromptHooks(pi, state);

    const handler = handlers.get('before_agent_start');
    if (!handler) {
      throw new Error('before_agent_start handler not registered');
    }

    const result = (await handler(
      { systemPrompt: 'base prompt', systemPromptOptions: {} },
      {
        cwd: '/repo',
      },
    )) as { systemPrompt: string };

    expect(result.systemPrompt).toContain('"agentDir":"/agent"');
    expect(result.systemPrompt).toContain('"cwd":"/repo"');
    expect(mockGetAgentDir).toHaveBeenCalled();
    expect(result.systemPrompt).toContain('"projectTriggers":""');
    expect(result.systemPrompt).toContain('"activeTaskContext":""');
    expect(result.systemPrompt).toContain('"workingCopyContext":""');
    expect(result.systemPrompt).toContain('Cold-Start Guidance');
    expect(state.startupContextPending).toBe(false);
    expect(state.coldStartGuidancePending).toBe(false);
  });

  it('appends prompt contributions registered after session_start', async () => {
    const state = createSystemRuntimeState();
    mockBuildSandpiperStartupPrompt.mockResolvedValueOnce('<system_prompt>sandpiper</system_prompt>');

    const { pi, handlers, events } = createStartupPromptHookStub();
    registerStartupPromptHooks(pi, state);

    const onStart = handlers.get('session_start');
    const beforeAgentStart = handlers.get('before_agent_start');
    if (!onStart || !beforeAgentStart) {
      throw new Error('startup prompt lifecycle hooks not registered');
    }

    await onStart({ reason: 'startup' }, { cwd: '/repo' });
    events.emit(SANDPIPER_PROMPT_CONTRIBUTION_CHANNEL, {
      id: 'yaams-memory-bootstrap',
      getContent: () => '<memory source="yaams">recent facts</memory>',
    });

    const result = (await beforeAgentStart(
      { systemPrompt: 'base prompt', systemPromptOptions: {} },
      {
        cwd: '/repo',
      },
    )) as { systemPrompt: string };

    expect(result.systemPrompt).toBe(
      '<system_prompt>sandpiper</system_prompt>\n\n<memory source="yaams">recent facts</memory>',
    );
  });

  it('dedupes prompt contributions by id and preserves prepend/append phases', async () => {
    const state = createSystemRuntimeState();
    mockBuildSandpiperStartupPrompt.mockResolvedValueOnce('<system_prompt>sandpiper</system_prompt>');

    const { pi, handlers, events } = createStartupPromptHookStub();
    registerStartupPromptHooks(pi, state);

    await handlers.get('session_start')?.({ reason: 'startup' }, { cwd: '/repo' });
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

    const result = (await handlers.get('before_agent_start')?.(
      { systemPrompt: 'base prompt', systemPromptOptions: {} },
      {
        cwd: '/repo',
      },
    )) as { systemPrompt: string };

    expect(result.systemPrompt).toBe(
      '<header>first</header>\n\n<system_prompt>sandpiper</system_prompt>\n\n<footer>tail</footer>',
    );
  });

  it('acknowledges prompt contributions when the collector accepts them', async () => {
    const state = createSystemRuntimeState();
    const acknowledge = vi.fn();
    const duplicateAcknowledge = vi.fn();

    const { pi, handlers, events } = createStartupPromptHookStub();
    registerStartupPromptHooks(pi, state);

    await handlers.get('session_start')?.({ reason: 'startup' }, { cwd: '/repo' });
    events.emit(SANDPIPER_PROMPT_CONTRIBUTION_CHANNEL, {
      id: 'yaams-memory-bootstrap',
      acknowledge,
      getContent: () => '<memory>stable</memory>',
    });
    events.emit(SANDPIPER_PROMPT_CONTRIBUTION_CHANNEL, {
      id: 'yaams-memory-bootstrap',
      acknowledge: duplicateAcknowledge,
      getContent: () => '<memory>duplicate</memory>',
    });

    expect(acknowledge).toHaveBeenCalledTimes(1);
    expect(duplicateAcknowledge).not.toHaveBeenCalled();
  });

  it('freezes prompt contribution content after first before_agent_start', async () => {
    const state = createSystemRuntimeState();
    mockBuildSandpiperStartupPrompt.mockResolvedValue('<system_prompt>sandpiper</system_prompt>');
    const getContent = vi.fn(async () => '<memory>stable</memory>');

    const { pi, handlers, events } = createStartupPromptHookStub();
    registerStartupPromptHooks(pi, state);

    await handlers.get('session_start')?.({ reason: 'startup' }, { cwd: '/repo' });
    events.emit(SANDPIPER_PROMPT_CONTRIBUTION_CHANNEL, {
      id: 'yaams-memory-bootstrap',
      getContent,
    });

    const first = (await handlers.get('before_agent_start')?.(
      { systemPrompt: 'base prompt', systemPromptOptions: {} },
      { cwd: '/repo' },
    )) as { systemPrompt: string };
    events.emit(SANDPIPER_PROMPT_CONTRIBUTION_CHANNEL, {
      id: 'late',
      getContent: () => '<late>ignored</late>',
    });
    const second = (await handlers.get('before_agent_start')?.(
      { systemPrompt: 'base prompt', systemPromptOptions: {} },
      { cwd: '/repo' },
    )) as { systemPrompt: string };

    expect(first.systemPrompt).toBe('<system_prompt>sandpiper</system_prompt>\n\n<memory>stable</memory>');
    expect(second.systemPrompt).toBe('<system_prompt>sandpiper</system_prompt>\n\n<memory>stable</memory>');
    expect(getContent).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes the prompt contribution listener on session_shutdown', async () => {
    const state = createSystemRuntimeState();
    mockBuildSandpiperStartupPrompt.mockResolvedValueOnce('<system_prompt>sandpiper</system_prompt>');

    const { pi, handlers, events } = createStartupPromptHookStub();
    registerStartupPromptHooks(pi, state);

    await handlers.get('session_start')?.({ reason: 'startup' }, { cwd: '/repo' });
    await handlers.get('session_shutdown')?.({ reason: 'reload' }, {});
    events.emit(SANDPIPER_PROMPT_CONTRIBUTION_CHANNEL, {
      id: 'after-shutdown',
      getContent: () => '<memory>leaked</memory>',
    });

    const result = (await handlers.get('before_agent_start')?.(
      { systemPrompt: 'base prompt', systemPromptOptions: {} },
      { cwd: '/repo' },
    )) as { systemPrompt: string };

    expect(result.systemPrompt).toBe('<system_prompt>sandpiper</system_prompt>');
  });

  it('sets cold start from heuristic on startup, env vars on all reasons', async () => {
    const state = createSystemRuntimeState();
    const { pi, handlers } = createEventStub();

    registerSessionContinuityHooks(pi as Parameters<typeof registerSessionContinuityHooks>[0], state);

    const onStart = handlers.get('session_start');
    if (!onStart) {
      throw new Error('session_start handler not registered');
    }

    const getSessionFile = vi.fn(() => '/tmp/session.jsonl');
    const getEntries = vi.fn(() => []);
    const getSessionId = vi.fn(() => 'session-1234');
    const sessionCtx = { sessionManager: { getSessionFile, getEntries, getSessionId } };

    // startup: uses shouldTreatInitialLoadAsColdStart heuristic + sets env vars
    await onStart({ reason: 'startup' }, sessionCtx);

    expect(state.startupContextPending).toBe(true);
    expect(state.coldStartGuidancePending).toBe(true);
    expect(process.env.SANDPIPER_SESSION_ID).toBe('session-1234');
    expect(process.env.SANDPIPER_SESSION_FILE).toBe('/tmp/session.jsonl');
  });

  it('treats /new as a cold start', async () => {
    const state = createSystemRuntimeState();
    const { pi, handlers } = createEventStub();
    registerSessionContinuityHooks(pi as Parameters<typeof registerSessionContinuityHooks>[0], state);

    const onStart = handlers.get('session_start')!;
    const sessionCtx = {
      sessionManager: {
        getSessionFile: vi.fn(() => null),
        getEntries: vi.fn(() => []),
        getSessionId: vi.fn(() => 'new-session'),
      },
    };

    await onStart({ reason: 'new' }, sessionCtx);

    expect(state.startupContextPending).toBe(true);
    expect(state.coldStartGuidancePending).toBe(true);
  });

  it.each(['reload', 'resume', 'fork'] as const)('treats %s as NOT a cold start', async (reason) => {
    const state = createSystemRuntimeState();
    state.coldStartGuidancePending = true; // pre-set to verify it gets cleared
    const { pi, handlers } = createEventStub();
    registerSessionContinuityHooks(pi as Parameters<typeof registerSessionContinuityHooks>[0], state);

    const onStart = handlers.get('session_start')!;
    const sessionCtx = {
      sessionManager: {
        getSessionFile: vi.fn(() => '/tmp/s.jsonl'),
        getEntries: vi.fn(() => []),
        getSessionId: vi.fn(() => 'id'),
      },
    };

    await onStart({ reason }, sessionCtx);

    expect(state.startupContextPending).toBe(true);
    expect(state.coldStartGuidancePending).toBe(false);
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

describe('PID file lifecycle', () => {
  const testSessionsDir = join('/tmp', `test-sandpiper-sessions-${process.pid}`);
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv.XDG_STATE_HOME = process.env.XDG_STATE_HOME;
    process.env.XDG_STATE_HOME = testSessionsDir;
    savedEnv.SANDPIPER_SESSION_ID = process.env.SANDPIPER_SESSION_ID;
    savedEnv.SANDPIPER_SESSION_FILE = process.env.SANDPIPER_SESSION_FILE;

    if (existsSync(testSessionsDir)) {
      rmSync(testSessionsDir, { recursive: true, force: true });
    }
    mkdirSync(testSessionsDir, { recursive: true });
  });

  afterEach(() => {
    if (savedEnv.XDG_STATE_HOME === undefined) {
      delete process.env.XDG_STATE_HOME;
    } else {
      process.env.XDG_STATE_HOME = savedEnv.XDG_STATE_HOME;
    }
    if (savedEnv.SANDPIPER_SESSION_ID === undefined) {
      delete process.env.SANDPIPER_SESSION_ID;
    } else {
      process.env.SANDPIPER_SESSION_ID = savedEnv.SANDPIPER_SESSION_ID;
    }
    if (savedEnv.SANDPIPER_SESSION_FILE === undefined) {
      delete process.env.SANDPIPER_SESSION_FILE;
    } else {
      process.env.SANDPIPER_SESSION_FILE = savedEnv.SANDPIPER_SESSION_FILE;
    }
    if (existsSync(testSessionsDir)) {
      rmSync(testSessionsDir, { recursive: true, force: true });
    }
  });

  it('should create PID file on session_start', async () => {
    const state = createSystemRuntimeState();
    const { pi, handlers } = createEventStub();
    registerSessionContinuityHooks(pi as Parameters<typeof registerSessionContinuityHooks>[0], state);

    const onStart = handlers.get('session_start');
    if (!onStart) {
      throw new Error('session_start handler not registered');
    }

    const getSessionFile = vi.fn(() => '/tmp/session.jsonl');
    const getEntries = vi.fn(() => []);
    const getSessionId = vi.fn(() => 'test-session-123');
    const sessionCtx = { sessionManager: { getSessionFile, getEntries, getSessionId }, cwd: '/test/cwd' };

    await onStart({ reason: 'startup' }, sessionCtx);

    const pidFilePath = join(testSessionsDir, 'sandpiper', 'sessions', 'test-session-123.pid');
    expect(existsSync(pidFilePath)).toBe(true);

    const content = readFileSync(pidFilePath, 'utf-8');
    const lines = content.split('\n');
    expect(lines[0]).toBe(process.pid.toString());
    expect(lines[1]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(lines[2]).toBe('/test/cwd');
  });

  it('should remove PID file on session_shutdown', async () => {
    const state = createSystemRuntimeState();
    const { pi, handlers } = createEventStub();
    registerSessionContinuityHooks(pi as Parameters<typeof registerSessionContinuityHooks>[0], state);

    const onStart = handlers.get('session_start');
    const onShutdown = handlers.get('session_shutdown');
    if (!onStart || !onShutdown) {
      throw new Error('session handlers not registered');
    }

    const getSessionFile = vi.fn(() => '/tmp/session.jsonl');
    const getEntries = vi.fn(() => []);
    const getSessionId = vi.fn(() => 'test-session-456');
    const sessionCtx = { sessionManager: { getSessionFile, getEntries, getSessionId }, cwd: '/test/cwd' };

    await onStart({ reason: 'startup' }, sessionCtx);

    const pidFilePath = join(testSessionsDir, 'sandpiper', 'sessions', 'test-session-456.pid');
    expect(existsSync(pidFilePath)).toBe(true);

    await onShutdown({}, sessionCtx);

    expect(existsSync(pidFilePath)).toBe(false);
  });

  it('should handle session_switch by removing old PID file and creating new one', async () => {
    const state = createSystemRuntimeState();
    const { pi, handlers } = createEventStub();
    registerSessionContinuityHooks(pi as Parameters<typeof registerSessionContinuityHooks>[0], state);

    const onStart = handlers.get('session_start');
    if (!onStart) {
      throw new Error('session_start handler not registered');
    }

    const getSessionFile = vi.fn(() => '/tmp/session.jsonl');
    const getEntries = vi.fn(() => []);
    const getSessionId = vi.fn().mockReturnValueOnce('old-session').mockReturnValueOnce('new-session');
    const sessionCtx = { sessionManager: { getSessionFile, getEntries, getSessionId }, cwd: '/test/cwd' };

    await onStart({ reason: 'startup' }, sessionCtx);

    const oldPidPath = join(testSessionsDir, 'sandpiper', 'sessions', 'old-session.pid');
    expect(existsSync(oldPidPath)).toBe(true);

    await onStart({ reason: 'startup' }, sessionCtx);

    expect(existsSync(oldPidPath)).toBe(false);
    const newPidPath = join(testSessionsDir, 'sandpiper', 'sessions', 'new-session.pid');
    expect(existsSync(newPidPath)).toBe(true);
  });
});
