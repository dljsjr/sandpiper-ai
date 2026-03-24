import { execSync } from 'node:child_process';

/**
 * Escape a command string for safe passing to fish's `eval` via `__relay_run`.
 *
 * Uses fish-compatible quote-break pattern: single quotes with embedded
 * quotes via '"'"' (end quote, double-quoted quote, re-open quote).
 * Fish single quotes have NO escape sequences — not even \'.
 *
 * This module is framework-independent — no pi/sandpiper imports.
 */
export function escapeForFish(command: string): string {
  if (command.length === 0) {
    return "''";
  }

  // Fish single quotes don't support ANY escape sequences — not even \'.
  // To include a literal single quote, we must:
  //   1. End the single-quoted string
  //   2. Append a single quote wrapped in double quotes: "'"
  //   3. Re-open the single-quoted string
  // e.g., "it's" becomes 'it'"'"'s'
  return `'${command.replace(/'/g, "'\"'\"'")}'`;
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
