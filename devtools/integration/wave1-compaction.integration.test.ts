// AGENT-253, item (4): the AGENT-237(e) payoff hypothesis. AGENT-237(e)'s original checklist
// item (tattler/chorus deliverAs:'steer' delivery through compaction) was deferred to Doug's
// manual sweep because, at the time, there was "zero existing test coverage of compaction
// anywhere in extensions/ or packages/core/, and the risk lives entirely inside Pi's internal
// turn/compaction state machine, which only exists during a real streaming turn -- nothing to
// mock without testing the mock instead of Pi's actual behavior." That reasoning predates this
// harness: the mock provider (AGENT-252) is a real, structurally-network-incapable provider
// that pi's actual compaction/turn machinery treats exactly like any other provider -- only
// the model *content* is scripted, not pi's internal state machine. This file is the promised
// attempt.
//
// Manual compaction needed a real, honest finding before it could be driven at all: pi's
// default `compaction.keepRecentTokens` is 20000, so a realistically-sized scripted test
// conversation (a few KB) never has anything old enough to compact -- every attempt at the
// default setting returned "Nothing to compact (session too small)", a genuine pi safeguard,
// not a bug. Lowered via harness.ts's new `settingsJson` option (writes settings.json into the
// isolated agent dir before spawn) so a modest scripted conversation clears the threshold.
//
// A second real finding, reported honestly rather than glossed over: the compaction
// summarization streamSimple() call does NOT receive the same context shape a normal turn
// does (confirmed by observation, not asserted) -- mock-provider.ts's context.messages-based
// script-step indexing (AGENT-252) does not reliably land on a chosen "compaction summary"
// step the way it does for ordinary turns. This test therefore does not assert the exact
// summary *content* pi produces (that would be asserting an accident of indexing, not a real
// claim) -- it asserts the real, load-bearing structural claims: compact succeeds, a steered
// message delivered mid-conversation is present in context before compaction, and a normal
// turn after compaction still completes without error, drop, or hang.

import { describe, expect, it } from 'vitest';
import { encodeMockScript, MOCK_SCRIPT_ENV_VAR } from './mock-provider.js';
import { type RpcEvent, type RpcSession, startRpcSession } from './rpc-driver.js';

const SMOKE_TIMEOUT_MS = 60_000;

function isAssistantMessageEnd(event: RpcEvent): boolean {
  if (event.type !== 'message_end') return false;
  const message = event.message as { role?: string } | undefined;
  return message?.role === 'assistant';
}

function assistantMessageEndCount(session: RpcSession): number {
  return session.events.filter(isAssistantMessageEnd).length;
}

/** Waits for the (0-indexed) Nth assistant message_end -- see mock-provider-scripting.test.ts
 * for why a bare predicate re-matches an already-seen event instead of advancing. */
async function waitForAssistantMessageEnd(session: RpcSession, index: number, timeoutMs: number): Promise<RpcEvent> {
  await session.waitForEvent(() => assistantMessageEndCount(session) > index, timeoutMs);
  const matches = session.events.filter(isAssistantMessageEnd);
  const match = matches[index];
  if (!match) {
    throw new Error(`Expected an assistant message_end at index ${index}, only saw ${matches.length}`);
  }
  return match;
}

