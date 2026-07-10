import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const standupBin = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist', 'sandpiper-standup');

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
      execSync(`node ${JSON.stringify(standupBin)} read -d ${testDir}`, { encoding: 'utf-8' });
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

    const output = execSync(`node ${JSON.stringify(standupBin)} read -d ${testDir}`, {
      encoding: 'utf-8',
      env: { ...process.env, SANDPIPER_SESSION_ID: sessionId },
    });
    expect(output).toContain('## Active Sessions');
    expect(output).toContain(`### ${sessionId}`);
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

    const output = execSync(`node ${JSON.stringify(standupBin)} read -d ${testDir}`, {
      encoding: 'utf-8',
      env: { ...process.env, SANDPIPER_SESSION_ID: aliveSessionId },
    });
    expect(output).toContain('## Active Sessions');
    expect(output).toContain(`### ${aliveSessionId}`);
    expect(output).toContain('Alive work');
    expect(output).toContain('## Inactive Sessions');
    expect(output).toContain(`### ${deadSessionId}`);
    expect(output).toContain('Dead work');
  });

  it('does not delete inactive sections from disk — only explicit cleanup may prune them', () => {
    const aliveSessionId = 'session-alive-2';
    const deadSessionId = 'session-dead-2';
    createPidFile(aliveSessionId, 1);
    createPidFile(deadSessionId, 99999999); // Dead PID

    const standupContent = `# Session Stand-Up

## Session ${aliveSessionId} (Updated: 2026-04-05T10:30:00Z)

Session file: /path/to/alive.jsonl

### Accomplished
- Alive work

## Session ${deadSessionId} (Updated: 2026-04-05T10:25:00Z)

Session file: /path/to/dead.jsonl

### Accomplished
- Dormant thread, still needed months later
`;

    const standupPath = join(testDir, '.sandpiper', 'standup.md');
    writeFileSync(standupPath, standupContent);

    execSync(`node ${JSON.stringify(standupBin)} read -d ${testDir}`, {
      encoding: 'utf-8',
      env: { ...process.env, SANDPIPER_SESSION_ID: aliveSessionId },
    });

    // A dead pidfile just means "not this session" for display purposes — it must
    // not cause read to delete the section. Only `cleanup` prunes anything.
    const persisted = readFileSync(standupPath, 'utf-8');
    expect(persisted).toContain(`## Session ${deadSessionId}`);
    expect(persisted).toContain('Dormant thread, still needed months later');
  });

  it('preserves legacy standup content on read', () => {
    const legacyContent = `# Session Stand-Up

Updated: 2026-04-05T10:00:00Z

## Accomplished
- Legacy work
`;

    const standupPath = join(testDir, '.sandpiper', 'standup.md');
    writeFileSync(standupPath, legacyContent);

    const output = execSync(`node ${JSON.stringify(standupBin)} read -d ${testDir}`, {
      encoding: 'utf-8',
      env: { ...process.env, SANDPIPER_SESSION_ID: 'current-session' },
    });

    expect(output).toContain('## Inactive Sessions');
    expect(output).toContain('### unknown');
    expect(output).toContain('Legacy work');

    // File remains in legacy format after read.
    const persisted = readFileSync(standupPath, 'utf-8');
    expect(persisted).toBe(legacyContent);
  });

  it('classifies a foreign-harness section (e.g. Claude Code) as active via its own --pid, with no sandpiper pidfile', () => {
    const sandpiperSessionId = 'sandpiper-session';
    createPidFile(sandpiperSessionId, 1);
    // No pidfile is ever created for 'claude-code-session' — this section was
    // written by a different harness that recorded its own PID directly.

    const standupContent = `# Session Stand-Up

## Session claude-code-session (Updated: 2026-04-05T10:30:00Z)

Session file:
PID: ${process.pid}

### Accomplished
- Foreign harness work, still running
`;

    writeFileSync(join(testDir, '.sandpiper', 'standup.md'), standupContent);

    const output = execSync(`node ${JSON.stringify(standupBin)} read -d ${testDir}`, {
      encoding: 'utf-8',
      env: { ...process.env, SANDPIPER_SESSION_ID: sandpiperSessionId },
    });

    expect(output).toContain('## Active Sessions');
    expect(output).toContain('### claude-code-session');
    expect(output).toContain('Foreign harness work, still running');
    expect(output).not.toContain('## Inactive Sessions');
  });
});
