// AGENT-253 wave-1 coverage: the workspace runtime's `skill` tool.
// Real observable behavior asserted (not just exit code): the actual SKILL.md content for a
// real skill in this repo's catalogue, delivered through a real RPC tool_execution_end event
// for a real filesystem read pi's tool machinery performed.
//
// source:'filesystem' rather than source:'catalog': isolated spawns pass --no-skills (part of
// harness.ts's default isolation), so catalog discovery never runs -- filesystem is the
// correct way to exercise this tool in isolation, and is itself real coverage of the tool's
// documented fallback path for "a non-catalogued skill from a filesystem path."

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { encodeMockScript, MOCK_SCRIPT_ENV_VAR } from './mock-provider.js';
import { startRpcSession } from './rpc-driver.js';

const SMOKE_TIMEOUT_MS = 60_000;
const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const JJ_SKILL_DIR = join(repoRoot, 'packages', 'resources', 'skills', 'jj');

describe('wave 1: workspace skill tool (AGENT-253)', () => {
  it(
    'loads a real skill file from the filesystem through the real skill tool, via a real RPC session',
    async () => {
      const script = encodeMockScript([
        {
          type: 'toolCall',
          toolName: 'skill',
          arguments: { source: 'filesystem', path: JJ_SKILL_DIR },
        },
        { type: 'text', text: 'loaded the jj skill' },
      ]);

      const session = startRpcSession({
        entry: 'sandpiper',
        env: { [MOCK_SCRIPT_ENV_VAR]: script },
        commandTimeoutMs: SMOKE_TIMEOUT_MS,
      });

      try {
        const response = await session.sendCommand({ type: 'prompt', message: 'load the jj skill' });
        expect(response.success).toBe(true);

        const toolExecutionEnd = await session.waitForEvent(
          (event) => event.type === 'tool_execution_end' && event.toolName === 'skill',
          SMOKE_TIMEOUT_MS,
        );
        expect(toolExecutionEnd.isError).toBeFalsy();

        const result = toolExecutionEnd.result as { content: Array<{ type: string; text?: string }> };
        const textBlock = result.content.find((block) => block.type === 'text');
        // Real skill content, not a stub: the jj skill's own name attribute and a phrase from
        // its actual description, proving the tool read the real SKILL.md rather than
        // returning something synthetic.
        expect(textBlock?.text).toContain('name="jj"');
        expect(textBlock?.text).toContain('Jujutsu');

        await session.waitForEvent((event) => event.type === 'agent_settled', SMOKE_TIMEOUT_MS);
      } finally {
        await session.close();
      }
    },
    SMOKE_TIMEOUT_MS + 5_000,
  );

  it(
    'surfaces a real tool error for a skill path that does not exist, not a crash or hang',
    async () => {
      const script = encodeMockScript([
        {
          type: 'toolCall',
          toolName: 'skill',
          arguments: {
            source: 'filesystem',
            path: join(repoRoot, 'packages', 'resources', 'skills', 'does-not-exist'),
          },
        },
        { type: 'text', text: 'handled the error' },
      ]);

      const session = startRpcSession({
        entry: 'sandpiper',
        env: { [MOCK_SCRIPT_ENV_VAR]: script },
        commandTimeoutMs: SMOKE_TIMEOUT_MS,
      });

      try {
        await session.sendCommand({ type: 'prompt', message: 'load a skill that does not exist' });

        const toolExecutionEnd = await session.waitForEvent(
          (event) => event.type === 'tool_execution_end' && event.toolName === 'skill',
          SMOKE_TIMEOUT_MS,
        );
        expect(toolExecutionEnd.isError).toBe(true);

        await session.waitForEvent((event) => event.type === 'agent_settled', SMOKE_TIMEOUT_MS);
      } finally {
        await session.close();
      }
    },
    SMOKE_TIMEOUT_MS + 5_000,
  );
});
