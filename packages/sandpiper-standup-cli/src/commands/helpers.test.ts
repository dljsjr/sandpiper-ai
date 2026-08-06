import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  formatMissingSessionIdMessage,
  formatSessionFileHelp,
  formatSessionIdHelp,
  resolveStandupCommandContext,
} from './helpers.js';

describe('standup command host context', () => {
  it('derives session identity help and error text from configured env names', () => {
    const envNames = {
      sessionId: 'CUSTOM_SESSION_ID',
      sessionFile: 'CUSTOM_SESSION_FILE',
    };

    expect(formatSessionIdHelp(envNames)).toBe(
      'Session ID — any stable string identifying this session across successive writes, not necessarily a UUID (defaults to CUSTOM_SESSION_ID, falling back to PI_SESSION_ID)',
    );
    expect(formatSessionFileHelp(envNames)).toBe(
      'Session file path (defaults to CUSTOM_SESSION_FILE, falling back to PI_SESSION_FILE)',
    );
    expect(formatMissingSessionIdMessage(envNames)).toBe(
      'Session ID required. Provide --id or set CUSTOM_SESSION_ID (or PI_SESSION_ID) environment variable.',
    );
  });

  it('resolves the standup file from an explicit root directory', () => {
    const context = resolveStandupCommandContext({
      rootDir: '/tmp/project',
      cwd: '/tmp/ignored',
      env: {
        SANDPIPER_SESSION_ID: 'env-session',
        SANDPIPER_SESSION_FILE: '/tmp/env-session.jsonl',
      },
    });

    expect(context.host.cwd).toBe('/tmp/project');
    expect(context.standupPath).toBe(join('/tmp/project', '.sandpiper', 'standup.md'));
    expect(context.session.sessionId).toBe('env-session');
    expect(context.session.sessionFile).toBe('/tmp/env-session.jsonl');
  });

  it('uses explicit session identity values before environment values', () => {
    const context = resolveStandupCommandContext({
      cwd: '/tmp/project',
      env: {
        SANDPIPER_SESSION_ID: 'env-session',
        SANDPIPER_SESSION_FILE: '/tmp/env-session.jsonl',
      },
      sessionId: 'flag-session',
      sessionFile: '/tmp/flag-session.jsonl',
    });

    expect(context.session.sessionId).toBe('flag-session');
    expect(context.session.sessionFile).toBe('/tmp/flag-session.jsonl');
  });

  it('falls back to PI_SESSION_ID/PI_SESSION_FILE when SANDPIPER_SESSION_* is unset', () => {
    // Simulates a sandpiper-standup invocation from inside a Pi bash-tool child process
    // (0.82.0 injects PI_SESSION_ID/PI_SESSION_FILE there; mirrorPiSandpiperEnvironment
    // doesn't cover that spawn path).
    const context = resolveStandupCommandContext({
      cwd: '/tmp/project',
      env: {
        PI_SESSION_ID: 'pi-session',
        PI_SESSION_FILE: '/tmp/pi-session.jsonl',
      },
    });

    expect(context.session.sessionId).toBe('pi-session');
    expect(context.session.sessionFile).toBe('/tmp/pi-session.jsonl');
  });

  it('prefers SANDPIPER_SESSION_* over PI_SESSION_* when both are present', () => {
    const context = resolveStandupCommandContext({
      cwd: '/tmp/project',
      env: {
        SANDPIPER_SESSION_ID: 'sandpiper-session',
        SANDPIPER_SESSION_FILE: '/tmp/sandpiper-session.jsonl',
        PI_SESSION_ID: 'pi-session',
        PI_SESSION_FILE: '/tmp/pi-session.jsonl',
      },
    });

    expect(context.session.sessionId).toBe('sandpiper-session');
    expect(context.session.sessionFile).toBe('/tmp/sandpiper-session.jsonl');
  });

  it('leaves session identity undefined when neither SANDPIPER_SESSION_* nor PI_SESSION_* is set', () => {
    const context = resolveStandupCommandContext({
      cwd: '/tmp/project',
      env: {},
    });

    expect(context.session.sessionId).toBeUndefined();
    expect(context.session.sessionFile).toBeUndefined();
  });
});
