import { execSync } from 'node:child_process';

/** Configuration for the Zellij client. */
export interface ZellijClientOptions {
  /** The Zellij session name to target. */
  readonly sessionName: string;
}

/**
 * Wraps Zellij CLI commands for shell relay operations.
 *
 * All commands that target a session use the ZELLIJ_SESSION_NAME
 * environment variable for session targeting.
 *
 * This module is framework-independent — no pi/sandpiper imports.
 */
export class ZellijClient {
  private readonly sessionName: string;

  constructor(options: ZellijClientOptions) {
    this.sessionName = options.sessionName;
  }

  /**
   * Inject characters into the target pane via `zellij action write-chars`.
   *
   * @param chars - The characters to inject (include trailing \n to execute)
   */
  writeChars(chars: string): void {
    this.execInSession(`zellij action write-chars -- ${this.shellQuote(chars)}`);
  }

  /**
   * Send raw key sequences (e.g., Ctrl+C) to the target pane.
   * Uses write-chars under the hood since Zellij doesn't have a separate send-keys.
   *
   * @param keys - Raw key sequence (e.g., "\x03" for Ctrl+C)
   */
  sendKeys(keys: string): void {
    this.writeChars(keys);
  }

  /**
   * Dump the full pane scrollback to a file via `zellij action dump-screen --full`.
   *
   * @param outputPath - Path to write the screen dump to (can be a FIFO)
   */
  dumpScreen(outputPath: string): void {
    this.execInSession(`zellij action dump-screen --full -- ${this.shellQuote(outputPath)}`);
  }

  /**
   * Create a new detached Zellij session.
   *
   * @param name - Name for the new session
   */
  createSession(name: string): void {
    execSync(`zellij attach --create-background ${this.shellQuote(name)}`, {
      stdio: 'pipe',
    });
  }

  /**
   * Create a new pane in the target session.
   */
  newPane(): void {
    this.execInSession('zellij action new-pane');
  }

  /**
   * Check whether the `zellij` CLI is available on the system.
   */
  isAvailable(): boolean {
    try {
      execSync('command -v zellij', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List active Zellij sessions.
   * Returns an array of session names.
   */
  listSessions(): string[] {
    try {
      const output = execSync('zellij list-sessions', { stdio: 'pipe', encoding: 'utf-8' });
      return output
        .split('\n')
        .map((line) => line.split(' ')[0]?.trim())
        .filter((name): name is string => !!name && name.length > 0);
    } catch {
      return [];
    }
  }

  /**
   * Wait until the pane is reachable by polling with dump-screen.
   * Requires a real client to be attached (e.g., via ghost-attach).
   *
   * @returns true if the pane became reachable, false if timed out
   */
  waitForPane(timeoutMs = 10_000, intervalMs = 500): Promise<boolean> {
    return new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        try {
          // dump-screen to /dev/null — just testing if it succeeds
          // With a real client attached, this reliably works
          this.execInSession('zellij action dump-screen --full /dev/null');
          resolve(true);
        } catch {
          if (Date.now() - start >= timeoutMs) {
            resolve(false);
          } else {
            setTimeout(check, intervalMs);
          }
        }
      };
      check();
    });
  }

  /**
   * Execute a command targeting the configured Zellij session.
   */
  private execInSession(command: string): string {
    return execSync(command, {
      stdio: 'pipe',
      encoding: 'utf-8',
      env: {
        ...process.env,
        ZELLIJ_SESSION_NAME: this.sessionName,
      },
    });
  }

  /**
   * Shell-quote a string for safe inclusion in a command.
   */
  private shellQuote(s: string): string {
    return `'${s.replace(/'/g, "'\\''")}'`;
  }
}
