// AGENT-252: the guard-fires proof. Deliberately misconfigures spawns to skip the mock
// provider entirely and drive a real dispatch attempt against a real (but unmocked) provider,
// then asserts the network-deny guard actually intercepted the attempt -- via the diagnostic
// log (SANDPIPER_INTEGRATION_GUARD_LOG), the only reliable signal (see network-deny-guard.ts's
// module comment: pi normalizes most provider errors away from the guard's own sentinel text).
//
// This is not optional coverage. Per the guard's documented threat model (enumeration + canary
// + backstop), each test here is a drift canary for one real transport this dependency tree
// uses -- if a future SDK version or provider picks a transport the guard doesn't patch, the
// corresponding test here is what's supposed to catch it, not a human noticing a live incident
// (which is exactly how the http2.connect gap this file also covers was first found, during
// this same task).

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NETWORK_DENY_GUARD_LOG_ENV_VAR } from './network-deny-guard.js';
import { type RpcSession, startRpcSession } from './rpc-driver.js';

const SMOKE_TIMEOUT_MS = 60_000;

let logDir: string;
let logPath: string;

beforeEach(() => {
  logDir = mkdtempSync(join(tmpdir(), 'network-deny-guard-fires-'));
  logPath = join(logDir, 'denials.log');
});

afterEach(() => {
  rmSync(logDir, { recursive: true, force: true });
});

function readLog(): string {
  try {
    return readFileSync(logPath, 'utf-8');
  } catch {
    return '';
  }
}

async function driveOneTurnAndSettle(session: RpcSession, message: string): Promise<void> {
  // Anthropic's "Connection error." is classified as transient and auto-retried with
  // exponential backoff (2s/4s/8s) by default -- disabling it keeps this test fast and
  // deterministic without changing what it proves (the guard fires on the first attempt
  // regardless of whether pi retries afterward).
  await session.sendCommand({ type: 'set_auto_retry', enabled: false });
  await session.sendCommand({ type: 'prompt', message });
  await session.waitForEvent((event) => event.type === 'agent_settled', SMOKE_TIMEOUT_MS);
}

describe('network-deny guard fires against real (unmocked) providers (AGENT-252)', () => {
  it(
    'blocks a real Anthropic dispatch attempt via the fetch patch (drift canary for the fetch-based provider family)',
    async () => {
      const session = startRpcSession({
        entry: 'pi',
        // Deliberate escape hatch: override the harness's default mock pin to exercise a real
        // (but unmocked, guard-protected) provider. A fake key is required to get past pi's
        // own missing-key early exit and actually reach a dispatch attempt -- without it,
        // nothing would be attempted and this test would prove nothing.
        provider: 'anthropic',
        model: 'claude-haiku-4-5-20251001',
        env: {
          ANTHROPIC_API_KEY: 'fake-guard-fires-test-key',
          [NETWORK_DENY_GUARD_LOG_ENV_VAR]: logPath,
        },
        commandTimeoutMs: SMOKE_TIMEOUT_MS,
      });

      try {
        await driveOneTurnAndSettle(session, 'say hi');

        const log = readLog();
        expect(log).toContain('fetch ');
        expect(log).toMatch(/anthropic/i);

        const messageEnd = await session.waitForEvent((event) => {
          if (event.type !== 'message_end') return false;
          const message = event.message as { role?: string } | undefined;
          return message?.role === 'assistant';
        }, SMOKE_TIMEOUT_MS);
        const message = messageEnd.message as { stopReason?: string };
        // pi normalizes this to a generic "Connection error." (see network-deny-guard.ts's
        // module comment) -- the log above, not this field, is the actual proof the guard
        // fired. This assertion only confirms the dispatch attempt genuinely failed, not why.
        expect(message.stopReason).toBe('error');
      } finally {
        await session.close();
      }
    },
    SMOKE_TIMEOUT_MS + 5_000,
  );

  it(
    'blocks a real Bedrock dispatch attempt via the http2.connect patch (drift canary for the HTTP/2 transport specifically)',
    async () => {
      const session = startRpcSession({
        entry: 'pi',
        provider: 'amazon-bedrock',
        model: 'anthropic.claude-haiku-4-5-20251001-v1:0',
        env: {
          // AWS_REGION is required for the Bedrock client to construct a request at all --
          // without it, pi fails with "Region is missing" before ever reaching smithy's
          // transport, and this test would prove nothing (the same "must drive a real
          // dispatch" requirement as the fake API key above, AWS-flavored). Fake
          // AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY/AWS_PROFILE are already pinned
          // unconditionally by the harness -- the backstop this test is itself protected by.
          AWS_REGION: 'us-east-1',
          [NETWORK_DENY_GUARD_LOG_ENV_VAR]: logPath,
        },
        commandTimeoutMs: SMOKE_TIMEOUT_MS,
      });

      try {
        await driveOneTurnAndSettle(session, 'say hi');

        const log = readLog();
        expect(log).toContain('http2.connect ');
        expect(log).toMatch(/bedrock-runtime/i);

        const messageEnd = await session.waitForEvent((event) => {
          if (event.type !== 'message_end') return false;
          const message = event.message as { role?: string } | undefined;
          return message?.role === 'assistant';
        }, SMOKE_TIMEOUT_MS);
        const message = messageEnd.message as { stopReason?: string; errorMessage?: string };
        expect(message.stopReason).toBe('error');
        // Unlike the Anthropic case above, Bedrock's error path happens to preserve the
        // sentinel text -- confirmed empirically, not assumed, and treated as a bonus
        // corroboration on top of the log, not a replacement for it (the log is what's
        // documented as the reliable signal; this assertion could stop passing on a future
        // pi/AWS-SDK version without the guard itself having regressed).
        expect(message.errorMessage).toContain('http2.connect');
      } finally {
        await session.close();
      }
    },
    SMOKE_TIMEOUT_MS + 5_000,
  );
});
