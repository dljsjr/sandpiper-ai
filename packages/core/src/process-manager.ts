/**
 * Background process manager.
 *
 * Manages long-lived child processes with lifecycle control, output buffering,
 * and exit tracking. Framework-independent — no pi/sandpiper imports.
 *
 * Consumers register callbacks for stdout/stderr/exit events and can read
 * buffered output on demand. The manager tracks which completed processes
 * have been acknowledged (for notification deduplication).
 */

import { type ChildProcess, spawn as nodeSpawn } from 'node:child_process';

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
  /** Additional environment variables (merged with process.env). */
  readonly env?: Readonly<Record<string, string>>;
}

export interface ReadOutputOptions {
  /** Only return the last N lines. */
  readonly tail?: number;
  /** Clear the buffer after reading. */
  readonly clear?: boolean;
}

export interface ProcessInfo {
  readonly id: string;
  readonly pid: number | undefined;
  readonly running: boolean;
  readonly exitCode: number | null;
  readonly exitSignal: string | null;
}

// ─── ManagedProcess ─────────────────────────────────────────────

type DataHandler = (data: Buffer) => void;
type ExitHandler = (code: number | null, signal: string | null) => void;

export class ManagedProcess {
  readonly id: string;
  private process: ChildProcess | null = null;
  private _exitCode: number | null = null;
  private _exitSignal: string | null = null;
  private _running = false;

  private stdoutBuffer: string[] = [];
  private stderrBuffer: string[] = [];

  private stdoutHandlers: DataHandler[] = [];
  private stderrHandlers: DataHandler[] = [];
  private exitHandlers: ExitHandler[] = [];

  constructor(id: string) {
    this.id = id;
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

  /** Register a stdout data handler. */
  onStdout(handler: DataHandler): void {
    this.stdoutHandlers.push(handler);
  }

  /** Register a stderr data handler. */
  onStderr(handler: DataHandler): void {
    this.stderrHandlers.push(handler);
  }

  /** Register an exit handler. */
  onExit(handler: ExitHandler): void {
    this.exitHandlers.push(handler);
  }

  /** Read buffered stdout lines. */
  readStdout(options?: ReadOutputOptions): string {
    return this.readBuffer(this.stdoutBuffer, options);
  }

  /** Read buffered stderr lines. */
  readStderr(options?: ReadOutputOptions): string {
    return this.readBuffer(this.stderrBuffer, options);
  }

  /** Number of buffered stdout lines. */
  get stdoutLineCount(): number {
    return this.stdoutBuffer.length;
  }

  /** Number of buffered stderr lines. */
  get stderrLineCount(): number {
    return this.stderrBuffer.length;
  }

  /** Kill the process. */
  kill(signal: NodeJS.Signals = 'SIGTERM'): void {
    if (this.process && this._running) {
      this.process.kill(signal);
    }
  }

  /** Write to the process's stdin. */
  write(data: string): void {
    if (this.process?.stdin && this._running) {
      this.process.stdin.write(data);
    }
  }

  /**
   * Start the process. Called by ProcessManager — not intended for direct use.
   * @internal
   */
  _start(options: SpawnOptions): void {
    if (this._running) return;

    const proc = nodeSpawn(options.command, [...(options.args ?? [])], {
      cwd: options.cwd,
      env: options.env ? { ...process.env, ...options.env } : undefined,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.process = proc;
    this._running = true;

    proc.stdout?.on('data', (data: Buffer) => {
      this.appendToBuffer(this.stdoutBuffer, data);
      for (const handler of this.stdoutHandlers) handler(data);
    });

    proc.stderr?.on('data', (data: Buffer) => {
      this.appendToBuffer(this.stderrBuffer, data);
      for (const handler of this.stderrHandlers) handler(data);
    });

    proc.on('close', (code, signal) => {
      this._running = false;
      this._exitCode = code;
      this._exitSignal = signal;
      this.process = null;
      for (const handler of this.exitHandlers) handler(code, signal);
    });

    proc.on('error', (err) => {
      this._running = false;
      this._exitCode = 1;
      this.process = null;
      this.appendToBuffer(this.stderrBuffer, Buffer.from(`spawn error: ${err.message}\n`));
      for (const handler of this.exitHandlers) handler(1, null);
    });
  }

  private appendToBuffer(buffer: string[], data: Buffer): void {
    const text = data.toString();
    const lines = text.split('\n');
    // If the last line is empty (trailing newline), don't add an empty entry
    for (const line of lines) {
      if (line.length > 0) {
        buffer.push(line);
      }
    }
  }

  private readBuffer(buffer: string[], options?: ReadOutputOptions): string {
    const lines = options?.tail ? buffer.slice(-options.tail) : buffer;
    const result = lines.join('\n');
    if (options?.clear) {
      buffer.length = 0;
    }
    return result;
  }
}

// ─── ProcessManager ─────────────────────────────────────────────

export class ProcessManager {
  private processes = new Map<string, ManagedProcess>();
  private acknowledged = new Set<string>();

  /** Spawn a new managed process. Throws if the ID is already in use. */
  spawn(options: SpawnOptions): ManagedProcess {
    if (this.processes.has(options.id)) {
      throw new Error(`Process "${options.id}" already exists. Kill it first or use a different ID.`);
    }

    const managed = new ManagedProcess(options.id);
    this.processes.set(options.id, managed);
    managed._start(options);
    return managed;
  }

  /** Get a managed process by ID. */
  get(id: string): ManagedProcess | undefined {
    return this.processes.get(id);
  }

  /** Kill a process by ID. */
  kill(id: string, signal?: NodeJS.Signals): void {
    this.processes.get(id)?.kill(signal);
  }

  /** Kill all managed processes. */
  killAll(signal?: NodeJS.Signals): void {
    for (const proc of this.processes.values()) {
      proc.kill(signal);
    }
  }

  /** Remove a process from tracking (after it has exited). */
  remove(id: string): void {
    this.processes.delete(id);
    this.acknowledged.delete(id);
  }

  /** List all managed processes. */
  list(): readonly ProcessInfo[] {
    return [...this.processes.values()].map((p) => p.info);
  }

  /** Get completed processes that haven't been acknowledged. */
  getCompletedUnacknowledged(): readonly ManagedProcess[] {
    return [...this.processes.values()].filter((p) => !p.running && !this.acknowledged.has(p.id));
  }

  /** Mark a completed process as acknowledged (prevents repeat notifications). */
  acknowledge(id: string): void {
    this.acknowledged.add(id);
  }
}
