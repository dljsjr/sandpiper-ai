/**
 * Config value resolver — mirrors Pi's `resolveConfigValue` without importing internals.
 *
 * Supports three value patterns, matching Pi's UX exactly:
 *
 *   - `!command`   — executes the rest as a shell command, returns stdout (trimmed).
 *                    Cached for process lifetime so repeated reads don't re-invoke.
 *   - `$VAR`       — interpolates a named environment variable.
 *   - `${VAR}`     — same, with optional braces for disambiguation.
 *   - `literal`    — returned as-is.
 *   - `$$`         — escape to a literal `$` (inside literal values only).
 *   - `$!`         — escape to a literal `!` (inside literal values only).
 *
 * Extensions that need config (e.g. a Brave API key) can use `resolveConfigValue()`
 * at startup to support all three patterns, or read env vars directly with `process.env`.
 * This file is the general-purpose path for "I want Pi's secret-resolver UX."
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Shell-command cache
// ---------------------------------------------------------------------------

const commandCache = new Map<string, string>();

function resolveCommand(value: string): string | undefined {
  const cached = commandCache.get(value);
  if (cached !== undefined) return cached;

  try {
    // Split on whitespace so execFileSync doesn't need a shell.
    const [cmd, ...args] = value.split(/\s+/);
    if (!cmd) return undefined;
    const stdout = execFileSync(cmd, args, {
      encoding: 'utf-8',
      timeout: 10_000,
      maxBuffer: 64 * 1024,
    });
    const result = stdout.trim();
    commandCache.set(value, result);
    return result;
  } catch {
    commandCache.set(value, '');
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Resolve a config value to its actual string, or undefined when unresolvable.
 *
 * - `!command`        → shell command, stdout trimmed, process-lifetime cached.
 * - `$VAR` / `${VAR}` → env var interpolation (multiple vars supported).
 * - `$$`              → literal `$`  (only meaningful inside literal values).
 * - `$!`              → literal `!`  (only meaningful inside literal values).
 * - bare text         → returned as-is.
 */
export function resolveConfigValue(config: string | undefined): string | undefined {
  if (config === undefined || config === '') return undefined;

  // Shell-command form: !command args
  if (config.startsWith('!')) {
    return resolveCommand(config.slice(1));
  }

  // Env-interpolation: $VAR or ${VAR} anywhere in the string, with $$/$! escapes.
  // First, replace $$ with a sentinel, $! with another sentinel.
  const SENTINEL_DOLLAR = '\x00DOLLAR\x00';
  const SENTINEL_BANG = '\x00BANG\x00';
  let result = config.replace(/\$\$/g, SENTINEL_DOLLAR).replace(/\$!/g, SENTINEL_BANG);

  // Replace ${VAR} and $VAR patterns.
  result = result.replace(/\$\{([^}]+)\}|\$([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, braced, unbraced) => {
    const name = braced ?? unbraced;
    return process.env[name] ?? '';
  });

  // Restore sentinels.
  result = result.replace(SENTINEL_DOLLAR, '$').replace(SENTINEL_BANG, '!');
  return result;
}

// ---------------------------------------------------------------------------
// Settings.json helpers
// ---------------------------------------------------------------------------

/** Paths to check, in priority order (project wins over global). */
const SETTINGS_PATHS = ['.sandpiper/settings.json', '~/.sandpiper/settings.json'];

/**
 * Read a key from the nearest sandpiper settings.json.
 * Checks project-local first, then global. Returns undefined when neither exists
 * or the key is missing.
 */
export function readSettingsKey(key: string): unknown | undefined {
  const homedir = process.env.HOME ?? '';
  for (const relative of SETTINGS_PATHS) {
    const resolved = relative.startsWith('~') ? relative.replace('~', homedir) : relative;
    const fullPath = resolved.startsWith('/') ? resolved : `${process.cwd()}/${resolved}`;
    if (!existsSync(fullPath)) continue;
    try {
      const raw = readFileSync(fullPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed !== null && typeof parsed === 'object' && key in parsed) {
        return (parsed as Record<string, unknown>)[key];
      }
    } catch {
      // Malformed JSON or permission error — skip silently.
    }
  }
  return undefined;
}
