import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('write command', () => {
  const testDir = join('/tmp', `test-standup-write-${process.pid}`);
  const testSessionsDir = join('/tmp', `test-sandpiper-sessions-${process.pid}`);
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv.XDG_STATE_HOME = process.env.XDG_STATE_HOME;
    process.env.XDG_STATE_HOME = testSessionsDir;
    savedEnv.SANDPIPER_SESSION_ID = process.env.SANDPIPER_SESSION_ID;
    savedEnv.SANDPIPER_SESSION_FILE = process.env.SANDPIPER_SESSION_FILE;

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
    if (savedEnv.SANDPIPER_SESSION_FILE === undefined) {
      delete process.env.SANDPIPER_SESSION_FILE;
    } else {
      process.env.SANDPIPER_SESSION_FILE = savedEnv.SANDPIPER_SESSION_FILE;
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

  it('should write a new section using env vars', () => {
    const sessionId = 'test-session';
    const sessionFile = '/path/to/session.jsonl';
    createPidFile(sessionId, 1);

    const body = '### Accomplished\n- Test work';

    execSync(`echo '${body}' | node dist/sandpiper-standup write -d ${testDir}`, {
      encoding: 'utf-8',
      env: {
        ...process.env,
        SANDPIPER_SESSION_ID: sessionId,
        SANDPIPER_SESSION_FILE: sessionFile,
      },
    });

    const standupContent = readFileSync(join(testDir, '.sandpiper', 'standup.md'), 'utf-8');
    expect(standupContent).toContain(`## Session ${sessionId}`);
    expect(standupContent).toContain(sessionFile);
    expect(standupContent).toContain('Test work');
  });

  it('should write using explicit flags', () => {
    const sessionId = 'test-session-2';
    const sessionFile = '/path/to/session2.jsonl';
    createPidFile(sessionId, 1);

    const body = '### Accomplished\n- Explicit flag work';

    execSync(`echo '${body}' | node dist/sandpiper-standup write -d ${testDir} -u ${sessionId} -f ${sessionFile}`, {
      encoding: 'utf-8',
    });

    const standupContent = readFileSync(join(testDir, '.sandpiper', 'standup.md'), 'utf-8');
    expect(standupContent).toContain(`## Session ${sessionId}`);
    expect(standupContent).toContain(sessionFile);
    expect(standupContent).toContain('Explicit flag work');
  });

  it('should update existing section', () => {
    const sessionId = 'test-session-3';
    const sessionFile = '/path/to/session3.jsonl';
    createPidFile(sessionId, 1);

    // First write
    execSync(
      `echo '### Accomplished\n- First' | node dist/sandpiper-standup write -d ${testDir} -u ${sessionId} -f ${sessionFile}`,
      {
        encoding: 'utf-8',
      },
    );

    // Second write (update)
    execSync(
      `echo '### Accomplished\n- Updated' | node dist/sandpiper-standup write -d ${testDir} -u ${sessionId} -f ${sessionFile}`,
      {
        encoding: 'utf-8',
      },
    );

    const standupContent = readFileSync(join(testDir, '.sandpiper', 'standup.md'), 'utf-8');
    // Should only have one section
    const sectionCount = (standupContent.match(/## Session/g) || []).length;
    expect(sectionCount).toBe(1);
    expect(standupContent).toContain('Updated');
    expect(standupContent).not.toContain('First');
  });

  it('should preserve legacy content on first write', () => {
    const sessionId = 'new-session';
    const sessionFile = '/path/to/new.jsonl';
    createPidFile(sessionId, 1);

    // Create legacy standup
    const legacyContent = `# Session Stand-Up

Updated: 2026-04-05T10:00:00Z

## Accomplished
- Legacy work
`;
    writeFileSync(join(testDir, '.sandpiper', 'standup.md'), legacyContent);

    // Write new section
    execSync(
      `echo '### Accomplished\n- New work' | node dist/sandpiper-standup write -d ${testDir} -u ${sessionId} -f ${sessionFile}`,
      {
        encoding: 'utf-8',
      },
    );

    const standupContent = readFileSync(join(testDir, '.sandpiper', 'standup.md'), 'utf-8');
    expect(standupContent).toContain('## Session unknown');
    expect(standupContent).toContain('Legacy work');
    expect(standupContent).toContain('## Session new-session');
    expect(standupContent).toContain('New work');
  });

  it('should write successfully with env vars', () => {
    const sessionId = 'env-test-session';
    const sessionFile = '/path/to/env-test.jsonl';
    createPidFile(sessionId, 1);

    const body = '### Accomplished\n- Env var test';

    execSync(`echo '${body}' | node dist/sandpiper-standup write -d ${testDir}`, {
      encoding: 'utf-8',
      env: {
        ...process.env,
        SANDPIPER_SESSION_ID: sessionId,
        SANDPIPER_SESSION_FILE: sessionFile,
      },
    });

    const standupContent = readFileSync(join(testDir, '.sandpiper', 'standup.md'), 'utf-8');
    expect(standupContent).toContain(`## Session ${sessionId}`);
    expect(standupContent).toContain(sessionFile);
    expect(standupContent).toContain('Env var test');
  });

  it('preserves another alive session when a second session writes', () => {
    const sessionA = { id: 'session-a', file: '/path/to/session-a.jsonl' };
    const sessionB = { id: 'session-b', file: '/path/to/session-b.jsonl' };

    createPidFile(sessionA.id, 1);
    createPidFile(sessionB.id, 1);

    execSync(`echo '### Accomplished\n- Work A' | node dist/sandpiper-standup write -d ${testDir}`, {
      encoding: 'utf-8',
      env: {
        ...process.env,
        SANDPIPER_SESSION_ID: sessionA.id,
        SANDPIPER_SESSION_FILE: sessionA.file,
      },
    });

    execSync(`echo '### Accomplished\n- Work B' | node dist/sandpiper-standup write -d ${testDir}`, {
      encoding: 'utf-8',
      env: {
        ...process.env,
        SANDPIPER_SESSION_ID: sessionB.id,
        SANDPIPER_SESSION_FILE: sessionB.file,
      },
    });

    const standupContent = readFileSync(join(testDir, '.sandpiper', 'standup.md'), 'utf-8');
    expect(standupContent).toContain(`## Session ${sessionA.id}`);
    expect(standupContent).toContain('Work A');
    expect(standupContent).toContain(`## Session ${sessionB.id}`);
    expect(standupContent).toContain('Work B');
  });
});
