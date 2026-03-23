import { type ChildProcess, spawn } from 'node:child_process';
import { join } from 'node:path';

/**
 * Manages a headless Zellij client process that keeps a session's pane
 * focused, making write-chars and dump-screen work reliably.
 *
 * This module is framework-independent — no pi/sandpiper imports.
 */

const GHOST_ATTACH_SCRIPT = 'ghost-attach';

export interface GhostClientOptions {
  /** Directory containing the ghost-attach script. */
  readonly scriptDir: string;
  /** Zellij session name to attach to (creates if doesn't exist). */
  readonly sessionName: string;
}

export class GhostClient {
  private process: ChildProcess | null = null;
  private readonly scriptPath: string;
  private readonly sessionName: string;

  constructor(options: GhostClientOptions) {
    this.scriptPath = join(options.scriptDir, GHOST_ATTACH_SCRIPT);
    this.sessionName = options.sessionName;
  }

  /**
   * Spawn the ghost client as a detached background process.
   * The process attaches to (or creates) the Zellij session with a real PTY.
   *
   * @throws If the ghost-attach script cannot be found or spawned.
   */
  start(): void {
    if (this.process) {
      return;
    }

    this.process = spawn(this.scriptPath, [this.sessionName], {
      detached: true,
      stdio: 'ignore',
    });

    // Unref so the parent process can exit without waiting for the ghost
    this.process.unref();

    // Handle spawn errors (e.g., script not found) — clean up and re-throw
    // so the caller can report a useful error instead of crashing the agent.
    this.process.on('error', (err) => {
      this.process = null;
      this.lastError = err;
    });

    // Handle unexpected exit
    this.process.on('exit', () => {
      this.process = null;
    });
  }

  /** Last error from the ghost client process, if any. */
  get error(): Error | null {
    return this.lastError;
  }

  private lastError: Error | null = null;

  /**
   * Kill the ghost client process.
   */
  stop(): void {
    if (!this.process) {
      return;
    }

    try {
      // Kill the process group (detached processes get their own group)
      if (this.process.pid) {
        process.kill(-this.process.pid, 'SIGTERM');
      }
    } catch {
      // Process may have already exited
    }

    this.process = null;
  }

  /**
   * Whether the ghost client process is running.
   */
  get isRunning(): boolean {
    return this.process !== null;
  }
}