describe('wave 1: compaction + steer, AGENT-237(e) payoff hypothesis (AGENT-253)', () => {
  it(
    'drives manual compaction against the mock provider with zero real network egress',
    async () => {
      const script = encodeMockScript([
        { type: 'text', text: `padding turn one ${'a'.repeat(1000)}` },
        { type: 'text', text: `padding turn two ${'b'.repeat(1000)}` },
        { type: 'text', text: 'reply after compaction' },
      ]);

      const session = startRpcSession({
        entry: 'pi',
        settingsJson: { compaction: { keepRecentTokens: 10 } },
        env: { [MOCK_SCRIPT_ENV_VAR]: script },
        commandTimeoutMs: SMOKE_TIMEOUT_MS,
      });

      try {
        await session.sendCommand({ type: 'prompt', message: `msg one ${'x'.repeat(500)}` });
        await waitForAssistantMessageEnd(session, 0, SMOKE_TIMEOUT_MS);

        await session.sendCommand({ type: 'prompt', message: `msg two ${'y'.repeat(500)}` });
        await waitForAssistantMessageEnd(session, 1, SMOKE_TIMEOUT_MS);

        const compactResponse = await session.sendCommand({ type: 'compact' });
        expect(compactResponse.success).toBe(true);
        const data = compactResponse.data as { summary?: string } | undefined;
        expect(typeof data?.summary).toBe('string');
        expect((data?.summary ?? '').length).toBeGreaterThan(0);

        // The load-bearing claim: a normal turn still works after compaction -- context
        // wasn't corrupted, nothing hung, no error surfaced.
        const postCompactResponse = await session.sendCommand({
          type: 'prompt',
          message: 'msg three, after compaction',
        });
        expect(postCompactResponse.success).toBe(true);
        const postCompactMessageEnd = await waitForAssistantMessageEnd(session, 2, SMOKE_TIMEOUT_MS);
        const postCompactMessage = postCompactMessageEnd.message as {
          stopReason?: string;
          content: Array<{ type: string; text?: string }>;
        };
        expect(postCompactMessage.stopReason).toBe('stop');
      } finally {
        await session.close();
      }
    },
    SMOKE_TIMEOUT_MS + 10_000,
  );

  it(
    "delivers a steer-queued message into the active turn's context, surviving into a subsequent manual compaction",
    async () => {
      const script = encodeMockScript([
        { type: 'text', text: `padding turn one ${'a'.repeat(1000)}` },
        { type: 'text', text: 'reply after compaction' },
      ]);

      const session = startRpcSession({
        entry: 'pi',
        settingsJson: { compaction: { keepRecentTokens: 10 } },
        env: { [MOCK_SCRIPT_ENV_VAR]: script },
        commandTimeoutMs: SMOKE_TIMEOUT_MS,
      });

      try {
        // Fire prompt and steer back-to-back, matching AGENT-237(e)'s original concern
        // (deliverAs:'steer' -- a message arriving while a turn is in flight). The steer
        // command's own response confirms pi accepted it as a mid-flight queue operation,
        // not a rejected/ignored one.
        const promptPromise = session.sendCommand({ type: 'prompt', message: `msg one ${'x'.repeat(500)}` });
        const steerResponse = await session.sendCommand({ type: 'steer', message: 'the steered message' });
        expect(steerResponse.success).toBe(true);
        await promptPromise;
        await waitForAssistantMessageEnd(session, 0, SMOKE_TIMEOUT_MS);

        // The steered message must appear as its own entry in the conversation -- confirmed
        // via get_entries rather than inferred from the assistant's reply content, since the
        // mock's reply text is scripted and wouldn't itself prove delivery.
        const entriesResponse = await session.sendCommand({ type: 'get_entries' });
        expect(entriesResponse.success).toBe(true);
        expect(JSON.stringify(entriesResponse.data)).toContain('the steered message');

        const compactResponse = await session.sendCommand({ type: 'compact' });
        expect(compactResponse.success).toBe(true);

        // Post-compaction: the steered message's own entry predates the compaction boundary,
        // so it's expected to be folded into the summary rather than surviving verbatim in
        // get_entries -- what must survive is conversational continuity, asserted the same
        // way as the first test.
        const postCompactResponse = await session.sendCommand({ type: 'prompt', message: 'msg two, after compaction' });
        expect(postCompactResponse.success).toBe(true);
        const postCompactMessageEnd = await waitForAssistantMessageEnd(session, 1, SMOKE_TIMEOUT_MS);
        const postCompactMessage = postCompactMessageEnd.message as { stopReason?: string };
        expect(postCompactMessage.stopReason).toBe('stop');
      } finally {
        await session.close();
      }
    },
    SMOKE_TIMEOUT_MS + 10_000,
  );
});
