// Print-mode (`-p`) driver for one-shot prompt/stdout assertions. See
// devtools/integration/README.md and AGENT-248 for the print-mode landmines this driver exists to
// handle by construction rather than per-test.

import { spawnSync } from 'node:child_process';
import { type IsolatedSpawnOptions, prepareIsolatedSpawn } from './harness.js';

export interface PrintModeResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
}

export interface RunPrintModeOptions extends Omit<IsolatedSpawnOptions, 'args'> {
  readonly prompt: string;
  readonly extraArgs?: readonly string[];
  readonly timeoutMs?: number;
}

/**
 * Run pi/sandpiper in `-p` (print) mode against a single prompt and capture stdout/stderr.
 *
 * Handles the AGENT-248 print-mode landmines by construction:
 * - stdin is `'ignore'` (Node redirects the child's stdin to /dev/null), so pi's
 *   readPipedStdin() sees immediate EOF instead of hanging waiting for input that will never
 *   arrive under a headless spawn.
 * - `--provider`/`--model` are always pinned to the mock (via prepareIsolatedSpawn), so model
 *   resolution never falls through to a missing-API-key exit or an ambient credential.
 * - nothing here depends on `ctx.shutdown()`-driven extension behavior; print mode's own
 *   process exit ends the run, not an extension's shutdown hook (the exact assumption that
 *   broke in AGENT-248 -- print mode never wires a real shutdownHandler).
 */
export function runPrintMode(options: RunPrintModeOptions): PrintModeResult {
  const spawn = prepareIsolatedSpawn({
    ...options,
    args: ['-p', options.prompt, ...(options.extraArgs ?? [])],
  });

  try {
    const result = spawnSync(spawn.command, spawn.args, {
      cwd: spawn.cwd,
      env: spawn.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf-8',
      timeout: options.timeoutMs ?? 30_000,
    });

    return {
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      exitCode: result.status,
    };
  } finally {
    spawn.cleanup();
  }
}
