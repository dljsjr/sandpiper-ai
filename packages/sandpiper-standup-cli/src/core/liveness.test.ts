import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkProcessLiveness } from './liveness.js';

describe('liveness checker', () => {
  const testSessionsDir = join('/tmp', `test-sandpiper-sessions-${process.pid}`);
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv.XDG_STATE_HOME = process.env.XDG_STATE_HOME;
    process.env.XDG_STATE_HOME = testSessionsDir;

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
    if (existsSync(testSessionsDir)) {
      rmSync(testSessionsDir, { recursive: true, force: true });
    }
  });

  describe('readPidFile', () => {
    it('should read valid PID file', () => {
      const sessionId = 'test-session';
      const pidFilePath = join(testSessionsDir, 'sandpiper', 'sessions', `${sessionId}.pid`);
      mkdirSync(join(testSessionsDir, 'sandpiper', 'sessions'), { recursive: true });

      const content = `${1}\n2026-04-05T10:00:00.000Z\n/test/cwd`;
      writeFileSync(pidFilePath, content, 'utf-8');

      const pidFile = checkProcessLiveness(sessionId);
      expect(pidFile).not.toBeNull();
      expect(pidFile?.pid).toBe(1);
      expect(pidFile?.createdAt).toBe('2026-04-05T10:00:00.000Z');
      expect(pidFile?.cwd).toBe('/test/cwd');
      expect(pidFile?.isAlive).toBe(true);
    });

    it('should return null when PID file does not exist', () => {
      const result = checkProcessLiveness('nonexistent-session');
      expect(result).toBeNull();
    });

    it('should mark process as dead when PID file exists but process is not running', () => {
      const sessionId = 'dead-session';
      const pidFilePath = join(testSessionsDir, 'sandpiper', 'sessions', `${sessionId}.pid`);
      mkdirSync(join(testSessionsDir, 'sandpiper', 'sessions'), { recursive: true });

      // Use a PID that's almost certainly not running
      const content = `99999999\n2026-04-05T10:00:00.000Z\n/test/cwd`;
      writeFileSync(pidFilePath, content, 'utf-8');

      const result = checkProcessLiveness(sessionId);
      expect(result).not.toBeNull();
      expect(result?.pid).toBe(99999999);
      expect(result?.isAlive).toBe(false);
    });

    it('should mark process as alive when process is running', () => {
      const sessionId = 'alive-session';
      const pidFilePath = join(testSessionsDir, 'sandpiper', 'sessions', `${sessionId}.pid`);
      mkdirSync(join(testSessionsDir, 'sandpiper', 'sessions'), { recursive: true });

      const content = `${1}\n2026-04-05T10:00:00.000Z\n/test/cwd`;
      writeFileSync(pidFilePath, content, 'utf-8');

      const result = checkProcessLiveness(sessionId);
      expect(result).not.toBeNull();
      expect(result?.isAlive).toBe(true);
    });
  });

  describe('explicit pid (harness-agnostic path)', () => {
    it('checks the explicit PID directly and ignores the sandpiper pidfile registry entirely', () => {
      // No pidfile is ever created for this session — this is the foreign-harness
      // case (e.g. Claude Code), which has no participation in sandpiper's own
      // pidfile directory convention.
      const result = checkProcessLiveness('claude-code-session-with-no-pidfile', 1);
      expect(result).not.toBeNull();
      expect(result?.pid).toBe(1);
      expect(result?.isAlive).toBe(true);
    });

    it('reports dead for an explicit PID that is not running, with no pidfile involved', () => {
      const result = checkProcessLiveness('claude-code-session-with-no-pidfile', 99999999);
      expect(result).not.toBeNull();
      expect(result?.isAlive).toBe(false);
    });

    it('prefers the explicit PID over a conflicting sandpiper pidfile, when both are present', () => {
      const sessionId = 'session-with-stale-pidfile';
      const pidFilePath = join(testSessionsDir, 'sandpiper', 'sessions', `${sessionId}.pid`);
      mkdirSync(join(testSessionsDir, 'sandpiper', 'sessions'), { recursive: true });
      writeFileSync(pidFilePath, `1\n2026-04-05T10:00:00.000Z\n/test/cwd`, 'utf-8');

      // The pidfile says alive (pid 1), but an explicit dead PID was recorded on
      // the section itself — the explicit value wins.
      const result = checkProcessLiveness(sessionId, 99999999);
      expect(result?.isAlive).toBe(false);
    });
  });
});
