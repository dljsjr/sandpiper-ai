import { execSync } from 'node:child_process';

/**
 * Zellij CLI client for shell relay operations.
 *
 * Uses Zellij 0.44+ APIs: --session flag for session targeting,
 * --pane-id for pane-level targeting, paste for bracketed paste
 * mode injection, send-keys for human-readable key input, and
 * list-panes --json for structured pane metadata.
 *
 * No ghost client required — all operations work against background
 * sessions via CLI.
 *
 * This module is framework-independent — no pi/sandpiper imports.
 */

// ─── Types ──────────────────────────────────────────────────────

export interface ZellijClientOptions {
  /** Session name to target. */
  readonly sessionName: string;
  /** Pane ID to target (e.g., "terminal_0"). Set after session creation. */
  readonly paneId?: string;
}

export interface PaneInfo {
  readonly id: number;
  readonly isPlugin: boolean;
  readonly isFocused: boolean;
  readonly isFloating: boolean;
  readonly title: string;
  readonly exited: boolean;
  readonly exitStatus: number | null;
  readonly paneCommand: string | null;
  readonly paneCwd: string | null;
  readonly tabId: number;
  readonly tabName: string;
  readonly paneRows: number;
  readonly paneColumns: number;
}

// ─── Client ─────────────────────────────────────────────────────

export class ZellijClient {
  private readonly sessionName: string;
  private paneId: string | undefined;

  constructor(options: ZellijClientOptions) {
    this.sessionName = options.sessionName;
    this.paneId = options.paneId;
  }

  /** Update the target pane ID. */
  setPaneId(paneId: string): void {
    this.paneId = paneId;
  }

  /** Get the current target pane ID. */
  getPaneId(): string | undefined {
    return this.paneId;
  }

  // ── Session Management ──────────────────────────────────────

  /**
   * Create a background session (no attached terminal required).
   * Idempotent — attaches to existing session if it already exists.
   *
   * Uses attach --create-background which creates a small default viewport (50x49).
   * For a wider viewport, use createSessionWithDetach() instead.
   */
  createBackgroundSession(): void {
    execSync(`zellij attach --create-background ${this.shellQuote(this.sessionName)}`, {
      stdio: 'pipe',
    });
  }

