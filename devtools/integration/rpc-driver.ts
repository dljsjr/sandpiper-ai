// RPC-mode (`--mode rpc`) driver for multi-turn/stateful/streaming assertions. See
// .sandpiper/docs/specs/agent-249-headless-cli-integration-harness-design.md for the full RPC
// grounding this driver implements against.
//
// Framing note (docs/rpc.md): RPC mode uses strict JSONL with LF as the only record
// delimiter. Node's `readline` is explicitly NOT protocol-compliant here (it also splits on
// U+2028/U+2029, which are valid inside JSON strings) -- this driver splits stdout on '\n'
// itself rather than reaching for `readline`.
//
// message_update is delta-only as of 0.84.0 (no cumulative `message`, no
// `assistantMessageEvent.partial`): this driver buffers text deltas by `contentIndex` for
// callers that want to observe streaming, but `message_end.message` is what
// `waitForAssistantText`/tool-result helpers treat as ground truth -- never the buffered
// deltas alone.

import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { type IsolatedSpawnOptions, prepareIsolatedSpawn } from './harness.js';

export interface RpcCommand {
  readonly type: string;
  readonly id?: string;
  readonly [key: string]: unknown;
}

export interface RpcResponse {
  readonly type: 'response';
  readonly command: string;
  readonly success: boolean;
  readonly id?: string;
  readonly data?: unknown;
  readonly error?: string;
}

export interface RpcEvent {
  readonly type: string;
  readonly [key: string]: unknown;
}

export interface StartRpcSessionOptions extends Omit<IsolatedSpawnOptions, 'args'> {
  readonly extraArgs?: readonly string[];
  /** How long to wait for a command's matching response before rejecting. */
  readonly commandTimeoutMs?: number;
}

export interface RpcSession {
  /** Send a command and resolve with its correlated response. Auto-assigns an `id` if the
   * command doesn't supply one. */
  readonly sendCommand: (command: RpcCommand) => Promise<RpcResponse>;
  /** Every event observed so far, in arrival order (commands' own `response` frames are not
   * included -- use sendCommand's return value for those). */
  readonly events: readonly RpcEvent[];
  /** Resolve with the next event matching `predicate`, or reject on timeout. Scans
   * already-buffered events first, then waits for new ones. */
  readonly waitForEvent: (predicate: (event: RpcEvent) => boolean, timeoutMs?: number) => Promise<RpcEvent>;
  /** Text assembled so far for a given assistant-message contentIndex, from message_update
   * text deltas. For assertions that need the authoritative final text, prefer waiting for
   * message_end and reading its message.content directly -- this is for tests that want to
   * observe streaming shape itself. */
  readonly bufferedText: (contentIndex: number) => string;
  /** Terminate the child process and stop reading its output. */
  readonly close: () => Promise<void>;
}

const DEFAULT_COMMAND_TIMEOUT_MS = 15_000;
const DEFAULT_EVENT_TIMEOUT_MS = 15_000;

function isResponse(value: unknown): value is RpcResponse {
  return typeof value === 'object' && value !== null && (value as { type?: unknown }).type === 'response';
}

/**
 * Spawn pi/sandpiper in RPC mode and return a session for sending commands and observing
 * events. The child's stdout is split strictly on '\n' (see the framing note above), and each
 * parsed line is dispatched either to a pending command's promise (via `id` correlation) or
 * appended to the event log.
 */
