/**
 * Background process manager.
 *
 * Manages long-lived child processes with lifecycle control, output buffering,
 * and exit tracking. Framework-independent — no pi/sandpiper imports: the caller
 * supplies the output buffers.
 *
 * Consumers register callbacks for exit events and can read
 * buffered output on demand.
 */

import { type ChildProcess, spawn as nodeSpawn, type SpawnOptionsWithoutStdio } from 'node:child_process';

// ─── Types ──────────────────────────────────────────────────────

export interface SpawnOptions {
  /** Unique identifier for this process. */
  readonly id: string;
  /** Command to execute. */
  readonly command: string;
  /** Command arguments. */
  readonly args?: readonly string[];
  /** Working directory. */
  readonly cwd?: string;
}

export interface ReadOutputOptions {
  /** Only return the last N lines. */
  readonly tail?: number;
  /** Start a fresh buffer for the stream after reading. */
  readonly clear?: boolean;
}

export type ProcessOutputStream = 'stdout' | 'stderr';

/** Holds one stream's output. Pi's OutputAccumulator has this shape. */
export interface ProcessOutputBuffer {
  append(data: Buffer): void;
  finish(): void;
  snapshot(): {
    readonly content: string;
    readonly truncation: { readonly truncated: boolean; readonly totalLines: number; readonly totalBytes: number };
    readonly fullOutputPath?: string;
  };
  closeTempFile(): Promise<void>;
}

export type CreateProcessOutputBuffer = (processId: string, stream: ProcessOutputStream) => ProcessOutputBuffer;

export interface ProcessManagerOptions {
  readonly createOutputBuffer: CreateProcessOutputBuffer;
}

export interface ProcessOutput {
  /** The buffered tail of the stream, without a final newline. */
  readonly text: string;
  readonly totalLines: number;
  readonly totalBytes: number;
  /** Whether `text` leaves out earlier output. */
  readonly truncated: boolean;
  /** File holding the complete stream, once it outgrew the buffer. */
  readonly fullOutputPath?: string;
}

export interface ProcessInfo {
  readonly id: string;
  readonly pid: number | undefined;
  readonly running: boolean;
  readonly exitCode: number | null;
  readonly exitSignal: string | null;
}

// ─── ManagedProcess ─────────────────────────────────────────────

type ExitHandler = (code: number | null, signal: string | null) => void;

export class ManagedProcess {
  readonly id: string;
  private process: ChildProcess | null = null;
  private _exitCode: number | null = null;
  private _exitSignal: string | null = null;
  private _running = false;

  private readonly createOutputBuffer: CreateProcessOutputBuffer;
  private stdoutBuffer: ProcessOutputBuffer;
  private stderrBuffer: ProcessOutputBuffer;

  private exitHandlers: ExitHandler[] = [];

  constructor(id: string, createOutputBuffer: CreateProcessOutputBuffer) {
    this.id = id;
    this.createOutputBuffer = createOutputBuffer;
    this.stdoutBuffer = createOutputBuffer(id, 'stdout');
    this.stderrBuffer = createOutputBuffer(id, 'stderr');
  }

  get pid(): number | undefined {
    return this.process?.pid;
  }

  get running(): boolean {
    return this._running;
  }

  get exitCode(): number | null {
    return this._exitCode;
  }

  get exitSignal(): string | null {
    return this._exitSignal;
  }

  get info(): ProcessInfo {
    return {
      id: this.id,
      pid: this.pid,
      running: this._running,
      exitCode: this._exitCode,
      exitSignal: this._exitSignal,
    };
  }

  /** Register an exit handler. */
  onExit(handler: ExitHandler): void {
    this.exitHandlers.push(handler);
  }

  /** Read buffered stdout. */
  readStdout(options?: ReadOutputOptions): ProcessOutput {
    const output = readOutput(this.stdoutBuffer, options);
    if (options?.clear) this.stdoutBuffer = this.replaceBuffer(this.stdoutBuffer, 'stdout');
    return output;
  }

