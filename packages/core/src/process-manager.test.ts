import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ManagedProcess, ProcessManager } from './process-manager.js';

interface WaitForOptions {
  readonly timeout?: number;
  readonly interval?: number;
}

async function waitFor(assertion: () => void, options: WaitForOptions = {}): Promise<void> {
  const timeout = options.timeout ?? 1000;
  const interval = options.interval ?? 10;
  const deadline = Date.now() + timeout;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, interval);
    });
  }

  throw lastError instanceof Error ? lastError : new Error(`waitFor timed out after ${timeout}ms`);
}

describe('ProcessManager', () => {
  let pm: ProcessManager;

  beforeEach(() => {
    pm = new ProcessManager();
  });

  afterEach(() => {
    pm.killAll();
  });

  // ─── spawn ──────────────────────────────────────────────────────

  describe('spawn', () => {
    it('should spawn a process and return a ManagedProcess', () => {
      const proc = pm.spawn({ id: 'test', command: 'echo', args: ['hello'] });
      expect(proc).toBeInstanceOf(ManagedProcess);
      expect(proc.id).toBe('test');
      expect(proc.pid).toBeDefined();
    });

    it('should throw if a process with the ID is still running', () => {
      pm.spawn({ id: 'test', command: 'sleep', args: ['10'] });
      expect(() => pm.spawn({ id: 'test', command: 'echo' })).toThrow('is already running');
    });

    it('should allow reuse of ID after the previous process exited, without an explicit remove', async () => {
      const first = pm.spawn({ id: 'test', command: 'true' });
      await waitFor(() => expect(first.running).toBe(false), { timeout: 2000 });

      const second = pm.spawn({ id: 'test', command: 'echo', args: ['world'] });
      expect(second.id).toBe('test');
      expect(second).not.toBe(first);
    });

    it('should allow reuse of ID after the previous process was killed externally', async () => {
      const first = pm.spawn({ id: 'test', command: 'sleep', args: ['60'] });
      // Simulate a kill delivered outside this process's own kill() call (e.g. `kill -9`
      // from another terminal) — the OS still notifies us via the child's exit event.
      first.kill('SIGKILL');
      await waitFor(() => expect(first.running).toBe(false), { timeout: 2000 });

      const second = pm.spawn({ id: 'test', command: 'echo', args: ['world'] });
      expect(second.id).toBe('test');
    });
  });

  // ─── get ──────────────────────────────────────────────────────

  describe('get', () => {
    it('should return the process by ID', () => {
      pm.spawn({ id: 'test', command: 'sleep', args: ['10'] });
      expect(pm.get('test')).toBeDefined();
      expect(pm.get('test')?.id).toBe('test');
    });

    it('should return undefined for unknown ID', () => {
      expect(pm.get('nonexistent')).toBeUndefined();
    });
  });

  describe('killAll', () => {
    it('should kill all running processes', async () => {
      const a = pm.spawn({ id: 'a', command: 'sleep', args: ['60'] });
      const b = pm.spawn({ id: 'b', command: 'sleep', args: ['60'] });
      pm.killAll();
      await waitFor(
        () => {
          expect(a.running).toBe(false);
          expect(b.running).toBe(false);
        },
        { timeout: 2000 },
      );
    });
  });

  // ─── output buffering ──────────────────────────────────────────

  describe('output buffering', () => {
    it('should buffer stdout', async () => {
      const proc = pm.spawn({ id: 'test', command: 'echo', args: ['hello world'] });
      await waitFor(() => expect(proc.running).toBe(false), { timeout: 2000 });
      expect(proc.readStdout()).toContain('hello world');
      expect(proc.stdoutLineCount).toBeGreaterThan(0);
    });

    it('should buffer stderr', async () => {
      const proc = pm.spawn({ id: 'test', command: 'bash', args: ['-c', 'echo error >&2'] });
      await waitFor(() => expect(proc.running).toBe(false), { timeout: 2000 });
      expect(proc.readStderr()).toContain('error');
      expect(proc.stderrLineCount).toBeGreaterThan(0);
    });

    it('should support tail option', async () => {
      const proc = pm.spawn({
        id: 'test',
        command: 'bash',
        args: ['-c', 'echo line1; echo line2; echo line3'],
      });
      await waitFor(() => expect(proc.running).toBe(false), { timeout: 2000 });
      const tailed = proc.readStdout({ tail: 2 });
      expect(tailed).toBe('line2\nline3');
    });

    it('should support clear option', async () => {
      const proc = pm.spawn({ id: 'test', command: 'echo', args: ['hello'] });
      await waitFor(() => expect(proc.running).toBe(false), { timeout: 2000 });
      expect(proc.readStdout()).toContain('hello');
      proc.readStdout({ clear: true });
      expect(proc.readStdout()).toBe('');
      expect(proc.stdoutLineCount).toBe(0);
    });
  });

  // ─── exit tracking ─────────────────────────────────────────────

  describe('exit tracking', () => {
    it('should track exit code on success', async () => {
      const proc = pm.spawn({ id: 'test', command: 'true' });
      await waitFor(() => expect(proc.running).toBe(false), { timeout: 2000 });
      expect(proc.exitCode).toBe(0);
    });

    it('should track exit code on failure', async () => {
      const proc = pm.spawn({ id: 'test', command: 'false' });
      await waitFor(() => expect(proc.running).toBe(false), { timeout: 2000 });
      expect(proc.exitCode).toBe(1);
    });

    it('should track exit signal on kill', async () => {
      const proc = pm.spawn({ id: 'test', command: 'sleep', args: ['60'] });
      proc.kill('SIGKILL');
      await waitFor(() => expect(proc.running).toBe(false), { timeout: 2000 });
      expect(proc.exitSignal).toBe('SIGKILL');
    });
  });

  // ─── callbacks ─────────────────────────────────────────────────

  describe('callbacks', () => {
    it('should call onExit handler', async () => {
      const proc = pm.spawn({ id: 'test', command: 'true' });
      const exits: Array<{ code: number | null; signal: string | null }> = [];
      proc.onExit((code, signal) => exits.push({ code, signal }));
      await waitFor(() => expect(exits).toHaveLength(1), { timeout: 2000 });
      expect(exits[0]?.code).toBe(0);
    });
  });

  // ─── info ──────────────────────────────────────────────────────

  describe('info', () => {
    it('should return correct info for running process', () => {
      const proc = pm.spawn({ id: 'test', command: 'sleep', args: ['60'] });
      const info = proc.info;
      expect(info.id).toBe('test');
      expect(info.running).toBe(true);
      expect(info.pid).toBeDefined();
      expect(info.exitCode).toBeNull();
    });

    it('should return correct info for exited process', async () => {
      const proc = pm.spawn({ id: 'test', command: 'bash', args: ['-c', 'exit 42'] });
      await waitFor(() => expect(proc.running).toBe(false), { timeout: 2000 });
      const info = proc.info;
      expect(info.running).toBe(false);
      expect(info.exitCode).toBe(42);
    });
  });

  // ─── error handling ────────────────────────────────────────────

  describe('error handling', () => {
    it('should handle spawn failure for nonexistent command', async () => {
      const proc = pm.spawn({ id: 'test', command: 'nonexistent-command-that-does-not-exist' });
      await waitFor(() => expect(proc.running).toBe(false), { timeout: 2000 });
      expect(proc.exitCode).not.toBeNull();
      expect(proc.readStderr()).toContain('spawn error');
    });
  });
});
