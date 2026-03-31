import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync, type ReadStream } from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { Type } from '@sinclair/typebox';
import { registerPreflightCheck } from 'sandpiper-ai-core';
import { exportVars } from './env-export.js';
import { FifoManager } from './fifo.js';
import { checkShellIntegration } from './preflight.js';
import {
  deriveRelaySessionName,
  RELAY_SESSION_CUSTOM_TYPE,
  restoreSessionNameFromBranch,
  type StoredRelaySession,
  shouldAutoReconnect,
} from './session-lifecycle.js';
import { SignalParser } from './signal.js';
import { extractCommandOutput } from './snapshot-diff.js';
import { ZellijClient } from './zellij.js';

/** Resolve the base directory for signal FIFOs. */
function resolveBaseDir(): string {
  const xdgRuntime = process.env.XDG_RUNTIME_DIR;
  if (xdgRuntime && existsSync(xdgRuntime)) {
    return join(xdgRuntime, 'shell-relay');
  }
  return join(tmpdir(), `shell-relay-${userInfo().username}`);
}

/** Detect the shell type from environment. */
function detectShell(): 'fish' | 'bash' | 'zsh' {
  const shell = process.env.SHELL ?? '';
  if (shell.includes('fish')) return 'fish';
  if (shell.includes('zsh')) return 'zsh';
  return 'bash';
}

