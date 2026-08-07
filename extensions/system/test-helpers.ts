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
  readonly constrainedSampling?: unknown;
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

// ─── Diagnostics hooks stub (on + events + entries) ──────────────

type AnyEntryRenderer = (
  entry: { readonly data?: unknown },
  options: { readonly expanded: boolean },
  theme: unknown,
) => unknown;

export function createDiagnosticsStub(): {
  pi: Pick<ExtensionAPI, 'on' | 'events' | 'appendEntry' | 'registerEntryRenderer'>;
  handlers: Map<string, AnyHandler>;
  entryRenderers: Map<string, AnyEntryRenderer>;
  appendedEntries: Array<{ readonly customType: string; readonly data: unknown }>;
} {
  const handlers = new Map<string, AnyHandler>();
  const entryRenderers = new Map<string, AnyEntryRenderer>();
  const appendedEntries: Array<{ readonly customType: string; readonly data: unknown }> = [];
  return {
    pi: {
      on: ((event: string, handler: AnyHandler) => {
        handlers.set(event, handler);
      }) as ExtensionAPI['on'],
      events: {
        on: vi.fn(),
        emit: vi.fn(),
      } as unknown as ExtensionAPI['events'],
      appendEntry: ((customType: string, data?: unknown) => {
        appendedEntries.push({ customType, data });
      }) as ExtensionAPI['appendEntry'],
      registerEntryRenderer: ((customType: string, renderer: AnyEntryRenderer) => {
        entryRenderers.set(customType, renderer);
      }) as ExtensionAPI['registerEntryRenderer'],
    },
    handlers,
    entryRenderers,
    appendedEntries,
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