export function startRpcSession(options: StartRpcSessionOptions): RpcSession {
  const spawnPlan = prepareIsolatedSpawn({
    ...options,
    args: ['--mode', 'rpc', ...(options.extraArgs ?? [])],
  });

  const child: ChildProcessWithoutNullStreams = spawn(spawnPlan.command, spawnPlan.args, {
    cwd: spawnPlan.cwd,
    env: spawnPlan.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const events: RpcEvent[] = [];
  const textBuffers = new Map<number, string>();
  const pendingCommands = new Map<
    string,
    { resolve: (response: RpcResponse) => void; reject: (error: Error) => void }
  >();
  const pendingEventWaiters: Array<{
    predicate: (event: RpcEvent) => boolean;
    resolve: (event: RpcEvent) => void;
    reject: (error: Error) => void;
  }> = [];

  let nextCommandId = 0;
  let stdoutBuffer = '';
  let closed = false;

  function applyMessageUpdate(event: RpcEvent): void {
    const assistantMessageEvent = event.assistantMessageEvent as
      | { type?: string; contentIndex?: number; delta?: string }
      | undefined;
    if (!assistantMessageEvent || typeof assistantMessageEvent.contentIndex !== 'number') {
      return;
    }
    if (assistantMessageEvent.type === 'text_start') {
      textBuffers.set(assistantMessageEvent.contentIndex, '');
    } else if (assistantMessageEvent.type === 'text_delta' && typeof assistantMessageEvent.delta === 'string') {
      const existing = textBuffers.get(assistantMessageEvent.contentIndex) ?? '';
      textBuffers.set(assistantMessageEvent.contentIndex, existing + assistantMessageEvent.delta);
    }
  }

  function dispatchLine(line: string): void {
    if (line.length === 0) {
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      throw new Error(
        `RPC session received a non-JSON line: ${line} (${error instanceof Error ? error.message : String(error)})`,
      );
    }

    if (isResponse(parsed)) {
      const id = parsed.id;
      const pending = id !== undefined ? pendingCommands.get(id) : undefined;
      if (pending) {
        pendingCommands.delete(id as string);
        pending.resolve(parsed);
      }
      return;
    }

    const event = parsed as RpcEvent;
    events.push(event);
    if (event.type === 'message_update') {
      applyMessageUpdate(event);
    }

    for (let index = pendingEventWaiters.length - 1; index >= 0; index -= 1) {
      const waiter = pendingEventWaiters[index];
      if (waiter?.predicate(event)) {
        pendingEventWaiters.splice(index, 1);
        waiter.resolve(event);
      }
    }
  }

  child.stdout.setEncoding('utf-8');
  child.stdout.on('data', (chunk: string) => {
    stdoutBuffer += chunk;
    let newlineIndex = stdoutBuffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = stdoutBuffer.slice(0, newlineIndex).replace(/\r$/, '');
      stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
      dispatchLine(line);
      newlineIndex = stdoutBuffer.indexOf('\n');
    }
  });

  const stderrChunks: string[] = [];
  child.stderr.setEncoding('utf-8');
  child.stderr.on('data', (chunk: string) => {
    stderrChunks.push(chunk);
  });

  child.on('exit', () => {
    closed = true;
    const exitError = new Error(`RPC session process exited. stderr: ${stderrChunks.join('')}`);
    for (const pending of pendingCommands.values()) {
      pending.reject(exitError);
    }
    pendingCommands.clear();
    for (const waiter of pendingEventWaiters.splice(0)) {
      waiter.reject(exitError);
    }
  });

  const sendCommand: RpcSession['sendCommand'] = (command) => {
    if (closed) {
      return Promise.reject(new Error('RPC session process has already exited'));
    }
    const id = command.id ?? `integration-cmd-${nextCommandId++}`;
    const withId = { ...command, id };

    return new Promise<RpcResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingCommands.delete(id);
        reject(new Error(`RPC command ${JSON.stringify(withId)} timed out waiting for a response`));
      }, options.commandTimeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS);

      pendingCommands.set(id, {
        resolve: (response) => {
          clearTimeout(timeout);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      child.stdin.write(`${JSON.stringify(withId)}\n`);
    });
  };

  const waitForEvent: RpcSession['waitForEvent'] = (predicate, timeoutMs) => {
    const alreadySeen = events.find(predicate);
    if (alreadySeen) {
      return Promise.resolve(alreadySeen);
    }
    if (closed) {
      return Promise.reject(new Error('RPC session process has already exited'));
    }

    return new Promise<RpcEvent>((resolve, reject) => {
      const waiter = {
        predicate,
        resolve: (event: RpcEvent) => {
          clearTimeout(timeout);
          resolve(event);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
      };
      const timeout = setTimeout(() => {
        const waiterIndex = pendingEventWaiters.indexOf(waiter);
        if (waiterIndex !== -1) {
          pendingEventWaiters.splice(waiterIndex, 1);
        }
        reject(new Error('Timed out waiting for a matching RPC event'));
      }, timeoutMs ?? DEFAULT_EVENT_TIMEOUT_MS);
      pendingEventWaiters.push(waiter);
    });
  };

  const close: RpcSession['close'] = () => {
    if (closed) {
      spawnPlan.cleanup();
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      child.once('exit', () => {
        spawnPlan.cleanup();
        resolve();
      });
      child.kill();
    });
  };

  return {
    sendCommand,
    events,
    waitForEvent,
    bufferedText: (contentIndex: number) => textBuffers.get(contentIndex) ?? '',
    close,
  };
}
