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
});
