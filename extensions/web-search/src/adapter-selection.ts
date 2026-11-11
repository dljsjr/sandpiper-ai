/**
 * Search-provider selection.
 *
 * Resolution order for the active SearchAdapter:
 *   1. An explicitly injected adapter (tests / overrides) wins.
 *   2. Brave, if a Brave API key resolves (keyed, primary).
 *   3. Parallel's free MCP search (no-key fallback) when no key is configured.
 *
 * DuckDuckGo remains implemented but is no longer the auto-fallback (it CAPTCHA-walls
 * server-side); Parallel's free anonymous MCP is the reliable no-key path.
 *
 * The Brave key is read from `BRAVE_API_KEY` (env) or `braveApiKey` (settings.json) and
 * resolved through the config-resolver, so it supports literals, `$VAR`, and `!cmd`
 * (e.g. `!op read 'op://Personal/.../credential'`) — the secret never lands in a file.
 */

import { BraveSearchAdapter } from './brave-adapter.js';
import { readSettingsKey, resolveConfigValue, type SettingsContext } from './config-resolver.js';
import { ParallelMcpSearchAdapter } from './parallel-adapter.js';
import type { SearchAdapter } from './types.js';

/** Resolve a Brave API key from env or settings.json, supporting literal / $VAR / !cmd forms. */
export function resolveBraveKey(context: SettingsContext): string | undefined {
  const envValue = process.env.BRAVE_API_KEY;
  if (envValue) {
    const resolved = resolveConfigValue(envValue);
    if (resolved) return resolved;
  }

  // settings.json: namespaced `web-search.braveApiKey` (or camelCase `webSearch`),
  // with a top-level `braveApiKey` fallback. The value may be a literal, $VAR, or
  // !cmd (e.g. !op read 'op://...').
  const nsBraveKey = (ns: unknown): unknown =>
    ns && typeof ns === 'object' ? (ns as Record<string, unknown>).braveApiKey : undefined;
  const candidates: unknown[] = [
    nsBraveKey(readSettingsKey('web-search', context)),
    nsBraveKey(readSettingsKey('webSearch', context)),
    readSettingsKey('braveApiKey', context),
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const resolved = resolveConfigValue(candidate);
      if (resolved) return resolved;
    }
  }

  return undefined;
}

/**
 * Pick the search adapter to use. Brave when a key is available; otherwise Parallel's
 * free MCP search (no key required, works anonymously).
 */
export function selectSearchAdapter(context: SettingsContext, explicit?: SearchAdapter): SearchAdapter {
  if (explicit) return explicit;

  const braveKey = resolveBraveKey(context);
  if (braveKey) return new BraveSearchAdapter(braveKey);

  return new ParallelMcpSearchAdapter();
}
