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
- Fake `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_PROFILE` values, unconditionally. This
  is defense-in-depth for the guard itself, not a substitute for it — the AWS credential chain
  checks env vars before `~/.aws`/IAM-role metadata, so if the network-deny guard ever
  regresses, a real Bedrock dispatch attempt (see AGENT-252's guard-fires test) authenticates
  as garbage and gets a 403 rather than spending real ambient AWS credentials.

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

- **The network-deny guard patches `globalThis.fetch` and `node:https`'s `.request`** (via
  `require()`, not `node:http`). Two rounds of correction went into this, both recorded rather
  than silently fixed — see the design doc's Guard injection vector section for the full
  evidence: (1) ECMAScript module namespace objects (`import * as http from 'node:http'`) are
  immutable from outside the module, so any consumer that reads node:http/node:https via a
  static or dynamic `import` cannot be intercepted by this guard at all, full stop; (2) an
  initial version dropped `https.request` patching entirely on the claim that nothing in
  pi-ai's dependency tree calls it — that claim was false: `@smithy/node-http-handler`
  (pi-ai's Bedrock provider dependency) calls `node:https.request` via a genuine CJS
  `require()`, at call time rather than a cached reference, which this guard's own
  `require('node:https')` patch does intercept. The one remaining named residual: smithy's
  plain-HTTP fallback path is an ESM dynamic import and unreachable by any monkeypatch — not
  exercised by real AWS/Bedrock traffic (always TLS), but real in principle. If a future
  dependency bypasses both `fetch` and a CJS-`require()`d `node:https`, this guard would not
  catch it — that's a real gap, not a hidden one.
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
