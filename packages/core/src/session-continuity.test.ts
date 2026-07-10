import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createSystemRuntimeState,
  handleSandpiperSessionShutdown,
  handleSandpiperSessionStart,
  type SystemRuntimeState,
} from './session-continuity.js';

function createOptions(tempDir: string, env: NodeJS.ProcessEnv = {}) {
  return {
    env,
    now: () => new Date('2026-05-05T06:00:00.000Z'),
    pid: 12345,
    pidFilePathForSession: (sessionId: string) => join(tempDir, `${sessionId}.pid`),
  };
}

describe('session continuity operations', () => {
  let tempDir: string;
  let state: SystemRuntimeState;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'sandpiper-session-continuity-'));
    state = createSystemRuntimeState();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('records env vars and PID file for a new session', () => {
    const env: NodeJS.ProcessEnv = {};

    const result = handleSandpiperSessionStart(
      state,
      {
        cwd: '/repo',
        sessionId: 'session-1',
        sessionFile: '/tmp/session.jsonl',
      },
      createOptions(tempDir, env),
    );

    expect(result).toEqual({
      pidFilePath: join(tempDir, 'session-1.pid'),
      removedPidFilePath: undefined,
      sessionFile: '/tmp/session.jsonl',
      sessionId: 'session-1',
    });
    expect(state).toEqual({
      currentSessionId: 'session-1',
    });
    expect(env.SANDPIPER_SESSION_ID).toBe('session-1');
    expect(env.SANDPIPER_SESSION_FILE).toBe('/tmp/session.jsonl');
    expect(readFileSync(join(tempDir, 'session-1.pid'), 'utf-8')).toBe('12345\n2026-05-05T06:00:00.000Z\n/repo');
  });

  it('removes the previous PID file when the active session changes', () => {
    const options = createOptions(tempDir);

    handleSandpiperSessionStart(state, { cwd: '/repo', sessionId: 'old-session', sessionFile: null }, options);
    const oldPidFile = join(tempDir, 'old-session.pid');
    expect(existsSync(oldPidFile)).toBe(true);

    const result = handleSandpiperSessionStart(
      state,
      { cwd: '/repo', sessionId: 'new-session', sessionFile: null },
      options,
    );

    expect(result.removedPidFilePath).toBe(oldPidFile);
    expect(existsSync(oldPidFile)).toBe(false);
    expect(existsSync(join(tempDir, 'new-session.pid'))).toBe(true);
  });

  it('cleans up the current PID file on shutdown', () => {
    const options = createOptions(tempDir);
    handleSandpiperSessionStart(state, { cwd: '/repo', sessionId: 'session-1', sessionFile: null }, options);
    const pidFile = join(tempDir, 'session-1.pid');
    expect(existsSync(pidFile)).toBe(true);

    const result = handleSandpiperSessionShutdown(state, options);

    expect(result).toEqual({ removedPidFilePath: pidFile, sessionId: 'session-1' });
    expect(existsSync(pidFile)).toBe(false);
    expect(state.currentSessionId).toBeUndefined();
  });

  it('leaves an existing session-file env var unchanged when no session file is available', () => {
    const env: NodeJS.ProcessEnv = { SANDPIPER_SESSION_FILE: '/old/session.jsonl' };

    handleSandpiperSessionStart(
      state,
      { cwd: '/repo', sessionId: 'session-1', sessionFile: null },
      createOptions(tempDir, env),
    );

    expect(env.SANDPIPER_SESSION_ID).toBe('session-1');
    expect(env.SANDPIPER_SESSION_FILE).toBe('/old/session.jsonl');
  });
});
