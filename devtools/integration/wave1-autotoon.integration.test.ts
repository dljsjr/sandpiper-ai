// AGENT-253 wave-1 coverage: autotoon (plugins/pi/extensions/autotoon.ts), isolated and
// combinatoric. Real observable behavior: the actual TOON_HEADER-prefixed, TOON-encoded text
// autotoon's pi.on('tool_result', ...) hook produces, delivered through a real RPC
// tool_execution_end event for a real tool_result pi's own hook pipeline transformed.
//
// MIN_JSON_BYTES (packages/capability-autotoon/src/core.ts) is 256 -- conversion only
// triggers above that threshold, so every JSON payload here is deliberately padded past it;
// a smaller payload would silently skip conversion and prove nothing.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { JsonObject } from '@earendil-works/pi-ai';
import { describe, expect, it } from 'vitest';
import { encodeMockScript, MOCK_SCRIPT_ENV_VAR } from './mock-provider.js';
import { PROBE_TOOL_NAME } from './probe-tool.js';
import { startRpcSession } from './rpc-driver.js';

const SMOKE_TIMEOUT_MS = 60_000;
const integrationDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(dirname(integrationDir));
const AUTOTOON_PATH = join(repoRoot, 'plugins', 'pi', 'extensions', 'autotoon.ts');
const PROBE_TOOL_PATH = join(integrationDir, 'probe-tool.ts');

const TOON_HEADER = '[TOON]\n';

/** A JSON payload well over autotoon's 256-byte MIN_JSON_BYTES threshold. */
function largeJsonArguments(): JsonObject {
  return {
    items: Array.from({ length: 20 }, (_, index) => ({ id: index, label: `padding-item-${index}` })),
  };
}

describe('wave 1: autotoon, isolated (AGENT-253)', () => {
  it(
    'converts a large JSON bash-tool result to TOON, with only autotoon loaded (no other custom extension)',
    async () => {
      const largeJson = JSON.stringify({ values: Array.from({ length: 20 }, (_, i) => `padding-value-${i}`) });
      expect(largeJson.length).toBeGreaterThan(256);

      const script = encodeMockScript([
        { type: 'toolCall', toolName: 'bash', arguments: { command: `printf '%s' '${largeJson}'` } },
        { type: 'text', text: 'converted' },
      ]);

      const session = startRpcSession({
        entry: 'pi',
        extraExtensions: [AUTOTOON_PATH],
        env: { [MOCK_SCRIPT_ENV_VAR]: script },
        commandTimeoutMs: SMOKE_TIMEOUT_MS,
      });

      try {
        await session.sendCommand({ type: 'prompt', message: 'print some JSON' });

        const toolExecutionEnd = await session.waitForEvent(
          (event) => event.type === 'tool_execution_end' && event.toolName === 'bash',
          SMOKE_TIMEOUT_MS,
        );
        expect(toolExecutionEnd.isError).toBeFalsy();

        const result = toolExecutionEnd.result as { content: Array<{ type: string; text?: string }> };
        const textBlock = result.content.find((block) => block.type === 'text');
        expect(textBlock?.text).toContain(TOON_HEADER);
        expect(textBlock?.text).toContain('padding-value-0');

        await session.waitForEvent((event) => event.type === 'agent_settled', SMOKE_TIMEOUT_MS);
      } finally {
        await session.close();
      }
    },
    SMOKE_TIMEOUT_MS + 5_000,
  );
});

describe('wave 1: autotoon + probe tool, combinatoric (AGENT-253)', () => {
  it(
    "transforms another extension tool's JSON result -- the real cross-extension seam autotoon exists for",
    async () => {
      const args = largeJsonArguments();
      expect(JSON.stringify(args).length).toBeGreaterThan(256);

      const script = encodeMockScript([
        { type: 'toolCall', toolName: PROBE_TOOL_NAME, arguments: args },
        { type: 'text', text: 'transformed' },
      ]);

      const session = startRpcSession({
        entry: 'pi',
        extraExtensions: [AUTOTOON_PATH, PROBE_TOOL_PATH],
        env: { [MOCK_SCRIPT_ENV_VAR]: script },
        commandTimeoutMs: SMOKE_TIMEOUT_MS,
      });

      try {
        await session.sendCommand({ type: 'prompt', message: 'run the probe tool with a large payload' });

        const toolExecutionEnd = await session.waitForEvent(
          (event) => event.type === 'tool_execution_end' && event.toolName === PROBE_TOOL_NAME,
          SMOKE_TIMEOUT_MS,
        );
        expect(toolExecutionEnd.isError).toBeFalsy();

        // probe-tool.ts itself only ever returns plain JSON.stringify(params) -- if this text
        // carries the TOON header, it was autotoon's tool_result hook that put it there, not
        // the probe tool itself. That's the seam: an extension the probe tool has no
        // knowledge of transformed its output after the fact.
        const result = toolExecutionEnd.result as { content: Array<{ type: string; text?: string }> };
        const textBlock = result.content.find((block) => block.type === 'text');
        expect(textBlock?.text).toContain(TOON_HEADER);
        expect(textBlock?.text).toContain('padding-item-0');

        await session.waitForEvent((event) => event.type === 'agent_settled', SMOKE_TIMEOUT_MS);
      } finally {
        await session.close();
      }
    },
    SMOKE_TIMEOUT_MS + 5_000,
  );

  it('leaves a small JSON result unconverted (below MIN_JSON_BYTES), proving the threshold is real not cosmetic', async () => {
    const smallArgs = { ok: true };
    expect(JSON.stringify(smallArgs).length).toBeLessThan(256);

    const script = encodeMockScript([
      { type: 'toolCall', toolName: PROBE_TOOL_NAME, arguments: smallArgs },
      { type: 'text', text: 'done' },
    ]);

    const session = startRpcSession({
      entry: 'pi',
      extraExtensions: [AUTOTOON_PATH, PROBE_TOOL_PATH],
      env: { [MOCK_SCRIPT_ENV_VAR]: script },
      commandTimeoutMs: SMOKE_TIMEOUT_MS,
    });

    try {
      await session.sendCommand({ type: 'prompt', message: 'run the probe tool with a small payload' });

      const toolExecutionEnd = await session.waitForEvent(
        (event) => event.type === 'tool_execution_end' && event.toolName === PROBE_TOOL_NAME,
        SMOKE_TIMEOUT_MS,
      );
      const result = toolExecutionEnd.result as { content: Array<{ type: string; text?: string }> };
      const textBlock = result.content.find((block) => block.type === 'text');
      expect(textBlock?.text).not.toContain(TOON_HEADER);
      expect(textBlock?.text).toBe(JSON.stringify(smallArgs));
    } finally {
      await session.close();
    }
  });
});
