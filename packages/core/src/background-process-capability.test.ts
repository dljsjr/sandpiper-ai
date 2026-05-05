import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  checkBackgroundProcess,
  collectCompletedBackgroundProcessNotifications,
  startBackgroundProcess,
} from './background-process-capability.js';
import { ProcessManager } from './process-manager.js';

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

describe('background process capability operations', () => {
  let processManager: ProcessManager;

  beforeEach(() => {
    processManager = new ProcessManager();
  });

  afterEach(() => {
    processManager.killAll();
  });

  it('starts a background process through the package-owned operation', () => {
    const result = startBackgroundProcess(processManager, {
      id: 'server',
      command: 'sleep',
      args: ['60'],
      cwd: '/tmp',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.process.id).toBe('server');
      expect(result.process.running).toBe(true);
      expect(result.process.pid).toBeDefined();
    }
  });

  it('returns a typed start failure when the process manager rejects the request', () => {
    processManager.spawn({ id: 'server', command: 'sleep', args: ['60'] });

    const result = startBackgroundProcess(processManager, {
      id: 'server',
      command: 'echo',
      args: ['duplicate'],
    });

    expect(result).toEqual({
      ok: false,
      error: 'Process "server" already exists. Kill it first or use a different ID.',
    });
  });

  it('checks process status and requested output through package-owned logic', async () => {
    const started = processManager.spawn({
      id: 'job',
      command: 'bash',
      args: ['-c', 'echo line1; echo line2; echo err >&2'],
    });
    await waitFor(() => expect(started.running).toBe(false), { timeout: 2000 });

    const result = checkBackgroundProcess(processManager, {
      id: 'job',
      includeStdout: true,
      includeStderr: true,
      tailLines: 1,
    });

    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.process.running).toBe(false);
      expect(result.stdout).toEqual({ text: 'line2', lineCount: 2 });
      expect(result.stderr).toEqual({ text: 'err', lineCount: 1 });
    }
  });

  it('returns a typed miss for an unknown process id', () => {
    const result = checkBackgroundProcess(processManager, { id: 'missing' });

    expect(result).toEqual({ found: false, id: 'missing' });
  });

  it('collects completed process notifications once', async () => {
    const started = processManager.spawn({ id: 'done', command: 'bash', args: ['-c', 'exit 7'] });
    await waitFor(() => expect(started.running).toBe(false), { timeout: 2000 });

    expect(collectCompletedBackgroundProcessNotifications(processManager)).toEqual([{ id: 'done', exitCode: 7 }]);
    expect(collectCompletedBackgroundProcessNotifications(processManager)).toEqual([]);
  });
});
