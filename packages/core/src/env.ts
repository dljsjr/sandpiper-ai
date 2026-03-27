/**
 * Environment variable resolution with SANDPIPER_* / PI_* namespace mirroring.
 *
 * Sandpiper mirrors user-facing PI_* env vars into the SANDPIPER_* namespace
 * (and vice versa) via pi_wrapper.ts. This module provides a single lookup
 * function that checks SANDPIPER_* first, then falls back to PI_*.
 *
 * Four PI_* variables are exempt from mirroring — they are set by
 * pi_wrapper.ts to control sandpiper/pi behavior and must be accessed
 * via process.env.PI_* directly:
 *
 *   Sandpiper internals (capture pi package info for self-improvement prompting):
 *   - PI_CODING_AGENT_PACKAGE — path to the pi-coding-agent package root
 *   - PI_CODING_AGENT_VERSION — version of the underlying pi-coding-agent
 *
 *   Pi behavior controls (set by sandpiper, may also be user-set):
 *   - PI_PACKAGE_DIR — the package directory pi loads extensions/skills from
 *   - PI_SKIP_VERSION_CHECK — suppresses pi's built-in update check (sandpiper has its own)
 */

/**
 * Unprefixed names of PI_* variables that are exempt from namespace mirroring.
 * These must not be looked up through resolveEnvVar — access them
 * directly via process.env.PI_*.
 */
const EXEMPT_VAR_NAMES = new Set(['PACKAGE_DIR', 'CODING_AGENT_PACKAGE', 'CODING_AGENT_VERSION', 'SKIP_VERSION_CHECK']);

/**
 * Resolve a sandpiper/pi environment variable by unprefixed name.
 *
 * Lookup order:
 *   1. `SANDPIPER_{name}` — user-set sandpiper config takes precedence
 *   2. `PI_{name}` — fallback to pi-namespaced equivalent
 *   3. `undefined` — neither is set
 *
 * @param name - The unprefixed variable name (e.g., `"OFFLINE"` to resolve
 *   `SANDPIPER_OFFLINE` / `PI_OFFLINE`)
 * @returns The value of the first defined variable, or `undefined`
 * For the 4 exempt variables (PI_PACKAGE_DIR, PI_CODING_AGENT_PACKAGE,
 * PI_CODING_AGENT_VERSION, PI_SKIP_VERSION_CHECK), this function skips
 * the SANDPIPER_* lookup and returns the PI_* value directly. These
 * vars are set by pi_wrapper.ts and should not exist in the SANDPIPER_*
 * namespace. Prefer accessing them via `process.env.PI_*` directly for
 * clarity, but this function won't break if you pass them.
 *
 * @example
 * ```ts
 * // Check if offline mode is enabled
 * if (resolveEnvVar('OFFLINE') === '1') { ... }
 *
 * // Read the agent config directory override
 * const dir = resolveEnvVar('CODING_AGENT_DIR');
 * ```
 */
export function resolveEnvVar(name: string): string | undefined {
  if (EXEMPT_VAR_NAMES.has(name)) {
    return process.env[`PI_${name}`];
  }
  return process.env[`SANDPIPER_${name}`] ?? process.env[`PI_${name}`];
}
