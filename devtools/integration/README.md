# Headless CLI/RPC Integration Tests

The second validation lane alongside the unit suite (AGENT-249): tests driven through real
`pi`/`sandpiper` process spawns instead of mocked extension APIs. See
[`.sandpiper/docs/specs/agent-249-headless-cli-integration-harness-design.md`](../../.sandpiper/docs/specs/agent-249-headless-cli-integration-harness-design.md)
for the full design, grounding, and a postmortem worth reading before touching isolation code
here (short version below).

## Isolation-by-construction

Every test spawns `pi`/`sandpiper` through [`harness.ts`](./harness.ts)'s `prepareIsolatedSpawn()`
— no test file constructs its own `child_process` call. That single choke point guarantees, for
every spawn:

- A fresh temp agent dir, set under **both** `SANDPIPER_CODING_AGENT_DIR` and
  `PI_CODING_AGENT_DIR`. This is the actual fix for the incident described below — see the
  design doc for why only one of these two names being set is a real, previously-hit failure
  mode, not theoretical.
- `HOME` points at the temporary agent directory, so external user skills cannot load from the real home directory.
- `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM` neutralized and `JJ_CONFIG` pointed at
  `devtools/test-fixtures/jj-test-config.toml`. Each spawn sets these paths directly so the
  isolation also holds when a caller runs outside the root Vitest command.
- `--offline` passed unconditionally, so isolated runs don't make incidental startup network
  calls (verified: a pinned-but-unused provider was triggering repeated model-catalog fetches
  at startup independent of whether a turn was ever attempted; `--offline` suppresses that).
  This is a determinism measure, not a safety mechanism — see the postmortem below for why this
  harness doesn't rely on network interception for safety.
- The bundled [`mock-provider.ts`](./mock-provider.ts) extension always loaded, and
  `--provider`/`--model` pinned to it by default (overridable — the config-isolation canary
  deliberately omits the pin to reproduce the incident's exact shape).

Two entry modes: `entry: 'pi'` bypasses Sandpiper's own extension manifest entirely (true
single/combinatoric-extension isolation, `--no-extensions -e <path>` against the raw installed
`pi` binary); `entry: 'sandpiper'` runs Sandpiper's normal bundle on top of whatever extra
extensions a test adds.

Optional per-spawn `settingsJson` (AGENT-253): written as `<agentDir>/settings.json` before the
process starts, in the same fresh isolated agent dir as everything else — never the real one.
Primary use so far: pi's default `compaction.keepRecentTokens` (20000) means a realistically
sized scripted test conversation never has anything old enough for manual `compact` to do
anything, so the compaction coverage tests lower it to make compaction reachable without an
unreasonably large scripted conversation.

## Drivers

