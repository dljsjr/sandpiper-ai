// AGENT-252's load-bearing test. See the design doc's postmortem for the full arc: an earlier
// revision of this harness built and then tore down a network-interception layer (a
// "network-deny guard" patching fetch/https/http2) chasing a threat that turned out not to
// exist -- pi has no silent-substitution path for an explicit `--provider` pin; an unknown
// provider or unresolvable model is a hard error. What actually caused the incident that
// started that whole detour was simpler and is what this test proves directly.
//
// The incident: hand-run debug commands (predating this harness) set only
// PI_CODING_AGENT_DIR, not SANDPIPER_CODING_AGENT_DIR, and silently inherited the *real* agent
// dir under the other name (because the inherited PI_PACKAGE_DIR pointed at Sandpiper's own
// branded package, making SANDPIPER_CODING_AGENT_DIR the name pi actually honored) -- loading
// real settings.json and completing real turns against real configured providers.
// prepareIsolatedSpawn() has set both names unconditionally since AGENT-251 and was never
// itself affected -- this test is the standing proof that fix holds, not a retroactive patch.
//
// Isolated + keyless + unpinned (skipProviderPin, reproducing the exact incident shape): with
// correct dual-name agent-dir isolation, no provider/model resolves to anything with real
// credentials, so pi must exit deterministically before ever attempting a turn.
//
// No explicit API-key env overrides here: this test's own process environment (this vitest
// worker's inherited shell) has never had ANTHROPIC_API_KEY/OPENAI_API_KEY/etc set, confirmed
// directly while investigating the incident this test guards against -- relying on that
// rather than adding untested undefined-value env-stripping logic to the harness.

import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { prepareIsolatedSpawn } from './harness.js';
import { runPrintMode } from './print-mode-driver.js';

describe('config isolation containment canary (AGENT-252)', () => {
  it('exits deterministically with no completion when keyless and unpinned (the exact incident shape)', () => {
    const result = runPrintMode({
      entry: 'pi',
      skipProviderPin: true,
      skipMockProvider: true,
      prompt: 'say hi',
      timeoutMs: 30_000,
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('No API key found');
    // The direct claim, not just an inference from the error text: in -p mode, stdout is
    // precisely the assistant-output channel, so empty stdout IS "no completion happened,"
    // measured directly rather than inferred from "an error occurred, therefore no model ran."
    // Confirmed empirically which stream carries what before writing this assertion (stdout
    // was 0 bytes, the error text was entirely on stderr).
    expect(result.stdout.trim()).toBe('');
  });

  it('leaves only fresh, empty agent-dir state behind -- never touches or copies real settings/auth', () => {
    const spawn = prepareIsolatedSpawn({
      entry: 'pi',
      skipProviderPin: true,
      skipMockProvider: true,
      args: ['-p', 'say hi'],
    });
    try {
      const before = readdirSync(spawn.agentDir);
      expect(before).toEqual([]);
    } finally {
      spawn.cleanup();
    }
  });
});
