import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync, type ReadStream } from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { exportVars } from './env-export.js';
import { escapeForBash, escapeForFish } from './escape.js';
import { FifoManager } from './fifo.js';
import {
  deriveRelaySessionName,
  RELAY_SESSION_CUSTOM_TYPE,
  restoreSessionNameFromBranch,
  type StoredRelaySession,
  shouldAutoReconnect,
} from './session-lifecycle.js';
import { SignalParser } from './signal.js';
import { extractCommandOutput } from './snapshot-diff.js';
import type {
  RelayCommandResult,
  RelayRuntime,
  RelaySessionContext,
  RelaySetupContext,
  RelayStatusDetails,
} from './types.js';
import { ZellijClient } from './zellij.js';

/** Resolve the base directory for signal FIFOs (prefers XDG_RUNTIME_DIR, falls back to tmpdir). */
function resolveBaseDir(): string {
  const xdgRuntime = process.env.XDG_RUNTIME_DIR;
  if (xdgRuntime && existsSync(xdgRuntime)) {
    return join(xdgRuntime, 'shell-relay');
  }
  return join(tmpdir(), `shell-relay-${userInfo().username}`);
}

/** Detect the user's default shell from $SHELL (defaults to bash). */
function detectShell(): 'fish' | 'bash' | 'zsh' {
  const shell = process.env.SHELL ?? '';
  if (shell.includes('fish')) return 'fish';
  if (shell.includes('zsh')) return 'zsh';
  return 'bash';
}

export function createRelayRuntime(pi: ExtensionAPI): RelayRuntime {
  let fifoManager: FifoManager | null = null;
  let zellij: ZellijClient | null = null;
  let signalParser: SignalParser | null = null;
  let signalStream: ReadStream | null = null;
  let zellijSessionName: string | null = null;
  let storedRelaySessionName: string | undefined;
  let isSetUp = false;
  let executionQueue: Promise<unknown> = Promise.resolve();

  async function setup(ctx: RelaySetupContext, targetZellijSession?: string): Promise<void> {
    if (isSetUp) return;

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

    await zellij.createSessionWithDetach(10_000);

    const paneId = zellij.getPaneId() ?? zellij.findTerminalPane();
    if (!paneId) {
      throw new Error(
        `Failed to find a terminal pane in session "${resolvedSession}". ` +
          'The session may not have started correctly.',
      );
    }
    zellij.setPaneId(paneId);

    const sessionId = randomUUID().slice(0, 12);
    const baseDir = resolveBaseDir();

    const stale = FifoManager.detectStale(baseDir);
    for (const staleId of stale) {
      FifoManager.cleanupStale(baseDir, staleId);
    }

    fifoManager = new FifoManager({ baseDir, sessionId });
    fifoManager.create();
    fifoManager.open();

    signalParser = new SignalParser();
    signalStream = createReadStream(fifoManager.paths.signal, { flags: 'r', encoding: 'utf-8' });
    signalStream.on('data', (chunk: string) => {
      signalParser?.feed(chunk);
    });

    const shell = detectShell();
    const envExports = exportVars(shell, [{ name: 'SHELL_RELAY_SIGNAL', value: fifoManager.paths.signal }]);
    zellij.paste(` ${envExports}; clear`);
    zellij.sendKeys('Enter');

    try {
      await signalParser.waitFor('prompt_ready', 15_000);
    } catch {
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
    pi.appendEntry<StoredRelaySession>(RELAY_SESSION_CUSTOM_TYPE, { sessionName: resolvedSession });
    storedRelaySessionName = resolvedSession;
    ctx.ui.setStatus('shell-relay', `Shell Relay: ${resolvedSession} (${shell})`);
  }

  async function teardown(): Promise<void> {
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

  async function executeCommand(command: string, timeoutMs: number): Promise<RelayCommandResult> {
    if (!zellij || !signalParser) {
      throw new Error('Relay not set up');
    }

    const beforeSnapshot = zellij.dumpScreen();
    const shell = detectShell();
    const escaped = shell === 'fish' ? escapeForFish(command) : escapeForBash(command);
    const injectedText = `__relay_run ${escaped}`;

    zellij.paste(` ${injectedText}`);
    zellij.sendKeys('Enter');

    const statusEvent = await signalParser.waitFor('last_status', timeoutMs);
    if (statusEvent.type !== 'last_status') {
      throw new Error('Unexpected signal event type');
    }

    try {
      await signalParser.waitFor('prompt_ready', 5_000);
    } catch {
      // Non-fatal: we already have command completion and exit status.
    }

    await new Promise((resolve) => setTimeout(resolve, 100));

    const afterSnapshot = zellij.dumpScreen();
    const output = extractCommandOutput(beforeSnapshot, afterSnapshot, injectedText);

    return {
      output,
      exitCode: statusEvent.exitCode,
      timedOut: false,
    };
  }

  function executeQueued(command: string, timeoutMs: number): Promise<RelayCommandResult> {
    return new Promise((resolve, reject) => {
      executionQueue = executionQueue.then(
        () => executeCommand(command, timeoutMs).then(resolve, reject),
        () => executeCommand(command, timeoutMs).then(resolve, reject),
      );
    });
  }

  function inspectPane(): string {
    if (!zellij) {
      throw new Error('Relay not set up');
    }
    return zellij.dumpScreen();
  }

  function restoreStoredSessionFromBranch(branchEntries: Parameters<typeof restoreSessionNameFromBranch>[0]): void {
    storedRelaySessionName = restoreSessionNameFromBranch(branchEntries);
  }

  async function onSessionReady(ctx: RelaySessionContext): Promise<void> {
    restoreStoredSessionFromBranch(ctx.sessionManager.getBranch());

    const probe = new ZellijClient({ sessionName: '' });
    if (!probe.isAvailable()) {
      ctx.ui.setStatus('shell-relay', 'Shell Relay: Zellij not found — install from https://zellij.dev');
      return;
    }

    const shell = detectShell();
    const available = probe.listSessions();

    if (shouldAutoReconnect(storedRelaySessionName, available)) {
      try {
        await setup(ctx, storedRelaySessionName);
        return;
      } catch {
        // Auto-reconnect failure should not block startup status.
      }
    }

    const label = storedRelaySessionName ?? process.env.SHELL_RELAY_SESSION;
    if (label) {
      ctx.ui.setStatus('shell-relay', `Shell Relay: ${label} (${shell})`);
    } else {
      ctx.ui.setStatus('shell-relay', `Shell Relay: ready (${shell})`);
    }
  }

  async function onSessionSwitch(ctx: RelaySessionContext): Promise<void> {
    await teardown();
    await onSessionReady(ctx);
  }

  return {
    setup,
    teardown,
    executeQueued,
    inspectPane,
    isSetUp: () => isSetUp,
    getStatusDetails: (): RelayStatusDetails => ({
      shell: detectShell(),
      paneId: zellij?.getPaneId() ?? 'unknown',
      sessionName: zellijSessionName ?? 'unknown',
      signalPath: fifoManager?.paths.signal ?? 'n/a',
    }),
    getCurrentSessionName: () => zellijSessionName ?? undefined,
    getStoredSessionName: () => storedRelaySessionName,
    restoreStoredSessionFromBranch,
    onSessionReady,
    onSessionSwitch,
  };
}