  /**
   * Create a session by briefly attaching then immediately detaching.
   * This inherits the terminal dimensions from the spawning process,
   * giving us a wider viewport than createBackgroundSession().
   *
   * The attach process is spawned with inherited stdio so Zellij can
   * read the terminal size. After the pane is ready, we detach.
   */
  async createSessionWithDetach(timeoutMs = 10_000): Promise<void> {
    const { spawn: nodeSpawn } = await import('node:child_process');

    // Spawn zellij attach --create with inherited stdio for terminal dimensions
    const proc = nodeSpawn('zellij', ['attach', '--create', this.sessionName], {
      stdio: 'pipe', // pipe so it doesn't take over the terminal
    });

    // Wait for the pane to be available, then detach
    const paneReady = await this.waitForPane(timeoutMs);
    if (paneReady) {
      try {
        execSync(`zellij --session ${this.shellQuote(this.sessionName)} action detach`, {
          stdio: 'pipe',
        });
      } catch {
        // Detach may fail if the session already detached — that's fine
      }
    }

    // Clean up the attach process
    try {
      proc.kill('SIGTERM');
    } catch {
      // May have already exited from the detach
    }

    if (!paneReady) {
      throw new Error(
        `Failed to create session "${this.sessionName}". No terminal pane became available within the timeout.`,
      );
    }
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
      const output = execSync('zellij list-sessions --short --no-formatting', {
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      return output
        .split('\n')
        .map((line) => line.trim())
        .filter((name): name is string => !!name && name.length > 0);
    } catch {
      return [];
    }
  }

  // ── Pane Discovery ──────────────────────────────────────────

  /**
   * List all panes in the target session with full metadata.
   */
  listPanes(): PaneInfo[] {
    try {
      const output = this.execInSession('action list-panes --json');
      const raw = JSON.parse(output) as Array<Record<string, unknown>>;
      return raw.map((p) => ({
        id: p.id as number,
        isPlugin: p.is_plugin as boolean,
        isFocused: p.is_focused as boolean,
        isFloating: p.is_floating as boolean,
        title: (p.title as string) ?? '',
        exited: p.exited as boolean,
        exitStatus: (p.exit_status as number) ?? null,
        paneCommand: (p.pane_command as string) ?? null,
        paneCwd: (p.pane_cwd as string) ?? null,
        tabId: p.tab_id as number,
        tabName: (p.tab_name as string) ?? '',
        paneRows: p.pane_rows as number,
        paneColumns: p.pane_columns as number,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Find the first terminal pane (non-plugin) in the session.
   * Returns the pane ID string (e.g., "terminal_0") or undefined.
   */
  findTerminalPane(): string | undefined {
    const panes = this.listPanes();
    const terminal = panes.find((p) => !p.isPlugin && !p.exited);
    return terminal ? `terminal_${terminal.id}` : undefined;
  }

  /**
   * Wait until a terminal pane is available in the session.
   * Uses list-panes instead of dump-screen polling.
   */
  waitForPane(timeoutMs = 10_000, intervalMs = 500): Promise<string | undefined> {
    return new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        const paneId = this.findTerminalPane();
        if (paneId) {
          resolve(paneId);
        } else if (Date.now() - start >= timeoutMs) {
          resolve(undefined);
        } else {
          setTimeout(check, intervalMs);
        }
      };
      check();
    });
  }

  // ── Command Injection ───────────────────────────────────────

  /**
   * Inject text into the target pane using bracketed paste mode.
   * Faster and more robust than write-chars.
   */
  paste(text: string): void {
    this.execInSessionWithPane(`action paste ${this.shellQuote(text)}`);
  }

  /**
   * Send human-readable key names to the target pane.
   * Examples: "Enter", "Ctrl c", "F1", "Tab", "Escape"
   */
  sendKeys(...keys: string[]): void {
    const keyArgs = keys.map((k) => this.shellQuote(k)).join(' ');
    this.execInSessionWithPane(`action send-keys ${keyArgs}`);
  }

  /**
   * Inject a command and execute it.
   * Uses paste (bracketed paste mode) + send-keys Enter.
   */
  injectCommand(command: string): void {
    this.paste(command);
    this.sendKeys('Enter');
  }

  // ── Output Capture ──────────────────────────────────────────

  /**
   * Dump the full pane scrollback as a string.
   * Returns the raw text content (no ANSI codes by default).
   */
  dumpScreen(options?: { ansi?: boolean }): string {
    const ansiFlag = options?.ansi ? ' --ansi' : '';
    return this.execInSessionWithPane(`action dump-screen --full${ansiFlag}`);
  }

  /**
   * Dump the pane scrollback to a file.
   */
  dumpScreenToFile(path: string, options?: { ansi?: boolean }): void {
    const ansiFlag = options?.ansi ? ' --ansi' : '';
    this.execInSessionWithPane(`action dump-screen --full --path ${this.shellQuote(path)}${ansiFlag}`);
  }

  // ── Legacy Compatibility ────────────────────────────────────
  // These methods maintain the old interface for incremental migration.
  // They should be removed once the relay is fully migrated.

  /**
   * @deprecated Use paste() + sendKeys('Enter') instead.
   */
  writeChars(chars: string): void {
    this.execInSessionWithPane(`action write-chars -- ${this.shellQuote(chars)}`);
  }

  // ── Internals ───────────────────────────────────────────────

  /**
   * Execute a zellij command targeting the session.
   */
  private execInSession(command: string): string {
    return execSync(`zellij --session ${this.shellQuote(this.sessionName)} ${command}`, {
      stdio: 'pipe',
      encoding: 'utf-8',
    });
  }

  /**
   * Execute a zellij command targeting the session and pane.
   * Throws if no pane ID is set.
   */
  private execInSessionWithPane(command: string): string {
    if (!this.paneId) {
      throw new Error('No pane ID set. Call setPaneId() or waitForPane() first.');
    }
    return execSync(`zellij --session ${this.shellQuote(this.sessionName)} ${command} --pane-id ${this.paneId}`, {
      stdio: 'pipe',
      encoding: 'utf-8',
    });
  }

  /**
   * Shell-quote a string for safe inclusion in a command.
   */
  private shellQuote(s: string): string {
    return `'${s.replace(/'/g, "'\\''")}'`;
  }
}
