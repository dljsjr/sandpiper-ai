import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanupStandup } from './cleanup.js';

describe('cleanupStandup', () => {
  const testSessionsDir = join('/tmp', `test-sandpiper-sessions-${process.pid}`);
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv.XDG_STATE_HOME = process.env.XDG_STATE_HOME;
    process.env.XDG_STATE_HOME = testSessionsDir;
    savedEnv.SANDPIPER_SESSION_ID = process.env.SANDPIPER_SESSION_ID;

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
    if (existsSync(testSessionsDir)) {
      rmSync(testSessionsDir, { recursive: true, force: true });
    }
  });

  function createPidFile(sessionId: string, pid: number) {
    const sessionsDir = join(testSessionsDir, 'sandpiper', 'sessions');
    mkdirSync(sessionsDir, { recursive: true });
    const pidFilePath = join(sessionsDir, `${sessionId}.pid`);
    const content = `${pid}\n2026-04-05T10:00:00.000Z\n/test/cwd`;
    writeFileSync(pidFilePath, content, 'utf-8');
  }

  it('should keep sections with alive processes', () => {
    process.env.SANDPIPER_SESSION_ID = 'session-alive';
    createPidFile('session-alive', 1);

    const content = `# Session Stand-Up

## Session session-alive (Updated: 2026-04-05T10:30:00Z)

Session file: /path/to/session.jsonl

### Accomplished
- Work

### In Progress
- More

### Next Session
- Continue

### Blockers
- None

### Context
- Info
`;

    const result = cleanupStandup(content, { currentSessionId: process.env.SANDPIPER_SESSION_ID });
    expect(result.cleanedSections).toHaveLength(1);
    expect(result.inactiveSections).toHaveLength(0);
    expect(result.cleanedSections[0]?.uuid).toBe('session-alive');
  });

  it('should remove sections with dead processes', () => {
    process.env.SANDPIPER_SESSION_ID = 'session-current';
    createPidFile('session-current', 1);
    createPidFile('session-dead', 99999999); // Dead PID

    const content = `# Session Stand-Up

## Session session-current (Updated: 2026-04-05T10:30:00Z)

Session file: /path/to/current.jsonl

### Accomplished
- Current work

### In Progress
- Nothing

### Next Session
- More

### Blockers
- None

### Context
- Info

## Session session-dead (Updated: 2026-04-05T10:25:00Z)

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

    const result = cleanupStandup(content, { currentSessionId: process.env.SANDPIPER_SESSION_ID });
    expect(result.cleanedSections).toHaveLength(1);
    expect(result.cleanedSections[0]?.uuid).toBe('session-current');
    expect(result.inactiveSections).toHaveLength(1);
    expect(result.inactiveSections[0]?.uuid).toBe('session-dead');
  });

  it('should remove sections with no PID file', () => {
    process.env.SANDPIPER_SESSION_ID = 'session-current';
    createPidFile('session-current', 1);
    // session-orphan has no PID file

    const content = `# Session Stand-Up

## Session session-current (Updated: 2026-04-05T10:30:00Z)

Session file: /path/to/current.jsonl

### Accomplished
- Work

### In Progress
- Nothing

### Next Session
- More

### Blockers
- None

### Context
- Info

## Session session-orphan (Updated: 2026-04-05T10:20:00Z)

Session file: /path/to/orphan.jsonl

### Accomplished
- Orphan work

### In Progress
- None

### Next Session
- None

### Blockers
- None

### Context
- None
`;

    const result = cleanupStandup(content, { currentSessionId: process.env.SANDPIPER_SESSION_ID });
    expect(result.cleanedSections).toHaveLength(1);
    expect(result.cleanedSections[0]?.uuid).toBe('session-current');
    expect(result.inactiveSections).toHaveLength(1);
    expect(result.inactiveSections[0]?.uuid).toBe('session-orphan');
  });

  it('should handle empty content', () => {
    process.env.SANDPIPER_SESSION_ID = 'session-test';
    const result = cleanupStandup('', { currentSessionId: undefined });
    expect(result.cleanedSections).toHaveLength(0);
    expect(result.inactiveSections).toHaveLength(0);
  });

  it('should preserve current session even if PID check fails', () => {
    process.env.SANDPIPER_SESSION_ID = 'session-current';
    // Don't create PID file - simulate failure

    const content = `# Session Stand-Up

## Session session-current (Updated: 2026-04-05T10:30:00Z)

Session file: /path/to/current.jsonl

### Accomplished
- Work

### In Progress
- Nothing

### Next Session
- More

### Blockers
- None

### Context
- Info
`;

    const result = cleanupStandup(content, { currentSessionId: process.env.SANDPIPER_SESSION_ID });
    // Current session should be kept even without PID file
    expect(result.cleanedSections).toHaveLength(1);
    expect(result.cleanedSections[0]?.uuid).toBe('session-current');
  });
});
