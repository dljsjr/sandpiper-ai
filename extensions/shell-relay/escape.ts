import { execSync } from "node:child_process";

/**
 * Escape a command string for safe passing to fish's `eval` via `__relay_run`.
 *
 * Uses fish's built-in `string escape --style=script` to produce a token
 * that round-trips through `eval (string unescape --style=script -- TOKEN)`.
 *
 * This delegates escaping to fish itself rather than reimplementing the rules,
 * ensuring correctness for all edge cases (quotes, pipes, dollar signs, etc.).
 *
 * This module is framework-independent — no pi/sandpiper imports.
 */
export function escapeForFish(command: string): string {
  if (command.length === 0) {
    return "''";
  }

  // Use fish to escape the string. We pass the command via stdin to avoid
  // any shell interpretation of the command string by the parent shell.
  const result = execSync("fish -c 'read -z cmd; string escape --style=script -- $cmd'", {
    input: command,
    encoding: "utf-8",
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

  const result = execSync("printf '%q' \"$CMD\"", {
    encoding: "utf-8",
    timeout: 5000,
    env: { ...process.env, CMD: command },
  });

  return result;
}
