import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerBackgroundProcessLifecycleHooks } from './background-process-hooks.js';
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
    mockBuildSandpiperStartupPrompt.mockImplementation(async (input: { agentDir?: string; cwd: string }) => {
      return JSON.stringify({
        agentDir: input.agentDir,
        cwd: input.cwd,
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds startup prompt from agentDir and cwd on before_agent_start', async () => {
    const { pi, handlers } = createStartupPromptHookStub();
    registerStartupPromptHooks(pi);

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
  });

  it('sets session env vars on session_start', async () => {
    const state = createSystemRuntimeState();
    const { pi, handlers } = createEventStub();

    registerSessionContinuityHooks(pi as Parameters<typeof registerSessionContinuityHooks>[0], state);

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
