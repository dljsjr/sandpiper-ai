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
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import type { ProcessManager } from 'sandpiper-ai-core';
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
  pi: Pick<ExtensionAPI, 'registerTool'>;
  tools: CapturedTool[];
} {
  const tools: CapturedTool[] = [];
  return {
    pi: {
      registerTool: ((tool: CapturedTool) => {
        tools.push(tool);
      }) as ExtensionAPI['registerTool'],
    },
    tools,
  };
}

// ─── Event handler stubs ─────────────────────────────────────────

export function createEventStub(): {
  pi: Pick<ExtensionAPI, 'on'>;
  handlers: Map<string, AnyHandler>;
} {
  const handlers = new Map<string, AnyHandler>();
  return {
    pi: {
      on: ((event: string, handler: AnyHandler) => {
        handlers.set(event, handler);
      }) as ExtensionAPI['on'],
    },
    handlers,
  };
}

// ─── Diagnostics hooks stub (on + events) ────────────────────────

export function createDiagnosticsStub(): {
  pi: Pick<ExtensionAPI, 'on' | 'events'>;
  handlers: Map<string, AnyHandler>;
} {
  const handlers = new Map<string, AnyHandler>();
  return {
    pi: {
      on: ((event: string, handler: AnyHandler) => {
        handlers.set(event, handler);
      }) as ExtensionAPI['on'],
      events: {
        on: vi.fn(),
        emit: vi.fn(),
      } as unknown as ExtensionAPI['events'],
    },
    handlers,
  };
}

// ─── Migration controls stub ─────────────────────────────────────

interface CapturedCommand {
  readonly name: string;
  readonly handler: (
    args: string | undefined,
    ctx: {
      cwd: string;
      reload: () => Promise<void>;
      ui: { notify: (...args: unknown[]) => void; setWidget: (...args: unknown[]) => void };
    },
  ) => Promise<void>;
}

export function createMigrationControlsStub(flags: Record<string, boolean | string | undefined> = {}): {
  pi: Pick<ExtensionAPI, 'registerFlag' | 'registerCommand' | 'on' | 'getFlag'>;
  commands: CapturedCommand[];
  events: Map<string, AnyHandler>;
} {
  const commands: CapturedCommand[] = [];
  const events = new Map<string, AnyHandler>();
  return {
    pi: {
      registerFlag: vi.fn() as ExtensionAPI['registerFlag'],
      registerCommand: ((name: string, def: Record<string, unknown>) => {
        commands.push({ name, ...def } as unknown as CapturedCommand);
      }) as ExtensionAPI['registerCommand'],
      on: ((event: string, handler: AnyHandler) => {
        events.set(event, handler);
      }) as ExtensionAPI['on'],
      getFlag: ((name: string) => flags[name]) as ExtensionAPI['getFlag'],
    },
    commands,
    events,
  };
}

// ─── Process manager stubs ───────────────────────────────────────

export function createProcessManagerStub(
  overrides: { spawn?: (...args: unknown[]) => unknown; get?: (...args: unknown[]) => unknown } = {},
): Pick<ProcessManager, 'spawn' | 'get'> {
  return {
    spawn: (overrides.spawn ?? vi.fn(() => ({ pid: 1234 }))) as ProcessManager['spawn'],
    get: (overrides.get ?? vi.fn(() => undefined)) as ProcessManager['get'],
  };
}

export function createBackgroundContextProcessManagerStub(
  overrides: {
    getCompletedUnacknowledged?: () => unknown[];
    acknowledge?: (id: string) => void;
    killAll?: () => void;
  } = {},
): Pick<ProcessManager, 'getCompletedUnacknowledged' | 'acknowledge' | 'killAll'> {
  return {
    getCompletedUnacknowledged: (overrides.getCompletedUnacknowledged ??
      vi.fn(() => [])) as ProcessManager['getCompletedUnacknowledged'],
    acknowledge: (overrides.acknowledge ?? vi.fn()) as ProcessManager['acknowledge'],
    killAll: (overrides.killAll ?? vi.fn()) as ProcessManager['killAll'],
  };
}
