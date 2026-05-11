import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type VersionControlSystem = 'jj' | 'git' | 'hg' | 'svn' | 'fossil' | 'perforce' | 'none' | 'unknown';

export interface SandpiperVersionControlContext {
  readonly system: VersionControlSystem;
  readonly colocatedGit?: boolean;
  readonly detection?: 'session_start';
}

export interface VersionControlDetectionDependencies {
  readonly fileExists?: (path: string) => boolean;
  readonly runCommand?: (command: string, args: readonly string[], cwd: string) => string;
}

function findAncestorContaining(cwd: string, name: string, fileExists: (path: string) => boolean): string | undefined {
  let current = cwd;
  while (true) {
    if (fileExists(join(current, name))) return current;
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function defaultRunCommand(command: string, args: readonly string[], cwd: string): string {
  return execFileSync(command, [...args], {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 1000,
  });
}

function detectJjColocation(
  cwd: string,
  runCommand: (command: string, args: readonly string[], cwd: string) => string,
) {
  try {
    const output = runCommand('jj', ['git', 'colocation', 'status'], cwd);
    if (/not currently colocated/i.test(output)) return false;
    if (/currently colocated with Git/i.test(output)) return true;
  } catch {
    return undefined;
  }
  return undefined;
}

function isPerforceWorkspace(
  cwd: string,
  runCommand: (command: string, args: readonly string[], cwd: string) => string,
) {
  try {
    runCommand('p4', ['info'], cwd);
    return true;
  } catch {
    return false;
  }
}

export function detectVersionControl(
  cwd: string,
  dependencies: VersionControlDetectionDependencies = {},
): SandpiperVersionControlContext {
  const syncFileExists = dependencies.fileExists ?? existsSync;
  const runCommand = dependencies.runCommand ?? defaultRunCommand;

  const jjRoot = findAncestorContaining(cwd, '.jj', syncFileExists);
  if (jjRoot) {
    return {
      system: 'jj',
      colocatedGit: detectJjColocation(jjRoot, runCommand),
      detection: 'session_start',
    };
  }

  if (findAncestorContaining(cwd, '.git', syncFileExists)) {
    return { system: 'git', detection: 'session_start' };
  }

  if (findAncestorContaining(cwd, '.hg', syncFileExists)) {
    return { system: 'hg', detection: 'session_start' };
  }

  if (findAncestorContaining(cwd, '.svn', syncFileExists)) {
    return { system: 'svn', detection: 'session_start' };
  }

  if (
    findAncestorContaining(cwd, '.fslckout', syncFileExists) ||
    findAncestorContaining(cwd, '_FOSSIL_', syncFileExists)
  ) {
    return { system: 'fossil', detection: 'session_start' };
  }

  if (isPerforceWorkspace(cwd, runCommand)) {
    return { system: 'perforce', detection: 'session_start' };
  }

  return { system: 'none', detection: 'session_start' };
}
