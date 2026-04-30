import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveStandupCommandContext } from './helpers.js';

describe('standup command host context', () => {
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
});
