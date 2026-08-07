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

## Network-deny guard: threat model and its one real failure so far

The guard's actual guarantee is **enumeration + canary + backstop**, not a single mechanism --
see `network-deny-guard.ts`'s module comment for the full model and citations. Short version:

1. **Enumeration.** The guard patches every real HTTP transport this dependency tree is known
   to use: `globalThis.fetch`, `node:https`'s `.request`, and `node:http2`'s `.connect` (all
   three via `require()`, never `import * as X` -- ECMAScript module namespace objects are
   immutable from outside the module, confirmed empirically; only a CJS `require()`-obtained
   reference can be mutated, and only when the target module reads it the same way). This is
   an enumeration, not a proof -- "everything checked so far," not "everything."
2. **Canary.** [`network-deny-guard-fires.integration.test.ts`](./network-deny-guard-fires.integration.test.ts)
   deliberately misconfigures a spawn per real provider family and drives an actual dispatch
   attempt, asserting the guard intercepted it via `SANDPIPER_INTEGRATION_GUARD_LOG` (a
   diagnostic log file the guard writes to when that env var is set -- **the only reliable
   signal**, since pi normalizes most provider errors away from the guard's own sentinel text
   before they reach the RPC wire). If a future SDK version or provider picks a transport this
   file doesn't patch, the corresponding canary test fails loudly in CI.
3. **Backstop.** Fake `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_PROFILE`, pinned
   unconditionally by `harness.ts`. Even an undetected transport gap authenticates as garbage
   and gets rejected by the real provider, bounding the blast radius to a 403/auth failure.

**This model exists because layer (1) had a real gap, found the hard way.** Building the
Bedrock canary test (AGENT-252) surfaced that an earlier version of this guard's `https.request`
patch did not protect Bedrock traffic at all: `@aws-sdk/client-bedrock-runtime` defaults to
`NodeHttp2Handler` (HTTP/2, `node:http2.connect`), not the HTTP/1.1 handler this guard had
verified. A real dispatch attempt (fake AWS credentials, per the backstop above) reached AWS's
real servers and got back a real, structured rejection -- `UnrecognizedClientException`, HTTP
403, with a real AWS request ID. The backstop is what actually stopped that request from
succeeding; layer (1) has since been extended to cover `http2.connect` too, and layer (2) (this
file's canary tests) is what makes that kind of gap self-detecting going forward instead of
requiring a human to notice a live incident.

**Known residual, real but never exercised by real traffic**: `@smithy/node-http-handler`'s
plain-HTTP (non-TLS) fallback is an ESM dynamic import (`await import('node:http')`) and
genuinely unreachable by any monkeypatch. Real AWS/Bedrock endpoints are always TLS/HTTP2, so
this path never actually runs for real traffic -- but "not exercised in practice" is a
narrower, more honest claim than "not possible."

**In-process only, beyond the transport enumeration itself.** The guard cannot catch egress
from native code or a subprocess pi itself spawns outside the patched process. No OS-level
sandboxing (network namespace, firewall rule) backs this -- out of scope for a portable
dev-machine harness.

## Other known limitations

- **The mock provider's scripting** (AGENT-252): scripted multi-turn conversations and tool
  calls via `SANDPIPER_INTEGRATION_MOCK_SCRIPT` (JSON-encoded, see `mock-provider.ts`'s
  `MockScript` type and `encodeMockScript()`), indexed by how many assistant messages already
  exist in context -- not a call counter, so it's immune to retries. Falls back to
  `SANDPIPER_INTEGRATION_MOCK_REPLY`'s single canned reply (AGENT-251's original scope) when no
  script is set.
- **`entry: 'sandpiper'` runs from source** (`packages/cli/sandpiper_standalone.ts` directly via
  `bun`, no build step). Chosen for dev-loop speed, but this is a real, named tradeoff, not a
  hypothetical one: AGENT-243 (this same session) found a bug that only manifested in the
  *compiled* standalone binary, invisible from source. Deferred as named wave-2 scope in
  AGENT-249's own description, with AGENT-253 empowered to add one representative
  compiled-binary smoke test in wave 1 if cheap (the compile infrastructure already exists in
  `standaloneSandpiperAppRuntime.test.ts`) -- skip-if-not-built, not a forced build step,
  consistent with how this harness treats everything else.
- **`rpc-driver.ts`'s line-buffering/command-response correlation logic is only exercised by
  the smoke tests' happy path.** No synthetic edge-case unit tests (multiple JSON objects per
  stdout chunk, a JSON object split across chunks, command-timeout paths). Real gap, expected
  to close incidentally as AGENT-253's wave-1 coverage exercises the driver more.

## Placement note

This directory is discovered by the root `bun run test:vitest`'s default `**/*.test.ts` glob like
everything else in the repo — nothing here is excluded from the default gate. That's a deliberate
choice (see the design doc's §4), not an oversight: revisit if wave-1+ coverage measurably slows
the default suite.
