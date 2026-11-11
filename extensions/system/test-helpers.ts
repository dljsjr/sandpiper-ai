/**
 * Type-safe test stub builders for system extension tests.
 *
 * These helpers provide stubs that satisfy the ExtensionAPI / ProcessManager
 * interfaces at the narrow slices each register* function actually uses,
 * without resorting to `as never` or `as any`.
 *
 * Each builder returns the stub plus any captured state (registered tools,
 * event handlers, etc.) for assertion purposes.
 */
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { ProcessInfo, ProcessManager } from 'sandpiper-ai-core';
import { vi } from 'vitest';

// ─── Common handler types ────────────────────────────────────────

type AnyHandler = (...args: readonly unknown[]) => unknown;

// ─── Tool registration stubs ─────────────────────────────────────

export interface CapturedTool {
  readonly name: string;
  readonly execute: (...args: unknown[]) => Promise<{
    content: Array<{ type: 'text'; text: string }>;
    details: Record<string, unknown>;
    isError?: boolean;
  }>;
}

export function createToolRegistrationStub(): {
  pi: Pick<ExtensionAPI, 'registerTool' | 'sendMessage'>;
  tools: CapturedTool[];
  sendMessage: ReturnType<typeof vi.fn>;
} {
  const tools: CapturedTool[] = [];
  const sendMessage = vi.fn();
  return {
    pi: {
      registerTool: ((tool: CapturedTool) => {
        tools.push(tool);
      }) as ExtensionAPI['registerTool'],
      sendMessage: sendMessage as ExtensionAPI['sendMessage'],
    },
    tools,
    sendMessage,
  };
}

// ─── Event handler stubs ─────────────────────────────────────────

export function createEventStub(flags: Record<string, boolean | string | undefined> = {}): {
  pi: Pick<ExtensionAPI, 'getFlag' | 'on' | 'registerFlag'>;
  handlers: Map<string, AnyHandler>;
} {
  const handlers = new Map<string, AnyHandler>();
  return {
    pi: {
      getFlag: ((name: string) => flags[name]) as ExtensionAPI['getFlag'],
      on: ((event: string, handler: AnyHandler) => {
        handlers.set(event, handler);
      }) as ExtensionAPI['on'],
      registerFlag: vi.fn() as ExtensionAPI['registerFlag'],
    },
    handlers,
  };
}

// ─── Process manager stubs ───────────────────────────────────────

function createManagedProcessStub(info: ProcessInfo): ReturnType<ProcessManager['spawn']> {
  return {
    id: info.id,
    info,
    readStdout: vi.fn(() => ''),
    readStderr: vi.fn(() => ''),
    stdoutLineCount: 0,
    stderrLineCount: 0,
  } as unknown as ReturnType<ProcessManager['spawn']>;
}

export function createProcessManagerStub(
  overrides: { spawn?: (...args: unknown[]) => unknown; get?: (...args: unknown[]) => unknown } = {},
): Pick<ProcessManager, 'spawn' | 'get'> {
  return {
    spawn: (overrides.spawn ??
      vi.fn((options: Parameters<ProcessManager['spawn']>[0]) =>
        createManagedProcessStub({
          id: options.id,
          pid: 1234,
          running: true,
          exitCode: null,
          exitSignal: null,
        }),
      )) as ProcessManager['spawn'],
    get: (overrides.get ?? vi.fn(() => undefined)) as ProcessManager['get'],
  };
}

export function createBackgroundLifecycleProcessManagerStub(
  overrides: { killAll?: () => void } = {},
): Pick<ProcessManager, 'killAll'> {
  return {
    killAll: (overrides.killAll ?? vi.fn()) as ProcessManager['killAll'],
  };
}
