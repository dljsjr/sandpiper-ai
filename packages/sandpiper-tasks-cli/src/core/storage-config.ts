import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─── Types ───────────────────────────────────────────────────────

export interface TaskStorageMode {
  /** Branch name. "@" means inline on the current/default branch. */
  readonly branch: string;
  /** Remote URL for an external task repository. Omit to use the current repo. */
  readonly repo?: string;
}

export interface TaskVersionControlConfig {
  /** Whether tasks are tracked by VCS at all. */
  readonly enabled: boolean;
  readonly mode: TaskStorageMode;
  /**
   * Auto-commit task mutations to the task branch.
   * Only applies in separate-branch or external-repo mode.
   */
  readonly auto_commit: boolean;
  /**
   * Auto-push after every auto-commit.
   * Requires auto_commit: true. Only applies in separate-branch / external-repo mode.
   */
  readonly auto_push: boolean;
}

export interface TaskStorageConfig {
  readonly version_control: TaskVersionControlConfig;
}

// ─── Defaults ────────────────────────────────────────────────────

/**
 * Default config: inline mode (tasks tracked on the current branch), no
 * auto-commit or auto-push. Equivalent to current behaviour before Phase 2.
 */
export const DEFAULT_STORAGE_CONFIG: TaskStorageConfig = {
  version_control: {
    enabled: true,
    mode: { branch: '@' },
    auto_commit: false,
    auto_push: false,
  },
};

// ─── Resolution ──────────────────────────────────────────────────

/**
 * Resolve task storage configuration for a project root directory.
 *
 * Precedence (highest to lowest):
 *   1. `.sandpiper-tasks.json` at the project root
 *   2. `tasks` key inside `.sandpiper/settings.json`
 *   3. {@link DEFAULT_STORAGE_CONFIG}
 *
 * Partial configs are merged with the defaults so callers always get a
 * fully-populated object.
 */
export function resolveStorageConfig(rootDir: string): TaskStorageConfig {
  const standalone = join(rootDir, '.sandpiper-tasks.json');
  if (existsSync(standalone)) {
    return mergeWithDefaults(parseJson(standalone));
  }

  const settings = join(rootDir, '.sandpiper', 'settings.json');
  if (existsSync(settings)) {
    const raw = parseJson(settings) as Record<string, unknown>;
    if (raw.tasks !== undefined) {
      return mergeWithDefaults(raw.tasks);
    }
  }

  return DEFAULT_STORAGE_CONFIG;
}

// ─── Internals ───────────────────────────────────────────────────

function parseJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return {};
  }
}

function mergeWithDefaults(raw: unknown): TaskStorageConfig {
  const d = DEFAULT_STORAGE_CONFIG;
  const vc = isRecord(raw) ? (raw.version_control as Record<string, unknown> | undefined) : undefined;
  const mode = isRecord(vc) ? (vc.mode as Record<string, unknown> | undefined) : undefined;

  return {
    version_control: {
      enabled: boolOr(vc?.enabled, d.version_control.enabled),
      mode: {
        branch: stringOr(mode?.branch, d.version_control.mode.branch),
        ...(typeof mode?.repo === 'string' ? { repo: mode.repo } : {}),
      },
      auto_commit: boolOr(vc?.auto_commit, d.version_control.auto_commit),
      auto_push: boolOr(vc?.auto_push, d.version_control.auto_push),
    },
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function stringOr(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

function boolOr(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}