- [`print-mode-driver.ts`](./print-mode-driver.ts) — one-shot `-p` prompts, synchronous
  stdout/stderr/exit-code capture. Handles the AGENT-248 print-mode landmines by construction
  (stdin `'ignore'` so `readPipedStdin()` sees immediate EOF, provider/model pinned by default
  so model resolution doesn't fall through to a missing-key exit unintentionally).
- [`rpc-driver.ts`](./rpc-driver.ts) — `--mode rpc` sessions for multi-turn/streaming assertions.
  Splits stdout strictly on `\n` (per `docs/rpc.md`'s own warning that Node's `readline` is not
  protocol-compliant here), buffers `message_update` text deltas by `contentIndex`, and treats
  `message_end.message` as authoritative — never the buffered deltas alone.

## Postmortem: the incident, and the network-deny guard that was built then torn down

A keyless, unpinned live smoke test during grounding completed a real turn against a real,
ambiently-authenticated provider. The original explanation was an OS keychain / cached-OAuth
credential store bypassing process-level isolation — and that explanation was **wrong**, caught
later by Doug against the pair's own earlier framing. The real cause: the ad hoc debug commands
that produced the incident (predating this harness) set only `PI_CODING_AGENT_DIR`, never
`SANDPIPER_CODING_AGENT_DIR`, and never overrode `PI_PACKAGE_DIR` — which inherited the invoking
session's own Sandpiper-branded value, making `SANDPIPER_CODING_AGENT_DIR` (never touched) the
name pi actually honored, which in turn inherited the _real_ agent dir. Real `settings.json`
loaded; real configured providers ran. **This harness's own `prepareIsolatedSpawn()` was never
affected** — it has set both agent-dir names unconditionally since it was written.

Believing the wrong explanation, this design built a "network-deny guard": an extension that
monkeypatched `fetch`/`https.request`/`http2.connect` inside every spawned process, with tests
that deliberately misconfigured spawns to prove it fired. That work found and fixed two real
implementation bugs along the way (documented in the design doc's git/task history for the
curious) — both real, both moot for the reason below.

**The guard was torn down entirely, not reframed, once the actual question got asked: what
situation causes a pinned `--provider` invocation to _not_ use the mock?** Answer: none exists.
An unknown provider is a hard error; an unresolvable model is a hard error; pi 0.84.0 makes
resolution ambiguity an explicit error, not a silent fallback. The guard was scar tissue for a
threat model that doesn't describe how pi actually behaves. What replaced it:

- **Config isolation** (dual agent-dir names, always set) is the actual fix, proven directly by
  [`config-isolation-canary.integration.test.ts`](./config-isolation-canary.integration.test.ts):
  isolated, keyless, deliberately unpinned (the incident's exact shape) — hard error, no
  completion, confirmed.
- **Explicit provider/model pinning**, relying on pi's own hard-error behavior for anything
  else — no process-level interception layer backing it up, because none is needed.
- **`--offline`** for the one real concern that survived the teardown: startup-time incidental
  network calls made tests non-hermetic (slow, network-dependent) even when nothing was ever
  going to succeed. That's a determinism fix, not a safety one.

If you're tempted to rebuild interception machinery here, read the design doc's postmortem
section first — it exists specifically so this doesn't get rebuilt from scratch against a
threat that isn't real.

## Wave 1 coverage (AGENT-253)

- [`wave1-skill.integration.test.ts`](./wave1-skill.integration.test.ts) — the `skill` tool,
  isolated. Real filesystem skill load from a self-contained fixture and a real
  not-found error case, both through a real spawned RPC session.
- [`wave1-autotoon.integration.test.ts`](./wave1-autotoon.integration.test.ts) — autotoon,
  isolated (a padded bash-tool JSON result) and combinatoric (autotoon transforming
  [`probe-tool.ts`](./probe-tool.ts)'s JSON result — the real cross-extension seam, since
  autotoon has no knowledge of what produced the JSON it's converting), plus a below-threshold
  case proving the 256-byte `MIN_JSON_BYTES` cutoff is real, not cosmetic.
- [`wave1-compaction.integration.test.ts`](./wave1-compaction.integration.test.ts) — the
  AGENT-237(e) payoff hypothesis: manual compaction and steer-message delivery driven headlessly
  against the mock provider. See the design doc's "AGENT-237(e) payoff, realized" subsection for
  the full account, including two real findings (`compaction.keepRecentTokens` and a compaction
  summarization call context-shape difference) surfaced building it.
- [`rpc-driver.test.ts`](./rpc-driver.test.ts) — direct unit coverage of `rpc-driver.ts`'s line
  buffering, added because real spawns don't reliably exercise multi-line-per-chunk or
  split-across-chunks stdout delivery (OS/timing-dependent, not something a passing integration
  test proves happened that run). Forces both cases deterministically via the extracted
  `extractCompleteLines()` function, plus the CRLF and U+2028/U+2029-non-splitting cases
  `docs/rpc.md` specifically warns `readline` gets wrong. Command/response correlation needed no
  separate test: every wave-1 test's `sendCommand()` calls already exercise it, dozens of times
  over.

## Other known limitations

- **The mock provider's scripting**: scripted multi-turn conversations and tool calls via
  `SANDPIPER_INTEGRATION_MOCK_SCRIPT` (JSON-encoded, see `mock-provider.ts`'s `MockScript` type
  and `encodeMockScript()`), indexed by how many assistant messages already exist in context —
  not a call counter, so it's immune to retries. Falls back to
  `SANDPIPER_INTEGRATION_MOCK_REPLY`'s single canned reply when no script is set. Does not
  reliably index compaction-summarization calls the same way (see the design doc).
- **`entry: 'sandpiper'` runs from source** (`packages/cli/sandpiper_standalone.ts` directly via
  `bun`, no build step). Chosen for dev-loop speed, but this is a real, named tradeoff, not a
  hypothetical one: AGENT-243 (this same session) found a bug that only manifested in the
  _compiled_ standalone binary, invisible from source. Evaluated for AGENT-253 (per the
  coordinator's ruling, include a compiled-binary smoke only if genuinely cheap): the compiled
  binary isn't currently built in this environment, and building it is a real `bun compile`
  step, not something a skip-if-not-built test can make cheap on its own — deferred as named
  wave-2 scope, not added.

## Placement note

This directory is discovered by the root `bun run test:vitest`'s default `**/*.test.ts` glob like
everything else in the repo — nothing here is excluded from the default gate. That's a deliberate
choice (see the design doc's §4), not an oversight: revisit if wave-1+ coverage measurably slows
the default suite.
