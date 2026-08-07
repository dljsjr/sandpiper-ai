# AGENT-249: Headless CLI Integration-Test Harness — Grounding + Design (AGENT-250)

Status: approved (AGENT-250); implemented (AGENT-251) at devtools/integration/. The Guard
injection vector section below carries an AGENT-251 correction to the originally-approved
fetch/http/https sketch — the http/https half was found broken and unnecessary once actually
built and verified; see that section for the empirical evidence. Full live-completion
verification of the RPC/mock-provider claims beyond the guard's own mechanics remains AGENT-252's
scope (see [Dependency inversion](#dependency-inversion-live-verification-moves-downstream)).

## Context

Doug's direction (2026-08-07): add a second validation lane alongside the unit suite — headless
integration tests driven through real CLI operations against the actual `sandpiper`/`pi`
binaries, using `-p`/print mode for one-shot stdout assertions and Pi RPC mode for
multi-turn/stateful/streaming assertions. RPC over the experimental PiClient/CBOR arch (Doug's
call, not relitigated here).

This design grounds five questions from AGENT-250 against the real, installed 0.84.0 package
(binary `--help`, installed `dist/*.js` source, `docs/rpc.md`, `docs/custom-provider.md`) rather
than from memory, per this pair's own hard-won discipline this session.

## 1. Extension-selection CLI surface

Confirmed directly from `pi --help` (installed 0.84.0 binary):

```
--extension, -e <path>         Load an extension file (can be used multiple times)
--no-extensions, -ne           Disable extension discovery (explicit -e paths still work)
--skill <path>                 Load a skill file or directory (can be used multiple times)
--no-skills, -ns               Disable skills discovery and loading
--prompt-template <path>       Load a prompt template file or directory (can be used multiple times)
--no-prompt-templates, -np     Disable prompt template discovery and loading
--theme <path>                 Load a theme file or directory (can be used multiple times)
--no-themes                    Disable theme discovery and loading
--no-context-files, -nc        Disable AGENTS.md and CLAUDE.md discovery and loading
--tools, -t <tools>            Comma-separated allowlist of tool names to enable
--exclude-tools, -xt <tools>   Comma-separated denylist of tool names to disable
--no-tools, -nt / --no-builtin-tools, -nbt
```

**Per-extension selection exists and composes as needed.** `--no-extensions` disables discovery
(so no package-manifest/`pi.extensions` resolution happens) while explicit `-e <path>` still
loads — and `-e` is documented repeatable. Smoke-verified (static, no model call):

```
node dist/cli.js --no-extensions --no-skills --no-prompt-templates --no-themes --no-context-files \
  -e plugins/pi/extensions/skill-loading.ts -p "..." < /dev/null
```

successfully loaded exactly the one extension file (see [§3 incident log](#incident-log-ambient-credentials-are-the-threat)
for what happened downstream of this same invocation — the flag composition itself worked).

**Two distinct entry modes, per AGENT-249's own framing, confirmed as genuinely different:**
1. `sandpiper` (the wrapper: `packages/cli/sandpiper_standalone.ts`) — always loads Sandpiper's
   own package-manifest extension set (`pi.extensions` in `package.json`) plus whatever
   `-e`/`--no-extensions` add/remove on top. Good for "does Sandpiper's real bundle behave",
   not for single-extension isolation.
2. Raw `pi` binary (`node node_modules/@earendil-works/pi-coding-agent/dist/cli.js`, bypassing
   `sandpiper_standalone.ts` entirely) with `--no-extensions -e <one file>` — true isolation,
   since Sandpiper's manifest never enters the picture. **This is the isolation/combinatoric
   entry mode AGENT-249 wants**, and it needs `PI_PACKAGE_DIR` left unset or pointed elsewhere:
   run this way, `getPackageDir()` walks up from the installed package's own `__dirname` and
   finds `node_modules/@earendil-works/pi-coding-agent/package.json` — no Sandpiper `piConfig`,
   so `APP_NAME` defaults to `"pi"` and `CONFIG_DIR_NAME` to `.pi`. **Consequence for isolation
   env vars**: in raw-`pi` mode, the agent-dir override key is `PI_CODING_AGENT_DIR`, not
   `SANDPIPER_CODING_AGENT_DIR` (see AGENT-221's confirmed `ENV_AGENT_DIR = "${APP_NAME.toUpperCase()}_CODING_AGENT_DIR"`
   derivation). A shared isolation helper must set **both** names to the same temp path so it
   works regardless of entry mode, rather than assuming one.

No fallback design is needed for extension isolation — the flag surface upstream already
provides it.

## 2. RPC mode: command/event inventory

Full inventory read from `docs/rpc.md` (1578 lines) in the installed package.

**Commands** (grouped): `prompt` / `steer` / `follow_up` / `abort` / `new_session` (prompting +
session control); `get_state` / `get_messages`; `set_model` / `cycle_model` /
`get_available_models`; `set_thinking_level` / `cycle_thinking_level` /
`get_available_thinking_levels`; `set_steering_mode` / `set_follow_up_mode`; `compact` /
`set_auto_compaction`; `set_auto_retry` / `abort_retry`; `bash` / `abort_bash`;
`get_session_stats` / `export_html` / `switch_session` / `fork` / `clone` / `get_fork_messages` /
`get_entries` / `get_tree` / `get_last_assistant_text` / `set_session_name`; `get_commands`.

**Events**: `agent_start` / `agent_end` / `agent_settled`; `turn_start` / `turn_end`;
`message_start` / `message_end`; `message_update` (streaming deltas); `bash_execution_update`;
`tool_execution_start` / `tool_execution_update` / `tool_execution_end`; `queue_update`;
`compaction_start` / `compaction_end`; `auto_retry_start` / `auto_retry_end`;
`summarization_retry_scheduled` / `_attempt_start` / `_finished`; `extension_error`; Extension UI
Requests (`select`/`confirm`/`input`/`editor`/`notify`/`setStatus`/`setWidget`/`setTitle`/
`set_editor_text`) with matching stdin Responses.

**`message_update` delta shape — confirmed exactly as AGENT-249 describes.** No cumulative
`message` field, no `assistantMessageEvent.partial`. Delta types:
`text_start`/`text_delta`/`text_end`, `thinking_start`/`thinking_delta`/`thinking_end`,
`toolcall_start`/`toolcall_delta`/`toolcall_end` (the last carries the completed `toolCall`
object). Clients assemble from `message_start` + deltas; `message_end.message` is authoritative.
**The RPC driver must buffer by `contentIndex` and treat `message_end` as ground truth — this is
non-negotiable, not an optimization.**

**Tool-call/result observability**: `tool_execution_start`/`_update`/`_end`, keyed by
`toolCallId`, carry `toolName`, `args`, streaming `partialResult`, and the final `result`/
`isError`. This is sufficient to assert extension tool behavior (arguments in, structured result
+ error flag out) without needing to parse assistant-message tool-call deltas at all — prefer
these events over `toolcall_end` for test assertions, since they carry the tool's actual return
value, not just the call it made.

**Compaction**: `compact` command triggers a **real LLM call** to generate the summary (response
includes `usage`/`cost` for "the LLM call or calls that generated the summary"). This means
AGENT-249's "steer-through-compaction becomes headless-testable" payoff is real but gated
entirely on the mock provider (§3) being able to answer a compaction-summarization-shaped
request coherently, not just ordinary chat turns — flagging as a wave-2+ concern, not wave 1.

**Bash**: `bash` command executes real shell, streams `bash_execution_update`, useful as a
provider-independent test driver in its own right (doesn't need a model turn at all) for
extensions that hook `user_bash`-style events.

## 3. Deterministic turns: mock-provider mechanism

### Incident log: ambient credentials are the threat

Two live smoke attempts this session (both disclosed and frozen on immediately) proved the
overnight "blackhole via `ANTHROPIC_BASE_URL`" rule doesn't work (`pi-ai`'s Anthropic provider
hardcodes `baseUrl: "https://api.anthropic.com"` — no env override exists; grepped the whole
installed `pi-ai`+`pi-coding-agent` dist tree, the only `ANTHROPIC_BASE_URL` reference is
Cloudflare AI Gateway routing, unrelated), and that omitting API keys entirely *also* doesn't
guarantee no egress — a keyless run with no `--provider`/`--model` pinning still resolved to a
real, ambiently-authenticated Codex/Copilot-family credential (OS keychain or cached OAuth,
independent of `PI_CODING_AGENT_DIR`/`auth.json`) and completed a real turn. **Neither env vars
nor a temp agent dir constrain OS-level credential stores.** Coordinator ruling in response:
mock-provider-only for anything reaching model resolution, permanently, until a verified
no-fallback mechanism exists. This design treats that as the load-bearing constraint for
everything in this section.

### Mechanism evaluation

**(a) `pi.registerProvider()` with a full `streamSimple` implementation — recommended.**
`docs/custom-provider.md` documents `streamSimple: (model, context, options) =>
AssistantMessageEventStream` as a complete escape hatch: the extension owns the entire event
sequence (`start` → content deltas → `done`/`error`) and pi never constructs its own HTTP client
for that provider at all. A mock built this way can be **structurally incapable of network
I/O** — not merely configured not to use it — because there is no code path inside our own
`streamSimple` function that calls `fetch`/`http`/`https`. This is the strongest available
guarantee and it comes from pi's own supported extension surface, not a workaround.

Config shape (`ProviderConfig`) still declares `apiKey`/`baseUrl`/`api` as fields "required when
defining models," but since `streamSimple` overrides the actual request path, these can be inert
placeholders — AGENT-252 must verify this empirically (does pi's startup/model-catalog code path
ever independently touch `baseUrl`/`apiKey` for validation reasons before `streamSimple` takes
over?) rather than assume it from the docs prose.

**(b) The "faux-provider" deferred-response contracts (0.84.0, #7339) — investigated, not
useful for this.** Changelog: "deferred provider request contracts, durable response handles,
authenticated fetch/cancel dispatch, and faux-provider support for pending, ready, failed, and
cancelled responses." This is infrastructure for **async external interactions with durable,
resumable state** (the shape matches OAuth device-flow polling or long-running external
approval, not a scripted chat-completion mock). AGENT-250's task description flagged this as a
candidate to evaluate; verdict: **not applicable** — wrong feature, no scripted-conversation
surface, dropping it from consideration.

**(c) Blackholed provider + error-path-only assertions — rejected outright**, not merely
"weakest." The whole reason this section exists is that blackholing doesn't work as a control at
all (§ incident log). This option is retired along with the overnight rule that inspired it.

### No-fallback: the hard problem, named honestly

Two layers, and they are not equally strong:

1. **Explicit pinning** (`--provider <mock> --model <mock-id>` on every invocation, never
   omitted, never left to auto-resolve). This directly addresses the observed failure mode (both
   incidents happened with *no* explicit provider/model given). Whether pi's resolver, given an
   explicit pin that doesn't match a real credential, fails hard instead of silently scanning
   other sources is a property AGENT-252 must verify empirically — it is asserted nowhere in
   docs read so far, and this pair does not promote unverified mechanisms to guarantees anymore.
2. **Harness-level network-deny guard (recommended as the actual answer)** — independent of
   whether (1) holds, every integration test run should install a process-wide guard for its
   duration: monkeypatch `globalThis.fetch` to reject if invoked (see the Guard injection
   vector section below for why `fetch` alone, not `http`/`https`, turned out to be the correct
   and sufficient interception point once AGENT-251 built and empirically verified it). This
   catches egress from *any* cause — wrong provider resolution, an extension under test making
   its own incidental fetch, a future pi regression — not just "the mock provider was
   configured correctly." It converts "we trust the mock" into "we structurally cannot make a
   real request during this test."

**Honest limitation**: this is an in-process JS-level guard. It cannot catch egress from a
subprocess pi itself spawns outside the patched process (none identified in the RPC/print-mode
paths read so far, but not exhaustively verified), nor from native code bypassing Node's
http/https modules. It is the strongest guarantee achievable without OS-level sandboxing
(network namespace, firewall rule), which is out of scope for a portable dev-machine test
harness. State this limitation in the harness's own README, not just here.

### Guard injection vector (coordinator-required specification)

The guard has to run *inside* the spawned `pi`/`sandpiper` process — patching `fetch` from the
test runner's own process does nothing for a child process's separate Node realm. The vector is:
**the guard is itself a tiny extension**, loaded via an additional `-e` flag the shared isolation
helper always appends (alongside the mock provider's own `-e`), e.g.
`devtools/integration/network-deny-guard.ts`. Its factory function patches `globalThis.fetch`
synchronously at the top, before doing anything else.

**AGENT-251 correction to this design (recorded, not silently fixed):** the version approved
here also patched `node:http`/`node:https` `.request`. Building it surfaced that this half was
both broken and unnecessary, confirmed empirically rather than assumed away a second time:
`import * as http from 'node:http'` yields an ECMAScript module namespace object, which is
exotic-object-immutable from outside the module (`Object.defineProperty` with
`configurable:true` throws "Cannot replace module namespace object's binding"; a *separately
obtained* `require('node:http')` CJS reference can be mutated, but that mutation does not
propagate to the ESM namespace's own binding — confirmed with a standalone bun script). It also
turned out to be moot: pi-ai's Anthropic and OpenAI-family providers go through the official
`@anthropic-ai/sdk`/`openai` SDK packages, which resolve their HTTP client via a bare `fetch`
global read at call time (`@anthropic-ai/sdk/internal/shims.js`'s `getDefaultFetch()`), and
grepping the full installed pi-ai + pi-coding-agent dist tree found zero `http.request`/
`https.request`/direct-`undici`-request usage anywhere. `globalThis.fetch` alone is the correct
and sufficient interception point for this dependency chain; the http/https half of the sketch
is dropped from the shipped implementation.

```typescript
export default function (pi: ExtensionAPI) {
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const label = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    return Promise.reject(new Error(`network-deny-guard: blocked fetch(${label}) during isolated integration test`));
  }) as typeof fetch;
}
```

**Load-ordering guarantee, traced (not assumed) in pi's own startup source**: every extension
factory — including this one — runs synchronously to completion inside
`resourceLoader.reload()`, called from `createAgentSessionServices()`
(`agent-session-services.js`). The *first* point after that where pi could originate real
network I/O is later in the same function: `await modelRuntime.refresh({ allowNetwork: false })`
(confirmed at `agent-session-services.js:98` — notably already network-barred by pi itself for
startup catalog refresh, independent of our guard) followed by `resolveModelScope`/session
creation back in `main.js`'s `createRuntime`, which happens strictly after
`createAgentSessionServices()` returns. So: all extension factories (guard included) are
guaranteed to finish before pi resolves a model or could construct a provider's network client.

Second, independent corroboration found while implementing the guard: `main.js` also calls
`configureHttpDispatcher()` after `createAgentSessionServices()` returns (i.e. after every
extension factory has already run). That function explicitly checks whether `globalThis.fetch`
still equals its own captured original before calling `undici.install()` to install undici's
fetch implementation — so a fetch override already in place when it runs (ours) is preserved,
not silently overwritten by pi's own startup code.

AGENT-251 exercised this live: the harness's smoke tests spawn real `pi`/`sandpiper` processes
with the guard extension loaded, and the tripwire op-shim log stayed at its 3-line baseline
across every run, with zero real network activity observed. What remains for AGENT-252
specifically is the deliberate-misconfiguration case — proving the guard fires when a spawn
points at a real, unmocked provider — not the guard's basic load-and-patch mechanics, which are
now live-verified.

**Guard-fires verification (the concrete AGENT-252 test)**: deliberately misconfigure one
scenario to *not* use the mock — e.g. spawn with `--provider anthropic` and no mock registered —
and assert the process fails with the guard's own sentinel error message (`network-deny-guard:
blocked ...`), not a real network error, not a hang, not a silent success. If that scenario ever
produces a real HTTP response or a different failure mode, the guard isn't wired correctly and
no other integration test result can be trusted until it is.

**AGENT-252 concrete deliverable, restated**: build the mock provider (a), pin explicitly (1),
install the network-deny guard (2), and produce one test that demonstrates the guard actually
fires — i.e., deliberately misconfigure a scenario to fall through to a non-mock path and assert
the guard throws — before trusting it protects real coverage. An unverified guard is exactly the
class of claim that started this incident.

## 4. Harness placement + wiring

**Confirmed empirically** (not just per AGENT-249's claim): root `bun run test:vitest` (no
config file at repo root) discovers test files repo-wide via vitest's default
`**/*.test.ts` include glob — verified `packages/trail/**/*.test.ts` and
`extensions/web-search/**/*.test.ts` both ran under a bare root sweep. But nested
`vitest.config.ts` files (`packages/core`, `packages/trail`, `extensions/{shell-relay,web-fetch,
web-search}`, `packages/sandpiper-standup-cli`) are **never loaded** from root — their
`environment`/`testTimeout`/`setupFiles` settings don't apply. Root discovers the *files*, not
the *configs*.

**Proof this already bit the repo once**: `packages/trail/vitest.setup.ts` sets
`GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM`/`JJ_CONFIG` for Trail's git/jj-spawning integration
tests — but that setup file is inert from root. The root `test:vitest` script's env prefix
(`env -u PI_PACKAGE_DIR GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null
JJ_CONFIG="$PWD/packages/trail/test-fixtures/jj-test-config.toml" vitest run`) hardcodes exactly
those same values at the *shell* level to compensate. That's the "proven pattern" AGENT-249
points at, and it's a workaround forced by the gap, not a design to imitate wholesale (it doesn't
scale — every nested suite hoisting its env needs into one shared root script string is not
sustainable, and it's already fragile: it's Trail-specific knowledge baked into a task run by
every package).

**Design for this harness**: don't repeat the hoist-to-root-script pattern *or* add a root
`vitest.config.ts` (a wider-blast-radius change than this task needs, given the whole existing
suite currently depends on zero-config root behavior working as-is). Instead:

- New directory: `devtools/integration/` (sibling to `devtools/`'s existing
  distribution/smoke-test precedent — both are "drive the real thing end-to-end" test classes,
  and `devtools/` is already the established home for tests that spawn real processes/binaries).
- **Isolation-by-construction, not per-test discipline** (AGENT-249's explicit requirement): a
  single shared helper, e.g. `devtools/integration/harness.ts`, exporting something like
  `runIsolatedPi(options)` / `withIsolatedRpcSession(options, fn)`. It is the *only* supported
  way to spawn `pi`/`sandpiper` from a test; it always sets **both** `SANDPIPER_CODING_AGENT_DIR`
  and `PI_CODING_AGENT_DIR` to a fresh `mkdtempSync` directory (per §1's raw-vs-wrapper env-var
  divergence), always neutralizes `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM`/points `JJ_CONFIG` at
  Trail's existing fixture where the extension under test might spawn VCS, always installs the
  network-deny guard (§3) around the spawned process's lifetime, and always requires an explicit
  `--provider`/`--model` pin to the mock. No test file constructs its own `spawn()` call.
- Because this lives under the default include glob, it *is* swept by a bare `bun run test`
  today — confirmed no existing mechanism in this repo actually excludes suites from the default
  sweep (`test:distribution`/`test:standalone` are convenience subset scripts for targeted CI
  staging, not exclusions; their files are *also* part of the default 117-file sweep already).
  Given wave 1 is only 2-3 extensions with a fast in-process mock (no real subprocess network
  wait, no real model latency), this is likely fine to leave in the default gate — revisit only
  if real measured latency argues otherwise once AGENT-253 lands actual tests.

## 5. Wave 1 scope cut

Recommending **skill + autotoon** as the committed wave-1 pair, both zero-external-dependency and
both directly exercised by the confirmed `tool_execution_*` RPC events:

- **`skill` tool** (`plugins/pi/extensions/skill-loading.ts`) — pure, no external deps, already
  used as this doc's own static smoke-test extension. Simplest possible first case: load skill,
  invoke tool via RPC `prompt`, assert `tool_execution_end.result` against the mock's scripted
  tool-call response.
- **`autotoon`** — tool-result JSON→TOON transform is directly observable in
  `tool_execution_end.result` without needing any UI/renderer assertions, and it's a genuinely
  different code shape from `skill` (post-processing an existing tool's output rather than being
  a tool itself), giving wave 1 two structurally different coverage patterns for the price of
  two extensions.

**Deferred past wave 1, with reasons** (not just "not now" — each has a concrete blocker):
- `background-process` — real timing/notification semantics (the whole point of testing it is
  process-completion notifications, which means real wall-clock waits or a fake-timer strategy
  neither confirmed nor designed yet); candidate for wave 2 once wave 1 proves the harness
  itself is solid.
- `tattler` — "two-process potential" is exactly right and exactly why it's not wave 1: it needs
  the harness to spawn and correlate *two* isolated `pi` processes with distinct identities, a
  materially bigger harness capability than anything wave 1 needs. Don't let tattler coverage
  gate wave 1 landing; it's the natural wave-2 anchor once single-process RPC driving is proven.
- `shell-relay` (needs zellij) and `web-fetch`/`web-search` live paths (network) — excluded per
  AGENT-249's own note; their mock adapters (e.g. `DdgSearchAdapter` already visible in
  `extensions/web-search/src/ddg-adapter.test.ts`) may allow *unit*-level inclusion later but add
  nothing RPC-specific to prove in wave 1.

## Dependency inversion: live verification moves downstream

Per the coordinator's ruling: mock-provider-only is now a standing rule, and it did not exist
when this task was scoped. This design was going to include a live-verified confirmation of §1's
flag composition and §2's RPC handshake shape (both were about to be run live when the incident
happened). **That verification is now impossible under the current rule** without the mock
existing first. Restating the actual dependency graph:

- AGENT-250 (this doc) ships on **static grounding only**: `--help` output, installed source
  reading, docs reading, and the one static (no-network, no-completion) `-e`/`--no-extensions`
  flag-composition smoke test that predates the mock-provider rule and needed no model call.
- AGENT-252 must build the mock provider **and** the network-deny guard **and** demonstrate the
  guard fires, before any of §2's RPC-handshake claims or §3's no-fallback pinning claims get
  live-exercised for the first time.
- AGENT-253's wave-1 coverage is the first real exercise of the full stack end-to-end.

This is a real schedule cost (design and first live proof are no longer the same milestone), and
worth stating plainly rather than quietly absorbing: **nothing in §2 or §3 of this document has
been run against a live model or a live RPC session.** It is grounded in installed source and
documentation, not observed behavior. Flagging this explicitly is the point of the exercise.

## Open questions for the coordinator

1. Does `devtools/integration/` match intent, or should this live under a different top-level
   directory given it's a new *class* of test (spawns real binaries) rather than a build/dist
   check?
2. Is leaving wave-1 tests in the default `bun run test` sweep (no exclusion) acceptable, or
   should this design add an actual exclusion mechanism up front rather than deferring to
   AGENT-253?
3. Confirm the skill + autotoon wave-1 pair, or redirect to a different 2-3.
