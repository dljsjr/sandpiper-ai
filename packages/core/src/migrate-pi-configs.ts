/**
 * Pi config migration functions.
 *
 * Migrates configuration from ~/.pi and ./.pi to ~/.sandpiper and ./.sandpiper.
 * Supports both move (rename) and symlink modes.
 */

import { existsSync, mkdirSync, renameSync, symlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

export type MigrationMode = 'move' | 'symlink';
export type MigrationScope = 'both' | 'global' | 'local';

export interface MigrationResult {
  success: boolean;
  error?: string;
  migrated: string[];
  skipped: string[];
}

export interface MigrationOptions {
  cwd: string;
  scope?: MigrationScope;
}

interface MigrationTarget {
  from: string;
  to: string;
  label: string;
}

/**
 * Get the old pi agent directory (before sandpiper override).
 * Respects user's PI_CODING_AGENT_DIR if they set it (captured as __PI_CODING_AGENT_DIR_ORIGINAL
 * by pi_wrapper.ts before remapping SANDPIPER_* → PI_*).
 */
export function getOldPiAgentDir(): string {
  const original = process.env.__PI_CODING_AGENT_DIR_ORIGINAL;
  if (original) {
    return resolve(original);
  }
  return join(homedir(), '.pi', 'agent');
}

/**
 * Get the new sandpiper agent directory.
 * Reads SANDPIPER_CODING_AGENT_DIR directly — the user-facing env var for overriding
 * the sandpiper config location (APP_NAME = "sandpiper", so ENV_AGENT_DIR = "SANDPIPER_CODING_AGENT_DIR").
 */
export function getNewSandpiperAgentDir(): string {
  const sandpiperDir = process.env.SANDPIPER_CODING_AGENT_DIR;
  if (sandpiperDir) {
    return resolve(sandpiperDir);
  }
  return join(homedir(), '.sandpiper', 'agent');
}

/**
 * Parse migration scope from flag values.
 */
export function parseMigrationScope(global: boolean, local: boolean): MigrationScope {
  if (global && local) return 'both';
  if (global) return 'global';
  if (local) return 'local';
  return 'both';
}

/**
 * Detect unmigrated configs.
 * Returns array of resolved paths describing what needs migration.
 */
export function detectUnmigratedConfigs(cwd: string): string[] {
  const unmigrated: string[] = [];

  const oldGlobal = getOldPiAgentDir();
  const newGlobal = getNewSandpiperAgentDir();
  if (existsSync(oldGlobal) && !existsSync(newGlobal)) {
    unmigrated.push(oldGlobal);
  }

  const oldLocal = join(cwd, '.pi');
  const newLocal = join(cwd, '.sandpiper');
  if (existsSync(oldLocal) && !existsSync(newLocal)) {
    unmigrated.push(oldLocal);
  }

  return unmigrated;
}

/**
 * Get migration targets based on scope.
 */
function getMigrationTargets(options: MigrationOptions): MigrationTarget[] {
  const { cwd, scope = 'both' } = options;
  const targets: MigrationTarget[] = [];

  if (scope === 'both' || scope === 'global') {
    const from = getOldPiAgentDir();
    targets.push({ from, to: getNewSandpiperAgentDir(), label: from });
  }

  if (scope === 'both' || scope === 'local') {
    const from = join(cwd, '.pi');
    targets.push({ from, to: join(cwd, '.sandpiper'), label: from });
  }

  return targets;
}

/**
 * Move (rename) a directory from one location to another.
 */
function moveDirectory(from: string, to: string): { success: boolean; error?: string } {
  try {
    const parentDir = dirname(to);
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }
    renameSync(from, to);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Create a symlink pointing from `to` → `from`.
 */
function symlinkDirectory(from: string, to: string): { success: boolean; error?: string } {
  try {
    const parentDir = dirname(to);
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }
    symlinkSync(from, to);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Perform migration (move or symlink).
 */
export async function performMigration(mode: MigrationMode, options: MigrationOptions): Promise<MigrationResult> {
  const targets = getMigrationTargets(options);
  const migrated: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  for (const { from, to, label } of targets) {
    if (!existsSync(from)) {
      skipped.push(label);
      continue;
    }

    if (existsSync(to)) {
      errors.push(`${label}: destination already exists (${to})`);
      continue;
    }

    const result = mode === 'move' ? moveDirectory(from, to) : symlinkDirectory(from, to);

    if (result.success) {
      migrated.push(label);
    } else {
      errors.push(`${label}: ${result.error}`);
    }
  }

  if (migrated.length === 0 && errors.length > 0) {
    return { success: false, error: errors.join('; '), migrated, skipped };
  }

  return {
    success: true,
    error: errors.length > 0 ? errors.join('; ') : undefined,
    migrated,
    skipped,
  };
}
