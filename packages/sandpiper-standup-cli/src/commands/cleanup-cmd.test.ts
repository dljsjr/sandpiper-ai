import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('cleanup command', () => {
  const testDir = join('/tmp', `test-standup-cleanup-${process.pid}`);
  const testSessionsDir = join('/tmp', `test-sandpiper-sessions-${process.pid}`);
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv.XDG_STATE_HOME = process.env.XDG_STATE_HOME;
    process.env.XDG_STATE_HOME = testSessionsDir;
    savedEnv.SANDPIPER_SESSION_ID = process.env.SANDPIPER_SESSION_ID;

    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    if (existsSync(testSessionsDir)) {
      rmSync(testSessionsDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(testSessionsDir, 'sandpiper', 'sessions'), { recursive: true });
    mkdirSync(join(testDir, '.sandpiper'), { recursive: true });
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
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    if (existsSync(testSessionsDir)) {
      rmSync(testSessionsDir, { recursive: true, force: true });
    }
  });

  function createPidFile(sessionId: string, pid: number) {
    const pidFilePath = join(testSessionsDir, 'sandpiper', 'sessions', `${sessionId}.pid`);
    const content = `${pid}\n2026-04-05T10:00:00.000Z\n/test/cwd`;
    writeFileSync(pidFilePath, content, 'utf-8');
  }

  it('should clean dead sessions and remove their PID files', () => {
    const aliveSessionId = 'alive-session';
    const deadSessionId = 'dead-session';
    createPidFile(aliveSessionId, 1);
    createPidFile(deadSessionId, 99999999); // Dead PID

    const standupContent = `# Session Stand-Up

## Session ${aliveSessionId} (Updated: 2026-04-06T10:00:00Z)

Session file: /path/to/alive.jsonl

### Accomplished
- Alive work

## Session ${deadSessionId} (Updated: 2026-04-06T09:00:00Z)

Session file: /path/to/dead.jsonl

### Accomplished
- Dead work
`;

    writeFileSync(join(testDir, '.sandpiper', 'standup.md'), standupContent);

    const output = execSync(`node dist/sandpiper-standup cleanup -d ${testDir}`, {
      encoding: 'utf-8',
      env: { ...process.env, SANDPIPER_SESSION_ID: aliveSessionId },
    });

    expect(output).toContain('Cleaned inactive sessions');
    expect(output).toContain(deadSessionId);

    const cleanedContent = readFileSync(join(testDir, '.sandpiper', 'standup.md'), 'utf-8');
    expect(cleanedContent).toContain(aliveSessionId);
    expect(cleanedContent).not.toContain(deadSessionId);

    // PID file should be removed
    const deadPidPath = join(testSessionsDir, 'sandpiper', 'sessions', `${deadSessionId}.pid`);
    expect(existsSync(deadPidPath)).toBe(false);
  });

  it('should report no inactive sessions when all are alive', () => {
    const sessionId = 'alive-session';
    createPidFile(sessionId, 1);

    const standupContent = `# Session Stand-Up

## Session ${sessionId} (Updated: 2026-04-06T10:00:00Z)

Session file: /path/to/session.jsonl

### Accomplished
- Work
`;

    writeFileSync(join(testDir, '.sandpiper', 'standup.md'), standupContent);

    const output = execSync(`node dist/sandpiper-standup cleanup -d ${testDir}`, {
      encoding: 'utf-8',
      env: { ...process.env, SANDPIPER_SESSION_ID: sessionId },
    });

    expect(output).toContain('No inactive sessions to clean');
  });

  it('should handle missing standup file gracefully', () => {
    const output = execSync(`node dist/sandpiper-standup cleanup -d ${testDir}`, {
      encoding: 'utf-8',
    });

    expect(output).toContain('No standup file found');
  });
});
