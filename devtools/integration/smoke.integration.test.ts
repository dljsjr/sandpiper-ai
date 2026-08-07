// End-to-end proof that both drivers work against a real spawned process (not mocked at the
// test level -- only the model provider is mocked, via mock-provider.ts's streamSimple). This
// is the AGENT-251 "smoke integration test proving both drivers against a trivial scripted
// turn" deliverable. Wave-1 extension coverage (AGENT-253) builds on this same foundation.

import { describe, expect, it } from 'vitest';
import { MOCK_REPLY_ENV_VAR } from './mock-provider.js';
import { runPrintMode } from './print-mode-driver.js';
import { startRpcSession } from './rpc-driver.js';

const SMOKE_TIMEOUT_MS = 60_000;

describe('integration harness smoke (print-mode driver)', () => {
  it(
    'runs a trivial prompt through bare pi against the mock provider and returns the scripted reply',
    () => {
      const result = runPrintMode({
        entry: 'pi',
        prompt: 'say hi',
        env: { [MOCK_REPLY_ENV_VAR]: 'smoke-test-reply' },
        timeoutMs: SMOKE_TIMEOUT_MS,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('smoke-test-reply');
    },
    SMOKE_TIMEOUT_MS + 5_000,
  );

  it(
    'runs a trivial prompt through the sandpiper entry mode against the mock provider',
    () => {
      const result = runPrintMode({
        entry: 'sandpiper',
        prompt: 'say hi',
        env: { [MOCK_REPLY_ENV_VAR]: 'sandpiper-smoke-reply' },
        timeoutMs: SMOKE_TIMEOUT_MS,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('sandpiper-smoke-reply');
    },
    SMOKE_TIMEOUT_MS + 5_000,
  );
});

describe('integration harness smoke (RPC driver)', () => {
  it(
    'streams delta events for a trivial scripted turn and treats message_end as authoritative',
    async () => {
      const session = startRpcSession({
        entry: 'pi',
        env: { [MOCK_REPLY_ENV_VAR]: 'rpc-smoke-reply' },
        commandTimeoutMs: SMOKE_TIMEOUT_MS,
      });

      try {
        const promptResponse = await session.sendCommand({ type: 'prompt', message: 'say hi' });
        expect(promptResponse.success).toBe(true);

        const messageEnd = await session.waitForEvent((event) => {
          if (event.type !== 'message_end') {
            return false;
          }
          const candidate = event.message as { role?: string } | undefined;
          return candidate?.role === 'assistant';
        }, SMOKE_TIMEOUT_MS);
        const message = messageEnd.message as { content: Array<{ type: string; text?: string }> };
        const textBlock = message.content.find((block) => block.type === 'text');
        expect(textBlock?.text).toBe('rpc-smoke-reply');

        // The delta-native path must have populated the same text independently of
        // message_end -- this is what proves the driver actually parsed message_update
        // deltas rather than only reading the authoritative final message.
        expect(session.bufferedText(0)).toBe('rpc-smoke-reply');

        const sawTextStart = session.events.some((event) => {
          const assistantMessageEvent = event.assistantMessageEvent as { type?: string } | undefined;
          return event.type === 'message_update' && assistantMessageEvent?.type === 'text_start';
        });
        expect(sawTextStart).toBe(true);
      } finally {
        await session.close();
      }
    },
    SMOKE_TIMEOUT_MS + 5_000,
  );
});
