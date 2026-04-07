import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { encode } from '@toon-format/toon';

// ─────────────────────────────────────────────────────────────────────────────
// 🎤 AUTOTOON — Token Pitch Correction for Your JSON
// Like Auto-Tune, but for tokens. Because even your data deserves to sound good.
// ─────────────────────────────────────────────────────────────────────────────

// --- Configuration ---

/**
 * Minimum byte length of JSON text before attempting TOON conversion.
 * Below this threshold, token savings are negligible and the overhead
 * of parsing + re-encoding isn't worth it.
 */
export const MIN_JSON_BYTES = 256;

/**
 * Maximum byte length of JSON text to attempt conversion on.
 * Very large payloads are already truncated by Pi's 50 KB limit;
 * this guard prevents spending CPU on near-limit payloads where
 * the converted output might exceed the limit anyway.
 */
export const MAX_JSON_BYTES = 100_000;

/**
 * Prefix prepended to converted output so the LLM (and humans reading
 * session transcripts) can distinguish TOON from raw text.
 */
export const TOON_HEADER = '[TOON]\n';

/**
 * Attempt to convert JSON text to TOON format.
 *
 * Returns null if:
 * - Text doesn't look like JSON (doesn't start with { or [)
 * - Text is below MIN_JSON_BYTES threshold
 * - Text is above MAX_JSON_BYTES threshold
 * - Text is not valid JSON
 * - TOON encoding is not shorter than the original
 *
 * Returns the TOON-encoded string with TOON_HEADER prefix if conversion succeeds.
 */
export function tryConvertJsonToToon(text: string): string | null {
  // Fast-reject: must start with { or [ after trimming whitespace
  const trimmed = text.trimStart();
  if (trimmed[0] !== '{' && trimmed[0] !== '[') {
    return null;
  }

  // Size gate
  if (text.length < MIN_JSON_BYTES || text.length > MAX_JSON_BYTES) {
    return null;
  }

  try {
    const parsed = JSON.parse(text);
    const toon = encode(parsed);

    // Only use TOON if it's actually shorter.
    // TOON can be *longer* for small objects, deeply nested non-uniform
    // structures, or single primitives.
    if (toon.length >= text.length) {
      return null;
    }

    return TOON_HEADER + toon;
  } catch {
    return null; // Not valid JSON — leave unchanged
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎤 Extension Entry Point — The Main Stage
// ─────────────────────────────────────────────────────────────────────────────

export default function autotoon(pi: ExtensionAPI): void {
  pi.on('tool_result', async (event) => {
    // 🎤 AutoTOON magic happens here

    // Never touch error results — even bad vocals need to stay raw
    if (event.isError) {
      return;
    }

    let modified = false;
    const newContent = event.content.map((block) => {
      if (block.type !== 'text') {
        return block;
      }

      const converted = tryConvertJsonToToon(block.text);
      if (converted === null) {
        return block;
      }

      modified = true;
      return { ...block, text: converted };
    });

    if (!modified) {
      return; // No patches → don't chain
    }

    return { content: newContent };
  });
}
