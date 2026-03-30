/**
 * Pi config migration functions.
 *
 * Migrates configuration from ~/.pi and ./.pi to ~/.sandpiper and ./.sandpiper.
 * Supports both move (rename) and symlink modes.
 */

import { existsSync, mkdirSync, renameSync, symlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { resolveEnvVar } from './env.js';

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

function resolveConfiguredPath(path: string): string {
  if (path === '~') return homedir();
  if (path.startsWith('~/')) return join(homedir(), path.slice(2));
  return resolve(path);
}

/**
 * Get the old pi agent directory (before sandpiper override).
 * Respects user's PI_CODING_AGENT_DIR if they set it (captured as __PI_CODING_AGENT_DIR_ORIGINAL
 * by pi_wrapper.ts before remapping SANDPIPER_* → PI_*).
 */
export function getOldPiAgentDir(): string {
  const original = process.env.__PI_CODING_AGENT_DIR_ORIGINAL;
  if (original) {
    return resolveConfiguredPath(original);
  }
  return join(homedir(), '.pi', 'agent');
}

/**
 * Get the current sandpiper agent directory.
 * Uses the same SANDPIPER_* / PI_* mirrored override lookup route as the rest
 * of sandpiper via resolveEnvVar('CODING_AGENT_DIR').
 */
export function getNewSandpiperAgentDir(): string {
  const configuredDir = resolveEnvVar('CODING_AGENT_DIR');
  if (configuredDir) {
    return resolveConfiguredPath(configuredDir);
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

export interface ParsedMigrationArgs {
  mode: MigrationMode;
  scope: MigrationScope;
}

export interface ParsedMigrationArgsError {
  error: string;
}

/**
 * Parse slash command arguments for /migrate-pi.
 *
 * Valid forms:
 *   move
 *   symlink
 *   move --pi-configs-global
 *   move --pi-configs-local
 *   symlink --pi-configs-global
 *   symlink --pi-configs-local
 */
export function parseMigrationCommandArgs(args: string): ParsedMigrationArgs | ParsedMigrationArgsError {
  const tokens = args.trim().split(/\s+/).filter(Boolean);

  const [modeToken, ...rest] = tokens;

  if (modeToken !== 'move' && modeToken !== 'symlink') {
    return { error: 'Usage: /migrate-pi move|symlink [--pi-configs-global|--pi-configs-local]' };
  }

  const mode: MigrationMode = modeToken;
  const hasGlobal = rest.includes('--pi-configs-global');
  const hasLocal = rest.includes('--pi-configs-local');

  const unknownFlags = rest.filter((t) => t !== '--pi-configs-global' && t !== '--pi-configs-local');
  if (unknownFlags.length > 0) {
    return { error: `Unknown argument(s): ${unknownFlags.join(', ')}` };
  }

  return { mode, scope: parseMigrationScope(hasGlobal, hasLocal) };
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
