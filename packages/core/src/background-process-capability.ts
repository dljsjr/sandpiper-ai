import type { ProcessInfo, ProcessManager, ProcessOutput } from './process-manager.js';

export interface StartBackgroundProcessRequest {
  readonly id: string;
  readonly command: string;
  readonly args?: readonly string[];
  readonly cwd?: string;
}

export type StartBackgroundProcessResult =
  | { readonly ok: true; readonly process: ProcessInfo }
  | { readonly ok: false; readonly error: string };

export interface CheckBackgroundProcessRequest {
  readonly id: string;
  readonly includeStdout?: boolean;
  readonly includeStderr?: boolean;
  readonly tailLines?: number;
  readonly clearBuffer?: boolean;
}

export type CheckBackgroundProcessResult =
  | {
      readonly found: true;
      readonly process: ProcessInfo;
      readonly stdout?: ProcessOutput;
      readonly stderr?: ProcessOutput;
    }
  | { readonly found: false; readonly id: string };

export interface StopBackgroundProcessRequest {
  readonly id: string;
  readonly signal: NodeJS.Signals;
  /** How long to wait for the process to exit after the signal. */
  readonly timeoutMs: number;
}

export type StopBackgroundProcessResult =
  | {
      readonly found: true;
      /** Whether the process was running when the stop was requested; only then is it signalled. */
      readonly wasRunning: boolean;
      /** Whether the process has exited by the time the result returns. */
      readonly exited: boolean;
      readonly process: ProcessInfo;
    }
  | { readonly found: false; readonly id: string };

export function startBackgroundProcess(
  processManager: ProcessManager,
  request: StartBackgroundProcessRequest,
): StartBackgroundProcessResult {
  try {
    const process = processManager.spawn({
      id: request.id,
      command: request.command,
      args: request.args,
      cwd: request.cwd,
    });

    return { ok: true, process: process.info };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function checkBackgroundProcess(
  processManager: ProcessManager,
  request: CheckBackgroundProcessRequest,
): CheckBackgroundProcessResult {
  const process = processManager.get(request.id);
  if (process === undefined) {
    return { found: false, id: request.id };
  }

  const readOptions = { tail: request.tailLines, clear: request.clearBuffer };

  return {
    found: true,
    process: process.info,
    stdout: request.includeStdout ? process.readStdout(readOptions) : undefined,
    stderr: request.includeStderr ? process.readStderr(readOptions) : undefined,
  };
}

export async function stopBackgroundProcess(
  processManager: ProcessManager,
  request: StopBackgroundProcessRequest,
): Promise<StopBackgroundProcessResult> {
  const process = processManager.get(request.id);
  if (process === undefined) {
    return { found: false, id: request.id };
  }
  if (!process.running) {
    return { found: true, wasRunning: false, exited: true, process: process.info };
  }

  const exited = new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), request.timeoutMs);
    process.onExit(() => {
      clearTimeout(timer);
      resolve(true);
    });
  });
  process.kill(request.signal);
  return { found: true, wasRunning: true, exited: await exited, process: process.info };
}
