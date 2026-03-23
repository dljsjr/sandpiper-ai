import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const UNBUFFER_RELAY = join(import.meta.dirname, 'unbuffer-relay');

/** Run unbuffer-relay synchronously and return stdout, stderr, and exit code. */
function run(
  args: string[],
  options?: { input?: string; timeout?: number },
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync([UNBUFFER_RELAY, ...args].map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(' '), {
      encoding: 'utf-8',
      input: options?.input,
      timeout: options?.timeout ?? 10_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: unknown) {
    const e = error as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: (e.stdout as string) ?? '',
      stderr: (e.stderr as string) ?? '',
      exitCode: e.status ?? 1,
    };
  }
}

describe('unbuffer-relay', () => {
  describe('exit code propagation', () => {
    it('should propagate exit code 0 on success', () => {
      const result = run(['echo', 'hello']);
      expect(result.exitCode).toBe(0);
    });

    it('should propagate non-zero exit codes', () => {
      const result = run(['sh', '-c', 'exit 42']);
      expect(result.exitCode).toBe(42);
    });

    it('should propagate exit code 1', () => {
      const result = run(['false']);
      expect(result.exitCode).toBe(1);
    });
  });

  describe('stdout capture', () => {
    it('should capture stdout from simple commands', () => {
      const result = run(['echo', 'hello world']);
      expect(result.stdout.trim()).toBe('hello world');
    });

    it('should capture multi-line output', () => {
      const result = run(['sh', '-c', 'echo line1; echo line2; echo line3']);
      const lines = result.stdout.trim().split(/\r?\n/);
      expect(lines).toEqual(['line1', 'line2', 'line3']);
    });
  });

  describe('PTY allocation', () => {
    it('should make isatty(stdout) return true for the wrapped command', () => {
      // Python's sys.stdout.isatty() checks the fd
      const result = run(['python3', '-c', 'import sys; print(sys.stdout.isatty())']);
      expect(result.stdout.trim()).toBe('True');
    });
  });

  describe('pipeline mode (-p)', () => {
    it('should forward stdin to the child process', () => {
      // Use head -1 to read exactly one line, avoiding EOF issues with cat
      const result = run(['-p', 'head', '-1'], { input: 'hello from stdin\n' });
      expect(result.stdout).toContain('hello from stdin');
    });

    it('should propagate exit code in pipeline mode', () => {
      // Use a command that exits on its own after reading one line
      const result = run(['-p', 'sh', '-c', 'head -1 > /dev/null; exit 7'], {
        input: 'data\n',
      });
      expect(result.exitCode).toBe(7);
    });

    it('should handle empty stdin in pipeline mode', () => {
      // true ignores stdin entirely, so no EOF issue
      const result = run(['-p', 'true'], { input: '' });
      expect(result.exitCode).toBe(0);
    });

    it('should preserve PTY in pipeline mode', () => {
      const result = run(['-p', 'python3', '-c', 'import sys; print(sys.stdout.isatty())'], {
        input: '',
      });
      expect(result.stdout.trim()).toBe('True');
    });
  });

  describe('fast-exiting commands', () => {
    it('should handle true (instant exit)', () => {
      const result = run(['true']);
      expect(result.exitCode).toBe(0);
    });

    it('should handle false (instant exit with code 1)', () => {
      const result = run(['false']);
      expect(result.exitCode).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should print usage and exit 1 with no arguments', () => {
      const result = run([]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Usage:');
    });
  });
});
