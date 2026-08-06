import { describe, expect, it, vi } from 'vitest';
import type { RelayRuntime } from '../types.js';
import { executeInspectPaneTool, executeShellRelayTool } from './operations.js';

function createRuntime(overrides: Partial<RelayRuntime> = {}): RelayRuntime {
  return {
    setup: vi.fn(async () => {}),
    teardown: vi.fn(async () => {}),
    executeQueued: vi.fn(async () => ({ output: 'hello', exitCode: 0, timedOut: false })),
    inspectPane: vi.fn(() => 'pane contents'),
    isSetUp: vi.fn(() => true),
    getStatusDetails: vi.fn(() => ({
      shell: 'bash' as const,
      paneId: 'terminal_1',
      sessionName: 'relay',
      signalPath: '/tmp/signal',
    })),
    getCurrentSessionName: vi.fn(() => 'relay'),
    getStoredSessionName: vi.fn(() => undefined),
    restoreStoredSessionFromBranch: vi.fn(),
    onSessionReady: vi.fn(async () => {}),
    onSessionSwitch: vi.fn(async () => {}),
    ...overrides,
  };
}

function createContext() {
  return { ui: { setStatus: vi.fn() } };
}

describe('executeShellRelayTool', () => {
  it('sets up the relay and executes the command with the requested timeout', async () => {
    const runtime = createRuntime();
    const result = await executeShellRelayTool(runtime, createContext(), {
      command: 'echo hello',
      timeout: 2,
      session: 'shared',
    });

    expect(runtime.setup).toHaveBeenCalledWith(expect.objectContaining({ ui: expect.anything() }), 'shared');
    expect(runtime.executeQueued).toHaveBeenCalledWith('echo hello', 2000);
    expect(result).toEqual({
      content: [{ type: 'text', text: 'hello\n\nExit code: 0' }],
      details: { output: 'hello', exitCode: 0, timedOut: false },
    });
  });

  it('renders empty command output explicitly', async () => {
    const runtime = createRuntime({
      executeQueued: vi.fn(async () => ({ output: '', exitCode: 0, timedOut: false })),
    });

    const result = await executeShellRelayTool(runtime, createContext(), { command: 'true' });

    expect(runtime.executeQueued).toHaveBeenCalledWith('true', 30_000);
    expect(result.content).toEqual([{ type: 'text', text: '(no output)\n\nExit code: 0' }]);
  });

  it('returns setup failures as tool errors', async () => {
    const runtime = createRuntime({
      setup: vi.fn(async () => {
        throw new Error('no zellij');
      }),
    });

    const result = await executeShellRelayTool(runtime, createContext(), { command: 'whoami' });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Shell Relay setup failed: no zellij');
    expect(result.details).toEqual({ error: 'no zellij' });
  });

  it('returns execution failures as tool errors', async () => {
    const runtime = createRuntime({
      executeQueued: vi.fn(async () => {
        throw new Error('pane closed');
      }),
    });

    const result = await executeShellRelayTool(runtime, createContext(), { command: 'whoami' });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Shell Relay error: pane closed');
    expect(result.details).toEqual({ error: 'pane closed' });
  });

  it.each([
    [0, 'zero'],
    [-5, 'negative'],
    [Number.NaN, 'NaN'],
    [Number.POSITIVE_INFINITY, 'Infinity'],
  ])('rejects a %s (%s) timeout as a validation error without touching the relay', async (timeout) => {
    const runtime = createRuntime();

    const result = await executeShellRelayTool(runtime, createContext(), { command: 'whoami', timeout });

    expect(result).toEqual({
      content: [{ type: 'text', text: 'Invalid timeout: must be a finite number of seconds' }],
      details: { error: 'Invalid timeout: must be a finite number of seconds' },
      isError: true,
    });
    expect(runtime.setup).not.toHaveBeenCalled();
    expect(runtime.executeQueued).not.toHaveBeenCalled();
  });

  it('rejects a timeout large enough to overflow setTimeout instead of clamping it to an immediate timeout', async () => {
    const runtime = createRuntime();

    // Any value whose *1000 milliseconds exceeds 2^31 - 1 (setTimeout's max signed 32-bit delay).
    const result = await executeShellRelayTool(runtime, createContext(), {
      command: 'whoami',
      timeout: 2_147_484,
    });

    expect(result).toEqual({
      content: [{ type: 'text', text: 'Invalid timeout: maximum is 2147483.647 seconds' }],
      details: { error: 'Invalid timeout: maximum is 2147483.647 seconds' },
      isError: true,
    });
    expect(runtime.setup).not.toHaveBeenCalled();
    expect(runtime.executeQueued).not.toHaveBeenCalled();
  });

  it('accepts the maximum valid timeout at the boundary', async () => {
    const runtime = createRuntime();

    const result = await executeShellRelayTool(runtime, createContext(), {
      command: 'whoami',
      timeout: 2_147_483.647,
    });

    expect(result.isError).toBeUndefined();
    expect(runtime.executeQueued).toHaveBeenCalledWith('whoami', 2_147_483_647);
  });
});

describe('executeInspectPaneTool', () => {
  it('sets up the relay and returns pane contents', async () => {
    const runtime = createRuntime();
    const result = await executeInspectPaneTool(runtime, createContext(), { session: 'shared' });

    expect(runtime.setup).toHaveBeenCalledWith(expect.objectContaining({ ui: expect.anything() }), 'shared');
    expect(runtime.inspectPane).toHaveBeenCalled();
    expect(result).toEqual({
      content: [{ type: 'text', text: 'pane contents' }],
      details: { lines: 1 },
    });
  });

  it('renders an empty pane explicitly', async () => {
    const runtime = createRuntime({ inspectPane: vi.fn(() => '') });

    const result = await executeInspectPaneTool(runtime, createContext(), {});

    expect(result.content).toEqual([{ type: 'text', text: '(empty pane)' }]);
    expect(result.details).toEqual({ lines: 1 });
  });

  it('returns inspect failures as tool errors', async () => {
    const runtime = createRuntime({
      inspectPane: vi.fn(() => {
        throw new Error('pane closed');
      }),
    });

    const result = await executeInspectPaneTool(runtime, createContext(), {});

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Inspect failed: pane closed');
    expect(result.details).toEqual({ error: 'pane closed' });
  });
});
