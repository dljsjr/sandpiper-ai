/**
 * Generate shell-appropriate environment variable export commands.
 *
 * This module is framework-independent — no pi/sandpiper imports.
 */

export type ShellType = 'fish' | 'bash' | 'zsh';

export interface EnvVar {
  readonly name: string;
  readonly value: string;
}

/**
 * Generate an export command for a single environment variable
 * in the syntax appropriate for the given shell.
 */
export function exportVar(shell: ShellType, envVar: EnvVar): string {
  const { name, value } = envVar;
  switch (shell) {
    case 'fish':
      return `set -gx ${name} '${escapeSingleQuotes(value)}'`;
    case 'bash':
    case 'zsh':
      return `export ${name}='${escapeSingleQuotes(value)}'`;
  }
}

/**
 * Generate a single command string that exports multiple environment
 * variables, joined with the appropriate separator for the shell.
 */
export function exportVars(shell: ShellType, vars: readonly EnvVar[]): string {
  return vars.map((v) => exportVar(shell, v)).join('; ');
}

/** Escape single quotes for inclusion in a single-quoted shell string. */
function escapeSingleQuotes(s: string): string {
  return s.replace(/'/g, "'\\''");
}
