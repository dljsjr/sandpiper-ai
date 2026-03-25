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
 * Respects user's PI_CODING_AGENT_DIR if they set it (captured as __PI_CODING_AGENT_DIR_ORIGINAL).
 */
export function getOldPiAgentDir(): string {
  const original = process.env.__PI_CODING_AGENT_DIR_ORIGINAL;
  if (original) {
    return resolve(original);
  }
  // Default location
  return join(homedir(), '.pi', 'agent');
}

/**
 * Get the new sandpiper agent directory.
 * This is what pi sees as PI_CODING_AGENT_DIR (after our remapping).
 */
export function getNewSandpiperAgentDir(): string {
  const sandpiperDir = process.env.PI_CODING_AGENT_DIR;
  if (sandpiperDir) {
    return resolve(sandpiperDir);
  }
  // Default location (pi uses CONFIG_DIR_NAME from piConfig)
  return join(homedir(), '.sandpiper', 'agent');
}

/**
 * Detect unmigrated configs.
 * Returns array of paths describing what needs migration.
 */
export function detectUnmigratedConfigs(cwd: string): string[] {
  const unmigrated: string[] = [];

  // Check global config
  const oldGlobal = getOldPiAgentDir();
  const newGlobal = getNewSandpiperAgentDir();
  if (existsSync(oldGlobal) && !existsSync(newGlobal)) {
    unmigrated.push(oldGlobal);
  }

  // Check project-local config
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
    targets.push({
      from,
      to: getNewSandpiperAgentDir(),
      label: from,
    });
  }

  if (scope === 'both' || scope === 'local') {
    const from = join(cwd, '.pi');
    targets.push({
      from,
      to: join(cwd, '.sandpiper'),
      label: from,
    });
  }

  return targets;
}

/**
 * Move (rename) a directory from one location to another.
 */
function moveDirectory(from: string, to: string): { success: boolean; error?: string } {
  try {
    // Ensure parent directory exists
    const parentDir = dirname(to);
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }

    renameSync(from, to);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Create a symlink from target back to source.
 */
function symlinkDirectory(from: string, to: string): { success: boolean; error?: string } {
  try {
    // For symlink, we create `to` as a symlink pointing to `from`
    // The parent of `to` must exist
    const parentDir = dirname(to);
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }

    // Create the symlink
    symlinkSync(from, to);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
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
    // Source doesn't exist — nothing to migrate
    if (!existsSync(from)) {
      skipped.push(label);
      continue;
    }

    // Destination already exists — error
    if (existsSync(to)) {
      errors.push(`${label}: destination already exists (${to})`);
      continue;
    }

    // Perform the migration
    const result = mode === 'move' ? moveDirectory(from, to) : symlinkDirectory(from, to);

    if (result.success) {
      migrated.push(label);
    } else {
      errors.push(`${label}: ${result.error}`);
    }
  }

  // If nothing was migrated and we have errors, report failure
  if (migrated.length === 0 && errors.length > 0) {
    return {
      success: false,
      error: errors.join('; '),
      migrated,
      skipped,
    };
  }

  // If nothing was migrated and nothing was skipped, nothing to do
  if (migrated.length === 0 && skipped.length === targets.length) {
    return {
      success: true,
      migrated,
      skipped,
    };
  }

  // Partial or full success
  return {
    success: true,
    error: errors.length > 0 ? errors.join('; ') : undefined,
    migrated,
    skipped,
  };
}