export default function (pi: ExtensionAPI) {
  // Register preflight check — runs at session_start via system extension aggregation
  registerPreflightCheck(pi, 'shell-relay:integration', checkShellIntegration);

  let fifoManager: FifoManager | null = null;
  let zellij: ZellijClient | null = null;
  let signalParser: SignalParser | null = null;
  let signalStream: ReadStream | null = null;
  let zellijSessionName: string | null = null;
  let isSetUp = false;

  // The session name stored/restored via appendEntry — source of truth across restarts
  let storedRelaySessionName: string | undefined;

  // Execution lock: only one command at a time
  let executionQueue: Promise<unknown> = Promise.resolve();

  /** Set up the relay: create background session, find pane, wire signal FIFO. */
  async function setupRelay(
    ctx: {
      ui: {
        notify: (msg: string, level?: 'info' | 'warning' | 'error') => void;
        setStatus: (key: string, text: string) => void;
      };
    },
    targetZellijSession?: string,
  ): Promise<void> {
    if (isSetUp) return;

    // Resolve or create Zellij session.
    // Priority: explicit argument > env var > stored (appendEntry) > UUID-derived default
    const resolvedSession =
      targetZellijSession ??
      process.env.SHELL_RELAY_SESSION ??
      storedRelaySessionName ??
      deriveRelaySessionName(process.env.SANDPIPER_SESSION_ID ?? randomUUID());

    zellij = new ZellijClient({ sessionName: resolvedSession });

    if (!zellij.isAvailable()) {
      throw new Error(
        'Zellij is not installed or not available. ' +
          'Shell Relay requires Zellij. Install it from https://zellij.dev',
      );
    }

    // Create session by attaching then detaching — this gives the session
    // a wide viewport (inherited from the spawning process) instead of the
    // default 50x49 that --create-background produces.
    await zellij.createSessionWithDetach(10_000);

    // The pane ID was found by createSessionWithDetach via waitForPane
    const paneId = zellij.getPaneId() ?? zellij.findTerminalPane();
    if (!paneId) {
      throw new Error(
        `Failed to find a terminal pane in session "${resolvedSession}". ` +
          'The session may not have started correctly.',
      );
    }
    zellij.setPaneId(paneId);

    // Set up signal FIFO only (no stdout/stderr FIFOs needed)
    const sessionId = randomUUID().slice(0, 12);
    const baseDir = resolveBaseDir();

    // Clean up stale FIFOs from previous sessions
    const stale = FifoManager.detectStale(baseDir);
    for (const staleId of stale) {
      FifoManager.cleanupStale(baseDir, staleId);
    }

    fifoManager = new FifoManager({ baseDir, sessionId });
    fifoManager.create();
    fifoManager.open();

    // Start listening on the signal FIFO for prompt_ready + exit codes
    signalParser = new SignalParser();
    signalStream = createReadStream(fifoManager.paths.signal, { flags: 'r', encoding: 'utf-8' });
    signalStream.on('data', (chunk: string) => {
      signalParser?.feed(chunk);
    });

    const shell = detectShell();

    // Export the signal FIFO path into the Zellij pane.
    // Output capture is handled by snapshot-diff; the shell integration only
    // needs the signal channel for prompt_ready and last_status.
    const envExports = exportVars(shell, [{ name: 'SHELL_RELAY_SIGNAL', value: fifoManager.paths.signal }]);

    // Space prefix excludes from shell history; clear removes the
    // visible export commands from the pane after they execute.
    zellij.paste(` ${envExports}; clear`);
    zellij.sendKeys('Enter');

    // Wait for prompt_ready — confirms:
    // 1. The shell has fully initialized
    // 2. The env exports have been processed
    // 3. The prompt hook is active and writing to the signal FIFO
    try {
      await signalParser.waitFor('prompt_ready', 15_000);
    } catch {
      // Clean up on failure
      signalStream.destroy();
      await fifoManager.shutdown();
      signalParser = null;
      signalStream = null;
      fifoManager = null;
      throw new Error(
        `Shell Relay: Timed out waiting for prompt_ready signal in session "${resolvedSession}". ` +
          'Ensure the relay shell integration script is sourced in your shell config.',
      );
    }

    isSetUp = true;
    zellijSessionName = resolvedSession;

    // Persist the chosen session name so future resumes can reconnect
    pi.appendEntry<StoredRelaySession>(RELAY_SESSION_CUSTOM_TYPE, { sessionName: resolvedSession });
    storedRelaySessionName = resolvedSession;
    ctx.ui.setStatus('shell-relay', `Shell Relay: ${resolvedSession} (${shell})`);
  }

  /** Tear down the relay. */
  async function teardownRelay(): Promise<void> {
    signalStream?.destroy();
    signalStream = null;
    signalParser = null;
    if (fifoManager) {
      await fifoManager.shutdown();
      fifoManager = null;
    }
    zellij = null;
    isSetUp = false;
    zellijSessionName = null;
  }

  /** Execute a command and return captured output via snapshot-diff. */
  async function executeCommand(
    command: string,
    timeoutMs: number,
  ): Promise<{ output: string; exitCode: number; timedOut: boolean }> {
    if (!zellij || !signalParser) {
      throw new Error('Relay not set up');
    }

    // Take "before" snapshot
    const beforeSnapshot = zellij.dumpScreen();

    // Inject the command via __relay_run wrapper, which ensures last_status
    // is sent for ALL command types (including builtins that __relay_preexec skips).
    // Space prefix excludes from shell history.
    const shell = detectShell();
    const escaped =
      shell === 'fish'
        ? (await import('./escape.js')).escapeForFish(command)
        : (await import('./escape.js')).escapeForBash(command);
    const injectedText = `__relay_run ${escaped}`;
    zellij.paste(` ${injectedText}`);
    zellij.sendKeys('Enter');

    // Wait for last_status signal (command completed)
    const statusEvent = await signalParser.waitFor('last_status', timeoutMs);
    if (statusEvent.type !== 'last_status') {
      throw new Error('Unexpected signal event type');
    }
    const exitCode = statusEvent.exitCode;

    // Wait for prompt_ready (pane is ready for next command)
    try {
      await signalParser.waitFor('prompt_ready', 5_000);
    } catch {
      // prompt_ready timeout is non-fatal — we have the exit code already
    }

    // Small delay to let the terminal finish rendering
    await new Promise((r) => setTimeout(r, 100));

    // Take "after" snapshot and diff — pass the full injected text
    // so the diff can split on it reliably
    const afterSnapshot = zellij.dumpScreen();
    const output = extractCommandOutput(beforeSnapshot, afterSnapshot, injectedText);

    return { output, exitCode, timedOut: false };
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

      // Serialize command execution
      const resultPromise = new Promise<{
        output: string;
        exitCode: number;
        timedOut: boolean;
      }>((resolve, reject) => {
        executionQueue = executionQueue.then(
          () => executeCommand(params.command, timeoutMs).then(resolve, reject),
          () => executeCommand(params.command, timeoutMs).then(resolve, reject),
        );
      });

      try {
        const result = await resultPromise;

        const parts: string[] = [];
        if (result.output.length > 0) {
          parts.push(result.output);
        } else {
          parts.push('(no output)');
        }
        parts.push(`\nExit code: ${result.exitCode}`);

        return {
          content: [{ type: 'text' as const, text: parts.join('\n') }],
          details: {
            output: result.output,
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
        // biome-ignore lint/style/noNonNullAssertion: zellij is assigned in setupRelay before tool execution
        const content = zellij!.dumpScreen();

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
      if (isSetUp) {
        const reconnect = await ctx.ui.confirm(
          'Shell Relay is already connected',
          'Disconnect and connect to a different session?',
        );
        if (!reconnect) return;
        await teardownRelay();
      }

      const probe = new ZellijClient({ sessionName: '' });
      if (!probe.isAvailable()) {
        ctx.ui.notify('Zellij is not installed or not available. Install it from https://zellij.dev', 'error');
        return;
      }

      const sessions = probe.listSessions();
      const CREATE_NEW_OPTION = '+ Create new session';
      const options = [...sessions, CREATE_NEW_OPTION];
      const selection = await ctx.ui.select('Select a Zellij session for Shell Relay:', options);

      if (selection === undefined) return;

      let zellijSession: string;
      if (selection === CREATE_NEW_OPTION) {
        const defaultName =
          storedRelaySessionName ?? deriveRelaySessionName(process.env.SANDPIPER_SESSION_ID ?? randomUUID());
        const name = await ctx.ui.input('Session name:', defaultName);
        if (!name) return;
        zellijSession = name;
      } else {
        zellijSession = selection;
      }

      try {
        await setupRelay(ctx, zellijSession);
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
      const paneId = zellij?.getPaneId() ?? 'unknown';

      ctx.ui.notify(
        `Shell Relay: Connected\n  Session: ${zellijSessionName ?? 'unknown'}\n  Shell: ${shell}\n  Pane: ${paneId}\n  Signal FIFO: ${fifoManager?.paths.signal ?? 'n/a'}`,
        'info',
      );
    },
  });

  pi.registerCommand('relay-cleanup', {
    description: 'Remove stale EXITED relay sessions from Zellij',
    handler: async (_args, ctx) => {
      const probe = new ZellijClient({ sessionName: '' });
      if (!probe.isAvailable()) {
        ctx.ui.notify('Zellij is not installed or not available.', 'error');
        return;
      }

      const stale = probe
        .listSessionsWithStatus()
        .filter((s) => s.name.startsWith('relay-') && s.exited && s.name !== zellijSessionName);

      if (stale.length === 0) {
        ctx.ui.notify('No stale relay sessions found.', 'info');
        return;
      }

      const sessionList = stale.map((s) => `  ${s.name}`).join('\n');
      const confirmed = await ctx.ui.confirm(
        `Delete ${stale.length} stale relay session${stale.length > 1 ? 's' : ''}?`,
        `The following EXITED relay sessions will be permanently deleted:\n${sessionList}`,
      );

      if (!confirmed) return;

      let deleted = 0;
      let failed = 0;
      for (const session of stale) {
        try {
          probe.deleteSession(session.name);
          deleted++;
        } catch {
          failed++;
        }
      }

      if (failed > 0) {
        ctx.ui.notify(
          `Deleted ${deleted} session${deleted !== 1 ? 's' : ''}. ${failed} could not be deleted.`,
          'warning',
        );
      } else {
        ctx.ui.notify(`Deleted ${deleted} stale relay session${deleted !== 1 ? 's' : ''}.`, 'info');
      }
    },
  });

  // --- Lifecycle ---

  /** Restore stored session name and auto-reconnect if appropriate. */
  async function onSessionReady(ctx: Parameters<Parameters<typeof pi.on>[1]>[1]): Promise<void> {
    // Restore the persisted relay session name from the current branch
    storedRelaySessionName = restoreSessionNameFromBranch(ctx.sessionManager.getBranch());

    const probe = new ZellijClient({ sessionName: '' });
    if (!probe.isAvailable()) {
      ctx.ui.setStatus('shell-relay', 'Shell Relay: Zellij not found — install from https://zellij.dev');
      return;
    }

    const shell = detectShell();

    // Auto-reconnect if we have a stored session that still exists in Zellij
    const available = probe.listSessions();
    if (shouldAutoReconnect(storedRelaySessionName, available)) {
      try {
        await setupRelay(ctx, storedRelaySessionName);
        return;
      } catch {
        // Auto-reconnect failed — fall through to ready status
      }
    }

    const label = storedRelaySessionName ?? process.env.SHELL_RELAY_SESSION;
    if (label) {
      ctx.ui.setStatus('shell-relay', `Shell Relay: ${label} (${shell})`);
    } else {
      ctx.ui.setStatus('shell-relay', `Shell Relay: ready (${shell})`);
    }
  }

  pi.on('session_start', async (_event, ctx) => {
    await onSessionReady(ctx);
  });

  pi.on('session_switch', async (_event, ctx) => {
    isSetUp = false;
    await teardownRelay();
    await onSessionReady(ctx);
  });

  pi.on('session_fork', async (_event, ctx) => {
    storedRelaySessionName = restoreSessionNameFromBranch(ctx.sessionManager.getBranch());
  });

  pi.on('session_tree', async (_event, ctx) => {
    storedRelaySessionName = restoreSessionNameFromBranch(ctx.sessionManager.getBranch());
  });

  pi.on('session_shutdown', async () => {
    await teardownRelay();
  });
}
