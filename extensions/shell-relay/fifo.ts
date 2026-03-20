import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  statSync,
  rmSync,
  readdirSync,
  openSync,
  closeSync,
  constants,
} from "node:fs";
import { join } from "node:path";

/** Paths to the three persistent FIFOs for a relay session. */
export interface FifoPaths {
  readonly stdout: string;
  readonly stderr: string;
  readonly signal: string;
}

/** Configuration for creating a FifoManager. */
export interface FifoManagerOptions {
  /** Base directory for all relay sessions (e.g., $XDG_RUNTIME_DIR/shell-relay/) */
  readonly baseDir: string;
  /** Unique session identifier used for deterministic FIFO paths */
  readonly sessionId: string;
}

const FIFO_NAMES = ["stdout", "stderr", "signal"] as const;

/**
 * Manages the lifecycle of persistent FIFOs for a shell relay session.
 *
 * Creates three named pipes (stdout, stderr, signal) under a deterministic
 * session directory. FIFOs are created once at session start and cleaned up
 * on shutdown.
 *
 * This module is framework-independent — no pi/sandpiper imports.
 */
export class FifoManager {
  private readonly sessionDir: string;
  private readonly _paths: FifoPaths;
  private _created = false;
  private _shutdown = false;
  private readonly openFds: number[] = [];

  constructor(private readonly options: FifoManagerOptions) {
    this.sessionDir = join(options.baseDir, options.sessionId);
    this._paths = {
      stdout: join(this.sessionDir, "stdout"),
      stderr: join(this.sessionDir, "stderr"),
      signal: join(this.sessionDir, "signal"),
    };
  }

  /** The deterministic paths to the three FIFOs. */
  get paths(): FifoPaths {
    return this._paths;
  }

  /** Whether the FIFOs have been created. */
  get isCreated(): boolean {
    return this._created;
  }

  /**
   * Create the session directory and three FIFOs.
   *
   * @throws If the session directory already exists (stale session)
   */
  create(): void {
    if (this._created) {
      return;
    }

    if (existsSync(this.sessionDir)) {
      throw new Error(
        `Session directory already exists: ${this.sessionDir}. ` +
          `This may indicate a stale session. Use FifoManager.cleanupStale() to remove it.`
      );
    }

    // Create session directory with mode 0700
    mkdirSync(this.sessionDir, { recursive: true, mode: 0o700 });

    // Create FIFOs with mode 0600
    for (const name of FIFO_NAMES) {
      const fifoPath = join(this.sessionDir, name);
      execSync(`mkfifo -m 0600 "${fifoPath}"`);
    }

    this._created = true;
  }

  /**
   * Open all FIFOs with O_RDWR for the sentinel pattern.
   *
   * Opening with O_RDWR means the fd acts as both reader and writer,
   * preventing EOF when external writers close their handles. Returns
   * the file descriptors.
   */
  open(): { stdout: number; stderr: number; signal: number } {
    if (!this._created) {
      throw new Error("FIFOs must be created before opening. Call create() first.");
    }

    const stdoutFd = openSync(this._paths.stdout, constants.O_RDWR | constants.O_NONBLOCK);
    const stderrFd = openSync(this._paths.stderr, constants.O_RDWR | constants.O_NONBLOCK);
    const signalFd = openSync(this._paths.signal, constants.O_RDWR | constants.O_NONBLOCK);

    this.openFds.push(stdoutFd, stderrFd, signalFd);

    return { stdout: stdoutFd, stderr: stderrFd, signal: signalFd };
  }

  /**
   * Shut down the FIFO manager: close open fds, remove FIFOs and session directory.
   */
  async shutdown(): Promise<void> {
    if (this._shutdown) {
      return;
    }
    this._shutdown = true;

    // Close any open file descriptors
    for (const fd of this.openFds) {
      try {
        closeSync(fd);
      } catch {
        // fd may already be closed
      }
    }
    this.openFds.length = 0;

    // Remove session directory and contents
    if (existsSync(this.sessionDir)) {
      rmSync(this.sessionDir, { recursive: true, force: true });
    }

    this._created = false;
  }

  /**
   * Detect stale session directories under the base directory.
   * Returns an array of session IDs that have leftover FIFO directories.
   */
  static detectStale(baseDir: string): string[] {
    if (!existsSync(baseDir)) {
      return [];
    }

    const entries = readdirSync(baseDir, { withFileTypes: true });
    const stale: string[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      // Check if this directory looks like a relay session (has FIFO files)
      const sessionDir = join(baseDir, entry.name);
      const hasFifos = FIFO_NAMES.some((name) => {
        const fifoPath = join(sessionDir, name);
        try {
          return statSync(fifoPath).isFIFO();
        } catch {
          return false;
        }
      });

      if (hasFifos) {
        stale.push(entry.name);
      }
    }

    return stale;
  }

  /**
   * Clean up a specific stale session directory.
   */
  static cleanupStale(baseDir: string, sessionId: string): void {
    const sessionDir = join(baseDir, sessionId);
    if (existsSync(sessionDir)) {
      rmSync(sessionDir, { recursive: true, force: true });
    }
  }
}
