import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('read command', () => {
  const testDir = join('/tmp', `test-standup-read-${process.pid}`);
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

  it('should return exit code 1 when standup file does not exist', () => {
    try {
      execSync(`node dist/sandpiper-standup read -d ${testDir}`, { encoding: 'utf-8' });
      expect.fail('Should have thrown');
    } catch (error) {
      const err = error as { status?: number };
      expect(err.status).toBe(1);
    }
  });

  it('should read and output active sessions', () => {
    const sessionId = 'session-alive';
    createPidFile(sessionId, 1);

    const standupContent = `# Session Stand-Up

## Session ${sessionId} (Updated: 2026-04-05T10:30:00Z)

Session file: /path/to/session.jsonl

### Accomplished
- Work done

### In Progress
- Nothing

### Next Session
- More

### Blockers
- None

### Context
- Info
`;

    writeFileSync(join(testDir, '.sandpiper', 'standup.md'), standupContent);

    const output = execSync(`node dist/sandpiper-standup read -d ${testDir}`, {
      encoding: 'utf-8',
      env: { ...process.env, SANDPIPER_SESSION_ID: sessionId },
    });
    expect(output).toContain('## Active Sessions');
    expect(output).toContain(`### Session ${sessionId}`);
    expect(output).toContain('Work done');
  });

  it('should separate active and inactive sessions', () => {
    const aliveSessionId = 'session-alive';
    const deadSessionId = 'session-dead';
    createPidFile(aliveSessionId, 1);
    createPidFile(deadSessionId, 99999999); // Dead PID

    const standupContent = `# Session Stand-Up

## Session ${aliveSessionId} (Updated: 2026-04-05T10:30:00Z)

Session file: /path/to/alive.jsonl

### Accomplished
- Alive work

### In Progress
- Nothing

### Next Session
- Continue

### Blockers
- None

### Context
- Info

## Session ${deadSessionId} (Updated: 2026-04-05T10:25:00Z)

Session file: /path/to/dead.jsonl

### Accomplished
- Dead work

### In Progress
- None

### Next Session
- None

### Blockers
- None

### Context
- None
`;

    writeFileSync(join(testDir, '.sandpiper', 'standup.md'), standupContent);

    const output = execSync(`node dist/sandpiper-standup read -d ${testDir}`, {
      encoding: 'utf-8',
      env: { ...process.env, SANDPIPER_SESSION_ID: aliveSessionId },
    });
    expect(output).toContain('## Active Sessions');
    expect(output).toContain(`### Session ${aliveSessionId}`);
    expect(output).toContain('Alive work');
    expect(output).toContain('## Inactive Sessions');
    expect(output).toContain(`### Session ${deadSessionId}`);
    expect(output).toContain('Dead work');
  });

  it('preserves legacy standup content on read', () => {
    const legacyContent = `# Session Stand-Up

Updated: 2026-04-05T10:00:00Z

## Accomplished
- Legacy work
`;

    const standupPath = join(testDir, '.sandpiper', 'standup.md');
    writeFileSync(standupPath, legacyContent);

    const output = execSync(`node dist/sandpiper-standup read -d ${testDir}`, {
      encoding: 'utf-8',
      env: { ...process.env, SANDPIPER_SESSION_ID: 'current-session' },
    });

    expect(output).toContain('## Inactive Sessions');
    expect(output).toContain('### Session unknown');
    expect(output).toContain('Legacy work');

    // File remains in legacy format after read.
    const persisted = readFileSync(standupPath, 'utf-8');
    expect(persisted).toBe(legacyContent);
  });
});
