// AGENT-252: proves the mock provider's multi-turn + tool-call scripting round-trips through
// a REAL RPC session (real spawned process, real tool execution against the probe fixture) --
// not mocked at the test level beyond the provider itself. This is what converts the
// integration lane from error-path-only assertions into real behavioral coverage (the point
// of AGENT-252 per its own task description).

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { encodeMockScript, MOCK_SCRIPT_ENV_VAR } from './mock-provider.js';
import { PROBE_TOOL_NAME } from './probe-tool.js';
import { type RpcEvent, type RpcSession, startRpcSession } from './rpc-driver.js';

const SMOKE_TIMEOUT_MS = 60_000;
const PROBE_TOOL_PATH = join(dirname(fileURLToPath(import.meta.url)), 'probe-tool.ts');

function isAssistantMessageEnd(event: RpcEvent): boolean {
  if (event.type !== 'message_end') {
    return false;
  }
  const message = event.message as { role?: string } | undefined;
  return message?.role === 'assistant';
}

function assistantMessageEndCount(session: RpcSession): number {
  return session.events.filter(isAssistantMessageEnd).length;
}

/** Waits for the (0-indexed) Nth assistant message_end. Unlike a plain predicate passed to
 * waitForEvent, this correctly distinguishes "the 2nd assistant turn" from "the 1st" -- a bare
 * role==='assistant' predicate would just re-match the first one already in the buffer. */
async function waitForAssistantMessageEnd(session: RpcSession, index: number, timeoutMs: number): Promise<RpcEvent> {
  await session.waitForEvent(() => assistantMessageEndCount(session) > index, timeoutMs);
  const matches = session.events.filter(isAssistantMessageEnd);
  const match = matches[index];
  if (!match) {
    throw new Error(`Expected an assistant message_end at index ${index}, only saw ${matches.length}`);
  }
  return match;
}

describe('mock provider scripting (AGENT-252)', () => {
  it(
    'drives a scripted tool call then a scripted text reply through a real RPC session and real tool execution',
    async () => {
      const script = encodeMockScript([
        { type: 'toolCall', toolName: PROBE_TOOL_NAME, arguments: { foo: 'bar', n: 42 } },
        { type: 'text', text: 'all done' },
      ]);

      const session = startRpcSession({
        entry: 'pi',
        extraExtensions: [PROBE_TOOL_PATH],
        env: { [MOCK_SCRIPT_ENV_VAR]: script },
        commandTimeoutMs: SMOKE_TIMEOUT_MS,
      });

      try {
        const promptResponse = await session.sendCommand({ type: 'prompt', message: 'run the probe tool' });
        expect(promptResponse.success).toBe(true);

        // Turn 1: the scripted tool call actually executes against the real probe tool.
        const toolExecutionEnd = await session.waitForEvent(
          (event) => event.type === 'tool_execution_end' && event.toolName === PROBE_TOOL_NAME,
          SMOKE_TIMEOUT_MS,
        );
        expect(toolExecutionEnd.isError).toBeFalsy();
        const result = toolExecutionEnd.result as { details?: { receivedArguments?: unknown } };
        expect(result.details?.receivedArguments).toEqual({ foo: 'bar', n: 42 });

        const firstMessageEnd = await waitForAssistantMessageEnd(session, 0, SMOKE_TIMEOUT_MS);
        const firstMessage = firstMessageEnd.message as { stopReason?: string };
        expect(firstMessage.stopReason).toBe('toolUse');

        // Turn 2: the scripted text reply, generated only after the tool result was appended
        // to context -- proving the mock's context.messages-indexed script position tracking
        // (not a naive call counter) is what actually drove this second turn.
        const secondMessageEnd = await waitForAssistantMessageEnd(session, 1, SMOKE_TIMEOUT_MS);
        const secondMessage = secondMessageEnd.message as {
          stopReason?: string;
          content: Array<{ type: string; text?: string }>;
        };
        expect(secondMessage.stopReason).toBe('stop');
        const textBlock = secondMessage.content.find((block) => block.type === 'text');
        expect(textBlock?.text).toBe('all done');

        await session.waitForEvent((event) => event.type === 'agent_settled', SMOKE_TIMEOUT_MS);
      } finally {
        await session.close();
      }
    },
    SMOKE_TIMEOUT_MS + 5_000,
  );

  it(
    'throws a clear error from the mock when a script runs out of steps, instead of silently repeating the last one',
    async () => {
      const script = encodeMockScript([{ type: 'text', text: 'only step' }]);

      const session = startRpcSession({
        entry: 'pi',
        env: { [MOCK_SCRIPT_ENV_VAR]: script },
        commandTimeoutMs: SMOKE_TIMEOUT_MS,
      });

      try {
        await session.sendCommand({ type: 'prompt', message: 'first turn' });
        await waitForAssistantMessageEnd(session, 0, SMOKE_TIMEOUT_MS);

        // Second turn: the script only has one step, so the mock should error deterministically
        // rather than silently reusing the last step or hanging. Confirmed empirically (not
        // assumed): pi surfaces a streamSimple throw as an assistant message_end with
        // stopReason 'error' and errorMessage set -- not a distinct 'extension_error' event
        // (that's a different pi concept, for errors inside extension event handlers).
        await session.sendCommand({ type: 'prompt', message: 'second turn, past the end of the script' });
        const secondMessageEnd = await waitForAssistantMessageEnd(session, 1, SMOKE_TIMEOUT_MS);
        const secondMessage = secondMessageEnd.message as { stopReason?: string; errorMessage?: string };
        expect(secondMessage.stopReason).toBe('error');
        expect(secondMessage.errorMessage).toContain('Mock script exhausted');

        await session.waitForEvent((event) => event.type === 'agent_settled', SMOKE_TIMEOUT_MS);
      } finally {
        await session.close();
      }
    },
    SMOKE_TIMEOUT_MS + 5_000,
  );
});
