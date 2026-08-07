# Headless CLI/RPC Integration Tests

The second validation lane alongside the unit suite (AGENT-249): tests driven through real
`pi`/`sandpiper` process spawns instead of mocked extension APIs. See
[`.sandpiper/docs/specs/agent-249-headless-cli-integration-harness-design.md`](../../.sandpiper/docs/specs/agent-249-headless-cli-integration-harness-design.md)
for the full design and grounding.

## Isolation-by-construction

Every test spawns `pi`/`sandpiper` through [`harness.ts`](./harness.ts)'s `prepareIsolatedSpawn()`
— no test file constructs its own `child_process` call. That single choke point guarantees, for
every spawn:

- A fresh temp agent dir, set under **both** `SANDPIPER_CODING_AGENT_DIR` and
  `PI_CODING_AGENT_DIR` (which name actually takes effect depends on whether `PI_PACKAGE_DIR`
  resolves Sandpiper's own `piConfig` — raw `pi` invocations don't see it, so they stay
  `pi`-branded; see the design doc's AGENT-221 cross-reference).
- `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM` neutralized and `JJ_CONFIG` pointed at Trail's test
  fixture, matching `packages/trail/vitest.setup.ts`'s own isolation (re-derived here rather than
  inherited, because nested `vitest.config.ts` settings don't apply when tests run through the
  root `bun run test:vitest` sweep).
- The bundled [`mock-provider.ts`](./mock-provider.ts) and
  [`network-deny-guard.ts`](./network-deny-guard.ts) extensions always loaded, and
  `--provider`/`--model` always pinned to the mock unless a caller deliberately overrides them
  (the one sanctioned exception: proving the guard fires when a spawn is misconfigured to skip
  the mock — see AGENT-252).

Two entry modes: `entry: 'pi'` bypasses Sandpiper's own extension manifest entirely (true
single/combinatoric-extension isolation, `--no-extensions -e <path>` against the raw installed
`pi` binary); `entry: 'sandpiper'` runs Sandpiper's normal bundle on top of whatever extra
extensions a test adds.

## Drivers

- [`print-mode-driver.ts`](./print-mode-driver.ts) — one-shot `-p` prompts, synchronous
  stdout/stderr/exit-code capture. Handles the AGENT-248 print-mode landmines by construction
  (stdin `'ignore'` so `readPipedStdin()` sees immediate EOF, provider/model always pinned so
  model resolution never falls through to a missing-key exit or ambient credential).
- [`rpc-driver.ts`](./rpc-driver.ts) — `--mode rpc` sessions for multi-turn/streaming assertions.
  Splits stdout strictly on `\n` (per `docs/rpc.md`'s own warning that Node's `readline` is not
  protocol-compliant here), buffers `message_update` text deltas by `contentIndex`, and treats
  `message_end.message` as authoritative — never the buffered deltas alone.

## Known limitations

- **The network-deny guard patches `globalThis.fetch` only** (not `node:http`/`node:https`).
  This was a deliberate correction during AGENT-251, not an oversight: ECMAScript module
  namespace objects (`import * as http from 'node:http'`) are immutable from outside the module,
  confirmed empirically; a separately-`require()`d CJS reference *can* be mutated but that
  mutation does not propagate to the ESM namespace binding other code actually calls through.
  It's also unnecessary for this dependency chain — pi-ai's Anthropic/OpenAI-family providers
  resolve their HTTP client via a bare `fetch` global read (`@anthropic-ai/sdk`'s
  `getDefaultFetch()`), and the installed pi-ai + pi-coding-agent dist tree has zero direct
  `http.request`/`https.request`/`undici`-request usage. If a future dependency bypasses `fetch`
  entirely, this guard would not catch it — that's a real gap, not a hidden one.
- **In-process only.** The guard cannot catch egress from native code or a subprocess pi itself
  spawns outside the patched process. No OS-level sandboxing (network namespace, firewall rule)
  backs this — out of scope for a portable dev-machine harness.
- **The mock provider's scripting is deliberately minimal** (AGENT-251 scope: one canned text
  reply per process, via the `SANDPIPER_INTEGRATION_MOCK_REPLY` env var). Multi-turn/tool-calling
  scripting is AGENT-252's extension of this same provider.
- **The guard-fires proof is not yet built.** AGENT-251 verified the guard's own mechanics
  in-process (`network-deny-guard.test.ts`) and verified real spawns complete successfully with
  zero network activity when the mock is used correctly (the smoke tests, tripwire-log-verified).
  It has not yet proven the guard intercepts a *deliberately misconfigured* spawn that skips the
  mock — that's AGENT-252's scoped deliverable.

## Placement note

This directory is discovered by the root `bun run test:vitest`'s default `**/*.test.ts` glob like
everything else in the repo — nothing here is excluded from the default gate. That's a deliberate
choice (see the design doc's §4), not an oversight: revisit if wave-1+ coverage measurably slows
the default suite.
