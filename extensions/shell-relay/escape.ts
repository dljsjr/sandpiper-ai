import { execSync } from 'node:child_process';

/**
 * Escape a command string for safe passing to fish's `eval` via `__relay_run`.
 *
 * Delegates to fish's built-in `string escape --style=script` via subprocess.
 * The command is passed via stdin to avoid shell interpretation.
 *
 * This module is framework-independent — no pi/sandpiper imports.
 */
export function escapeForFish(command: string): string {
  if (command.length === 0) {
    return "''";
  }

  const result = execSync("fish -c 'read -z cmd; string escape --style=script -- $cmd'", {
    input: command,
    encoding: 'utf-8',
    timeout: 5000,
  });

  return result.trimEnd();
}

/**
 * Escape a command string for safe passing to bash/zsh's `eval` via `__relay_run`.
 *
 * Uses `printf '%q'` to produce a shell-escaped string.
 */
export function escapeForBash(command: string): string {
  if (command.length === 0) {
    return "''";
  }

  const result = execSync('printf \'%q\' "$CMD"', {
    encoding: 'utf-8',
    timeout: 5000,
    env: { ...process.env, CMD: command },
  });

  return result;
}