  /** Read buffered stderr. */
  readStderr(options?: ReadOutputOptions): ProcessOutput {
    const output = readOutput(this.stderrBuffer, options);
    if (options?.clear) this.stderrBuffer = this.replaceBuffer(this.stderrBuffer, 'stderr');
    return output;
  }

  /** Kill the process. */
  kill(signal: NodeJS.Signals = 'SIGTERM'): void {
    if (this.process && this._running) {
      this.process.kill(signal);
    }
  }

  /**
   * Start the process. Called by ProcessManager — not intended for direct use.
   * @internal
   */
  _start(options: SpawnOptions): void {
    if (this._running) return;

    const args = [...(options.args ?? [])];
    const spawnOpts: SpawnOptionsWithoutStdio = {
      cwd: options.cwd,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    };
    const proc = nodeSpawn(options.command, args, spawnOpts);

    this.process = proc;
    this._running = true;

    proc.stdout?.on('data', (data: Buffer) => {
      this.stdoutBuffer.append(data);
    });

    proc.stderr?.on('data', (data: Buffer) => {
      this.stderrBuffer.append(data);
    });

    proc.on('close', (code, signal) => {
      void this.settle(code, signal);
    });

    // A spawn failure emits 'error' and then 'close' with the negative error number, so 'close' alone reports the exit.
    proc.on('error', (err) => {
      this.stderrBuffer.append(Buffer.from(`spawn error: ${err.message}\n`));
    });
  }

  // The exit handlers notify the model, which may then read a full-output file, so the files are
  // flushed first.
  private async settle(code: number | null, signal: string | null): Promise<void> {
    this.stdoutBuffer.finish();
    this.stderrBuffer.finish();
    await Promise.allSettled([this.stdoutBuffer.closeTempFile(), this.stderrBuffer.closeTempFile()]);
    this._running = false;
    this._exitCode = code;
    this._exitSignal = signal;
    this.process = null;
    for (const handler of this.exitHandlers) handler(code, signal);
  }

  private replaceBuffer(buffer: ProcessOutputBuffer, stream: ProcessOutputStream): ProcessOutputBuffer {
    if (this._running) {
      buffer.finish();
      void buffer.closeTempFile().catch(() => {});
      return this.createOutputBuffer(this.id, stream);
    }
    // After the exit the old buffer is already finished and closed.
    const fresh = this.createOutputBuffer(this.id, stream);
    fresh.finish();
    return fresh;
  }
}

function readOutput(buffer: ProcessOutputBuffer, options?: ReadOutputOptions): ProcessOutput {
  const { content, truncation, fullOutputPath } = buffer.snapshot();
  const text = content.endsWith('\n') ? content.slice(0, -1) : content;
  return {
    text: options?.tail ? text.split('\n').slice(-options.tail).join('\n') : text,
    totalLines: truncation.totalLines,
    totalBytes: truncation.totalBytes,
    truncated: truncation.truncated,
    ...(fullOutputPath === undefined ? {} : { fullOutputPath }),
  };
}

// ─── ProcessManager ─────────────────────────────────────────────

export class ProcessManager {
  private processes = new Map<string, ManagedProcess>();
  private readonly createOutputBuffer: CreateProcessOutputBuffer;

  constructor(options: ProcessManagerOptions) {
    this.createOutputBuffer = options.createOutputBuffer;
  }

  /**
   * Spawn a new managed process. Throws if a process with this ID is still running.
   * If a prior process with this ID has already exited, its entry is replaced —
   * exit (however it happened, including an external kill) always frees the ID
   * for reuse.
   */
  spawn(options: SpawnOptions): ManagedProcess {
    if (this.processes.get(options.id)?.running) {
      throw new Error(`Process "${options.id}" is already running. Wait for it to exit or use a different ID.`);
    }

    const managed = new ManagedProcess(options.id, this.createOutputBuffer);
    this.processes.set(options.id, managed);
    managed._start(options);
    return managed;
  }

  /** Get a managed process by ID. */
  get(id: string): ManagedProcess | undefined {
    return this.processes.get(id);
  }

  /** Kill all managed processes. */
  killAll(signal?: NodeJS.Signals): void {
    for (const proc of this.processes.values()) {
      proc.kill(signal);
    }
  }
}
