import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ManagedProcess, ProcessManager } from './process-manager.js';

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

    it('should throw if ID is already in use', () => {
      pm.spawn({ id: 'test', command: 'sleep', args: ['10'] });
      expect(() => pm.spawn({ id: 'test', command: 'echo' })).toThrow('already exists');
    });

    it('should allow reuse of ID after process is removed', () => {
      pm.spawn({ id: 'test', command: 'echo', args: ['hello'] });
      pm.remove('test');
      const reused = pm.spawn({ id: 'test', command: 'echo', args: ['world'] });
      expect(reused.id).toBe('test');
    });
  });

  // ─── get / list / kill ──────────────────────────────────────────

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

  describe('list', () => {
    it('should return all process infos', () => {
      pm.spawn({ id: 'a', command: 'sleep', args: ['10'] });
      pm.spawn({ id: 'b', command: 'sleep', args: ['10'] });
      const infos = pm.list();
      expect(infos).toHaveLength(2);
      expect(infos.map((i) => i.id).sort()).toEqual(['a', 'b']);
    });

    it('should return empty array when no processes', () => {
      expect(pm.list()).toHaveLength(0);
    });
  });

  describe('kill', () => {
    it('should kill a running process', async () => {
      const proc = pm.spawn({ id: 'test', command: 'sleep', args: ['60'] });
      expect(proc.running).toBe(true);
      pm.kill('test');
      // Wait for exit
      await vi.waitFor(() => expect(proc.running).toBe(false), { timeout: 2000 });
    });

    it('should be safe to kill an unknown ID', () => {
      expect(() => pm.kill('nonexistent')).not.toThrow();
    });
  });

  describe('killAll', () => {
    it('should kill all running processes', async () => {
      const a = pm.spawn({ id: 'a', command: 'sleep', args: ['60'] });
      const b = pm.spawn({ id: 'b', command: 'sleep', args: ['60'] });
      pm.killAll();
      await vi.waitFor(
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
      await vi.waitFor(() => expect(proc.running).toBe(false), { timeout: 2000 });
      expect(proc.readStdout()).toContain('hello world');
      expect(proc.stdoutLineCount).toBeGreaterThan(0);
    });

    it('should buffer stderr', async () => {
      const proc = pm.spawn({ id: 'test', command: 'bash', args: ['-c', 'echo error >&2'] });
      await vi.waitFor(() => expect(proc.running).toBe(false), { timeout: 2000 });
      expect(proc.readStderr()).toContain('error');
      expect(proc.stderrLineCount).toBeGreaterThan(0);
    });

    it('should support tail option', async () => {
      const proc = pm.spawn({
        id: 'test',
        command: 'bash',
        args: ['-c', 'echo line1; echo line2; echo line3'],
      });
      await vi.waitFor(() => expect(proc.running).toBe(false), { timeout: 2000 });
      const tailed = proc.readStdout({ tail: 2 });
      expect(tailed).toBe('line2\nline3');
    });

    it('should support clear option', async () => {
      const proc = pm.spawn({ id: 'test', command: 'echo', args: ['hello'] });
      await vi.waitFor(() => expect(proc.running).toBe(false), { timeout: 2000 });
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
      await vi.waitFor(() => expect(proc.running).toBe(false), { timeout: 2000 });
      expect(proc.exitCode).toBe(0);
    });

    it('should track exit code on failure', async () => {
      const proc = pm.spawn({ id: 'test', command: 'false' });
      await vi.waitFor(() => expect(proc.running).toBe(false), { timeout: 2000 });
      expect(proc.exitCode).toBe(1);
    });

    it('should track exit signal on kill', async () => {
      const proc = pm.spawn({ id: 'test', command: 'sleep', args: ['60'] });
      proc.kill('SIGKILL');
      await vi.waitFor(() => expect(proc.running).toBe(false), { timeout: 2000 });
      expect(proc.exitSignal).toBe('SIGKILL');
    });
  });

  // ─── callbacks ─────────────────────────────────────────────────

  describe('callbacks', () => {
    it('should call onStdout handler', async () => {
      const proc = pm.spawn({ id: 'test', command: 'echo', args: ['callback-test'] });
      const chunks: string[] = [];
      proc.onStdout((data) => chunks.push(data.toString()));
      await vi.waitFor(() => expect(proc.running).toBe(false), { timeout: 2000 });
      expect(chunks.join('')).toContain('callback-test');
    });

    it('should call onExit handler', async () => {
      const proc = pm.spawn({ id: 'test', command: 'true' });
      const exits: Array<{ code: number | null; signal: string | null }> = [];
      proc.onExit((code, signal) => exits.push({ code, signal }));
      await vi.waitFor(() => expect(exits).toHaveLength(1), { timeout: 2000 });
      expect(exits[0]?.code).toBe(0);
    });
  });

  // ─── acknowledgment ────────────────────────────────────────────

  describe('acknowledgment', () => {
    it('should report completed unacknowledged processes', async () => {
      const proc = pm.spawn({ id: 'test', command: 'true' });
      await vi.waitFor(() => expect(proc.running).toBe(false), { timeout: 2000 });
      const unacked = pm.getCompletedUnacknowledged();
      expect(unacked).toHaveLength(1);
      expect(unacked[0]?.id).toBe('test');
    });

    it('should not report acknowledged processes', async () => {
      const proc = pm.spawn({ id: 'test', command: 'true' });
      await vi.waitFor(() => expect(proc.running).toBe(false), { timeout: 2000 });
      pm.acknowledge('test');
      expect(pm.getCompletedUnacknowledged()).toHaveLength(0);
    });

    it('should not report running processes', () => {
      pm.spawn({ id: 'test', command: 'sleep', args: ['60'] });
      expect(pm.getCompletedUnacknowledged()).toHaveLength(0);
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
      await vi.waitFor(() => expect(proc.running).toBe(false), { timeout: 2000 });
      const info = proc.info;
      expect(info.running).toBe(false);
      expect(info.exitCode).toBe(42);
    });
  });

  // ─── error handling ────────────────────────────────────────────

  describe('error handling', () => {
    it('should handle spawn failure for nonexistent command', async () => {
      const proc = pm.spawn({ id: 'test', command: 'nonexistent-command-that-does-not-exist' });
      await vi.waitFor(() => expect(proc.running).toBe(false), { timeout: 2000 });
      expect(proc.exitCode).not.toBeNull();
      expect(proc.readStderr()).toContain('spawn error');
    });
  });
});
