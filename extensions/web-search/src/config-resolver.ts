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

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAgentDir } from '@earendil-works/pi-coding-agent';

// ---------------------------------------------------------------------------
// Shell-command cache
// ---------------------------------------------------------------------------

const commandCache = new Map<string, string>();

function resolveCommand(value: string): string | undefined {
  const cached = commandCache.get(value);
  if (cached !== undefined) return cached || undefined;

  try {
    // Run through the shell (matching Pi's resolveConfigValue) so quoted args and
    // pipes work — e.g. `op read 'op://Personal/.../credential'`. The command comes
    // from the user's own config, so a shell is appropriate here.
    const stdout = execSync(value, {
      encoding: 'utf-8',
      timeout: 10_000,
      maxBuffer: 64 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const result = stdout.trim();
    commandCache.set(value, result);
    return result || undefined;
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

export interface SettingsContext {
  readonly cwd: string;
  readonly projectTrusted: boolean;
}

/**
 * Settings.json locations to check, in priority order (trusted project wins over global).
 * Global lives at the agent dir: SANDPIPER_CODING_AGENT_DIR or ~/.sandpiper/agent
 * (NOT ~/.sandpiper). Project-local is .sandpiper/settings.json relative to cwd.
 */
function settingsPaths(context: SettingsContext): string[] {
  // Project-local first (cwd), then the global agent-dir settings. Pi's getAgentDir()
  // resolves the correct dir (~/.sandpiper/agent, honoring SANDPIPER_CODING_AGENT_DIR and
  // branding) — the canonical source rather than a hand-rolled home path.
  const paths: string[] = context.projectTrusted ? [join(context.cwd, '.sandpiper', 'settings.json')] : [];
  try {
    const dir = getAgentDir();
    if (dir) paths.push(join(dir, 'settings.json'));
  } catch {
    // getAgentDir unavailable (e.g. Pi config not initialized in a bare test context).
  }
  return paths;
}

/**
 * Read a key from the nearest sandpiper settings.json.
 * Checks trusted project-local settings first, then the global agent-dir settings. Returns undefined
 * when neither exists or the key is missing.
 */
export function readSettingsKey(key: string, context: SettingsContext): unknown | undefined {
  for (const fullPath of settingsPaths(context)) {
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
