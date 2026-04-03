import * as core from 'sandpiper-ai-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSystemRuntimeState } from './runtime.js';
import {
  registerBackgroundProcessContextHooks,
  registerSessionContinuityHooks,
  registerStartupPromptHooks,
} from './startup-hooks.js';
import { createBackgroundContextProcessManagerStub, createEventStub } from './test-helpers.js';

describe('startup hooks', () => {
  beforeEach(() => {
    vi.spyOn(core, 'buildSandpiperSystemPrompt').mockImplementation(
      (_basePrompt: string, options: Parameters<typeof core.buildSandpiperSystemPrompt>[1]) => JSON.stringify(options),
    );
    vi.spyOn(core, 'collectProjectTriggers').mockReturnValue([]);
    vi.spyOn(core, 'collectActiveTaskContext').mockReturnValue(undefined);
    vi.spyOn(core, 'collectWorkingCopySummary').mockReturnValue(undefined);
    vi.spyOn(core, 'formatProjectTriggersForPrompt').mockReturnValue('<projects/>');
    vi.spyOn(core, 'formatActiveTaskContextForPrompt').mockReturnValue('<active/>');
    vi.spyOn(core, 'formatWorkingCopySummaryForPrompt').mockReturnValue('<working-copy/>');
    vi.spyOn(core, 'formatColdStartGuidance').mockReturnValue('<cold-start/>');
    vi.spyOn(core, 'formatStandupContext').mockReturnValue('<standup/>');
    vi.spyOn(core, 'shouldTreatInitialLoadAsColdStart').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds startup prompt sections and clears one-shot state after before_agent_start', async () => {
    const state = createSystemRuntimeState();
    state.startupContextPending = true;
    state.coldStartGuidancePending = true;

    const { pi, handlers } = createEventStub();
    registerStartupPromptHooks(pi as Parameters<typeof registerStartupPromptHooks>[0], state);

    const handler = handlers.get('before_agent_start');
    if (!handler) {
      throw new Error('before_agent_start handler not registered');
    }

    const result = (await handler(
      { systemPrompt: 'base prompt' },
      {
        cwd: '/repo',
      },
    )) as { systemPrompt: string };

    expect(result.systemPrompt).toContain('"projectTriggers":"<projects/>"');
    expect(result.systemPrompt).toContain('"activeTaskContext":"<active/>"');
    expect(result.systemPrompt).toContain('"workingCopyContext":"<working-copy/>"');
    expect(result.systemPrompt).toContain('"coldStartGuidance":"<cold-start/>"');
    expect(state.startupContextPending).toBe(false);
    expect(state.coldStartGuidancePending).toBe(false);
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

  it('emits background process completion context and kills all on shutdown', async () => {
    const { pi, handlers } = createEventStub();
    const acknowledge = vi.fn();
    const killAll = vi.fn();
    const processManager = createBackgroundContextProcessManagerStub({
      getCompletedUnacknowledged: vi.fn(() => [{ id: 'build', exitCode: 1 }]),
      acknowledge,
      killAll,
    });

    registerBackgroundProcessContextHooks(
      pi as Parameters<typeof registerBackgroundProcessContextHooks>[0],
      processManager as Parameters<typeof registerBackgroundProcessContextHooks>[1],
    );

    const onContext = handlers.get('context');
    const onShutdown = handlers.get('session_shutdown');
    if (!onContext || !onShutdown) {
      throw new Error('background process hooks not registered');
    }

    const contextResult = (await onContext({ messages: [] }, {})) as {
      messages: Array<{ content: Array<{ text: string }> }>;
    };

    expect(contextResult.messages[0]?.content[0]?.text).toContain('Background process "build" exited with code 1.');
    expect(acknowledge).toHaveBeenCalledWith('build');

    await onShutdown({}, {});
    expect(killAll).toHaveBeenCalled();
  });
});
