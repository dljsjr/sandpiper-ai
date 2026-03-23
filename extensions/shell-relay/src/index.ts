import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { Type } from '@sinclair/typebox';
import { exportVars } from './env-export.js';
import { FifoManager } from './fifo.js';
import { GhostClient } from './ghost-client.js';
import { Relay } from './relay.js';
import { ZellijClient } from './zellij.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Companion scripts (ghost-attach, unbuffer-relay) live at the extension
// root, one level up from both src/ (dev) and dist/ (bundled).
const extensionRoot = dirname(__dirname);

/** Resolve the base directory for FIFOs. */
function resolveBaseDir(): string {
  const xdgRuntime = process.env.XDG_RUNTIME_DIR;
  if (xdgRuntime && existsSync(xdgRuntime)) {
    return join(xdgRuntime, 'shell-relay');
  }
  return join(tmpdir(), `shell-relay-${userInfo().username}`);
}

/** Check if unbuffer-relay (expect/tclsh) is available for enhanced mode. */
function isUnbufferAvailable(): boolean {
  if (process.env.SHELL_RELAY_NO_UNBUFFER === '1') return false;
  try {
    execSync('command -v tclsh', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/** Detect the shell type from environment. */
function detectShell(): 'fish' | 'bash' | 'zsh' {
  const shell = process.env.SHELL ?? '';
  if (shell.includes('fish')) return 'fish';
  if (shell.includes('zsh')) return 'zsh';
  return 'bash';
}

export default function (pi: ExtensionAPI) {
  let fifoManager: FifoManager | null = null;
  let ghostClient: GhostClient | null = null;
  let zellij: ZellijClient | null = null;
  let relay: Relay | null = null;
  let zellijPaneId: string | null = null;
  let zellijSessionName: string | null = null;
  let isSetUp = false;

  /** Set up the relay: create FIFOs, connect to Zellij, start listening. */
  async function setupRelay(
    ctx: { ui: { notify: (msg: string, level?: 'info' | 'warning' | 'error') => void } },
    targetZellijSession?: string,
  ): Promise<void> {
    if (isSetUp) return;

    // Resolve or create Zellij session
    const resolvedSession =
      targetZellijSession ?? process.env.SHELL_RELAY_SESSION ?? `relay-${randomUUID().slice(0, 8)}`;

    zellij = new ZellijClient({ sessionName: resolvedSession });

    if (!zellij.isAvailable()) {
      throw new Error(
        'Zellij is not installed or not available. ' +
          'Shell Relay requires Zellij. Install it from https://zellij.dev',
      );
    }

    // Spawn a ghost client to attach to (or create) the session.
    // Zellij requires a real PTY client for write-chars and dump-screen
    // to work reliably. The ghost client provides this invisibly.
    ghostClient = new GhostClient({ scriptDir: extensionRoot, sessionName: resolvedSession });
    ghostClient.start();

    // Wait for the ghost client to attach and the pane to be ready
    const paneReady = await zellij.waitForPane(10_000, 500);
    if (!paneReady) {
      ghostClient.stop();
      ghostClient = null;
      throw new Error(
        `Failed to start Zellij session "${resolvedSession}". ` +
          'The ghost client could not attach. Check that Zellij is working correctly.',
      );
    }

    // Set up FIFOs and start listening BEFORE injecting env vars.
    // This way, when the shell processes the env exports and draws a new
    // prompt, the prompt hook writes prompt_ready to the signal FIFO and
    // we receive it — confirming the full pipeline is wired up.
    zellijPaneId = process.env.SHELL_RELAY_PANE_ID ?? randomUUID().slice(0, 12);
    const baseDir = resolveBaseDir();

    // Clean up stale FIFOs from previous sessions
    const stale = FifoManager.detectStale(baseDir);
    for (const staleId of stale) {
      FifoManager.cleanupStale(baseDir, staleId);
    }

    fifoManager = new FifoManager({ baseDir, sessionId: zellijPaneId });
    fifoManager.create();
    fifoManager.open();

    const shell = detectShell();

    // Create relay and start listening on FIFOs (before injection)
    relay = new Relay({
      fifoManager,
      shell,
      // biome-ignore lint/style/noNonNullAssertion: zellij is assigned in setupRelay before tool execution
      injectCommand: (cmd: string) => zellij!.writeChars(cmd),
    });
    relay.startListening();

    // Export FIFO paths into the Zellij pane
    const envExports = exportVars(shell, [
      { name: 'SHELL_RELAY_SIGNAL', value: fifoManager.paths.signal },
      { name: 'SHELL_RELAY_STDOUT', value: fifoManager.paths.stdout },
      { name: 'SHELL_RELAY_STDERR', value: fifoManager.paths.stderr },
      { name: 'SHELL_RELAY_UNBUFFER', value: join(extensionRoot, 'unbuffer-relay') },
    ]);

    // Space prefix excludes from shell history; clear removes the
    // visible export commands from the pane after they execute.
    zellij.writeChars(` ${envExports}; clear\n`);

    // Wait for prompt_ready — this confirms:
    // 1. The shell has fully initialized (config.fish sourced)
    // 2. The env exports have been processed
    // 3. The prompt hook is active and writing to the signal FIFO
    try {
      await relay.waitForPromptReady(15_000);
    } catch {
      // Clean up on failure
      relay.stopListening();
      ghostClient?.stop();
      await fifoManager.shutdown();
      relay = null;
      ghostClient = null;
      fifoManager = null;
      throw new Error(
        `Shell Relay: Timed out waiting for prompt_ready signal in session "${resolvedSession}". ` +
          'Ensure the shell integration script (relay.fish) is sourced in your shell config.',
      );
    }

    isSetUp = true;
    zellijSessionName = resolvedSession;
    ctx.ui.notify(
      `Shell Relay: Connected (session=${resolvedSession}, shell=${shell}). ` +
        `View the shared terminal with: zellij attach ${resolvedSession}`,
      'info',
    );
  }

  // --- Tool Registration ---

  pi.registerTool({
    name: 'shell_relay',
    label: 'Shell Relay',
    description:
      "Execute a command in the user's shared terminal session (Zellij pane). " +
      "The command runs in the user's authenticated shell with full session state " +
      '(environment, functions, auth tokens). Both user and agent can see and ' +
      'interact with the terminal in real time.',
    promptSnippet: "Execute commands in the user's shared terminal (inherits auth, env, functions)",
    promptGuidelines: [
      "Use shell_relay instead of bash when the command requires the user's session state (e.g., 1Password auth, shell functions, non-exported env vars).",
      "Use bash for general-purpose commands that don't need session state — it's faster and simpler.",
      'shell_relay executes in a visible Zellij pane — the user can see all commands and output in real time.',
      'The shared terminal is fully collaborative — the user may run commands between your invocations.',
    ],
    parameters: Type.Object({
      command: Type.String({
        description: "Command to execute in the user's shell session",
      }),
      timeout: Type.Optional(
        Type.Number({
          description: 'Timeout in seconds (default: 30)',
        }),
      ),
      session: Type.Optional(
        Type.String({
          description:
            'Zellij session name to connect to. If not provided, uses SHELL_RELAY_SESSION env var or creates a new session.',
        }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      try {
        await setupRelay(ctx, params.session);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text' as const,
              text:
                `Shell Relay setup failed: ${msg}\n\n` +
                'If this command does not require session state (auth tokens, shell functions, etc.), ' +
                'use the bash tool instead.',
            },
          ],
          details: { error: msg },
          isError: true,
        };
      }

      const timeoutMs = (params.timeout ?? 30) * 1000;

      try {
        // biome-ignore lint/style/noNonNullAssertion: relay is assigned in setupRelay before tool execution
        const result = await relay!.execute(params.command, { timeoutMs });

        const outputParts: string[] = [];
        if (result.stdout.length > 0) {
          outputParts.push(`STDOUT:\n${result.stdout}`);
        }
        if (result.stderr.length > 0) {
          outputParts.push(`STDERR:\n${result.stderr}`);
        }
        if (outputParts.length === 0) {
          outputParts.push('(no output)');
        }
        outputParts.push(`Exit code: ${result.exitCode}`);

        return {
          content: [{ type: 'text' as const, text: outputParts.join('\n\n') }],
          details: {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
            timedOut: result.timedOut,
          },
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text' as const,
              text:
                `Shell Relay error: ${msg}\n\n` +
                'The relay pane may be unavailable or the shell integration may not be sourced. ' +
                'If this command does not require session state, use the bash tool instead.',
            },
          ],
          details: { error: msg },
          isError: true,
        };
      }
    },
  });

  pi.registerTool({
    name: 'shell_relay_inspect',
    label: 'Inspect Relay Pane',
    description:
      'View the current visual state of the shared terminal pane. ' +
      'Use this to see what the user has done in the pane, inspect TUI output, ' +
      'or check the state of an interactive program.',
    promptSnippet: "View the shared terminal's current visual state",
    parameters: Type.Object({
      session: Type.Optional(
        Type.String({
          description: 'Zellij session name (uses current relay session if not provided)',
        }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      try {
        await setupRelay(ctx, params.session);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Shell Relay setup failed: ${msg}\n\nCannot inspect pane — the relay is not connected.`,
            },
          ],
          details: { error: msg },
          isError: true,
        };
      }

      try {
        // Use a temp file for dump-screen output
        const dumpPath = join(resolveBaseDir(), `dump-${randomUUID().slice(0, 8)}`);
        // biome-ignore lint/style/noNonNullAssertion: zellij is assigned in setupRelay before tool execution
        zellij!.dumpScreen(dumpPath);

        // Read the dump file
        const { readFileSync, unlinkSync } = await import('node:fs');
        let content: string;
        try {
          content = readFileSync(dumpPath, 'utf-8');
        } finally {
          try {
            unlinkSync(dumpPath);
          } catch {
            // ignore cleanup errors
          }
        }

        return {
          content: [{ type: 'text' as const, text: content || '(empty pane)' }],
          details: { lines: content.split('\n').length },
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text' as const,
              text:
                `Inspect failed: ${msg}\n\n` +
                'The Zellij pane may have been closed or the session may be unavailable.',
            },
          ],
          details: { error: msg },
          isError: true,
        };
      }
    },
  });

  // --- Commands ---

  pi.registerCommand('relay-connect', {
    description: 'Connect Shell Relay to a Zellij session (or create a new one)',
    handler: async (_args, ctx) => {
      // If already connected, confirm reconnect
      if (isSetUp) {
        const reconnect = await ctx.ui.confirm(
          'Shell Relay is already connected',
          'Disconnect and connect to a different session?',
        );
        if (!reconnect) return;

        // Tear down existing relay
        relay?.stopListening();
        ghostClient?.stop();
        if (fifoManager) {
          await fifoManager.shutdown();
        }
        relay = null;
        ghostClient = null;
        fifoManager = null;
        zellij = null;
        isSetUp = false;
        zellijSessionName = null;
      }

      // Check Zellij availability
      const probe = new ZellijClient({ sessionName: '' });
      if (!probe.isAvailable()) {
        ctx.ui.notify('Zellij is not installed or not available. Install it from https://zellij.dev', 'error');
        return;
      }

      // List existing sessions
      const sessions = probe.listSessions();

      const CREATE_NEW_OPTION = '+ Create new session';
      const options = [...sessions, CREATE_NEW_OPTION];
      const selection = await ctx.ui.select('Select a Zellij session for Shell Relay:', options);

      if (selection === undefined) {
        // User cancelled
        return;
      }

      let zellijSession: string;
      if (selection === CREATE_NEW_OPTION) {
        const name = await ctx.ui.input('Session name:', `relay-${randomUUID().slice(0, 8)}`);
        if (!name) return;
        zellijSession = name;
      } else {
        zellijSession = selection;
      }

      try {
        await setupRelay(ctx, zellijSession);
        ctx.ui.notify(`Shell Relay: Connected to session "${zellijSession}".`, 'info');
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(`Shell Relay: Failed to connect — ${msg}`, 'error');
      }
    },
  });

  pi.registerCommand('relay-status', {
    description: 'Show Shell Relay connection status',
    handler: async (_args, ctx) => {
      if (!isSetUp) {
        ctx.ui.notify('Shell Relay: Not connected. Use /relay-connect to connect.', 'info');
        return;
      }

      const shell = detectShell();
      const mode = isUnbufferAvailable() ? 'enhanced (PTY colors)' : 'basic';

      ctx.ui.notify(
        `Shell Relay: Connected\n  Session: ${zellijSessionName ?? 'unknown'}\n  Shell: ${shell}\n  Mode: ${mode}\n  FIFOs: ${fifoManager?.paths.signal ?? 'n/a'}`,
        'info',
      );
    },
  });

  // --- Lifecycle ---

  pi.on('session_start', async (_event, ctx) => {
    const hasZellij = new ZellijClient({ sessionName: '' }).isAvailable();
    const hasTclsh = (() => {
      try {
        execSync('command -v tclsh', { stdio: 'pipe' });
        return true;
      } catch {
        return false;
      }
    })();
    const configuredSession = process.env.SHELL_RELAY_SESSION;

    if (!hasZellij) {
      ctx.ui.setStatus('shell-relay', 'Shell Relay: Zellij not found — install from https://zellij.dev');
      return;
    }

    if (!hasTclsh) {
      ctx.ui.setStatus('shell-relay', 'Shell Relay: expect/tclsh not found — required for ghost client');
      return;
    }

    const mode = isUnbufferAvailable() ? 'enhanced (PTY colors)' : 'basic';

    if (configuredSession) {
      ctx.ui.setStatus('shell-relay', `Shell Relay: ${configuredSession} (${mode})`);
    } else {
      ctx.ui.setStatus('shell-relay', `Shell Relay: ready (${mode})`);
    }
  });

  pi.on('session_shutdown', async () => {
    relay?.stopListening();
    ghostClient?.stop();
    if (fifoManager) {
      await fifoManager.shutdown();
    }
    ghostClient = null;
    isSetUp = false;
    zellijSessionName = null;
  });
}
