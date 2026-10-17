# AGENT-249: Headless CLI Integration-Test Harness — Grounding + Design (AGENT-250)

Status: approved (AGENT-250); implemented (AGENT-251/252) at devtools/integration/. Carries a
postmortem (§3): the original incident behind this whole design was misdiagnosed as an
ambient/OS-keychain credential leak, which motivated building a "network-deny guard" (a
monkeypatch-based network-interception layer) across AGENT-251 and part of AGENT-252. The real
root cause turned out to be a self-inflicted, pre-harness configuration gap (see §3's "Incident
log and postmortem"), and pi has no silent-fallback path from an explicit `--provider` pin to
begin with -- so the guard was torn down entirely (§3's "The network-deny guard: built, then
torn down, and why"), replaced by a direct proof of the actual fix (the config-isolation
containment canary) plus `--offline` for test hermeticity. Read that section before this
document's history in `.jj`/task records, which still reflect the guard's now-superseded
build-out -- this is the current, load-bearing account. Full live-completion verification of the
RPC/mock-provider claims remains scoped as originally described (see
[Dependency inversion](#dependency-inversion-live-verification-moves-downstream)).

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

successfully loaded exactly the one extension file (see [§3 incident log](#incident-log-and-postmortem-what-actually-happened-and-what-didnt)
for what happened downstream of this same invocation — the flag composition itself worked; the
incident's original OS-keychain explanation was later corrected and the whole detour it caused
was torn down, see that section).

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

### Incident log and postmortem: what actually happened, and what didn't

Two live smoke attempts during AGENT-250 grounding (both disclosed and frozen on immediately)
proved the overnight "blackhole via `ANTHROPIC_BASE_URL`" rule doesn't work (`pi-ai`'s Anthropic
provider hardcodes `baseUrl: "https://api.anthropic.com"` — no env override exists; grepped the
whole installed `pi-ai`+`pi-coding-agent` dist tree, the only `ANTHROPIC_BASE_URL` reference is
Cloudflare AI Gateway routing, unrelated). That finding stands.

A second finding — that a keyless run with no `--provider`/`--model` pinning completed a real
turn against a real, ambiently-authenticated provider — was real, but its original explanation
was wrong and has since been corrected (2026-08-08, root-caused by Doug against the pair's own
earlier framing). It was not an OS keychain or cached-OAuth store bypassing process isolation.
It was a self-inflicted configuration gap in the ad hoc debug commands that produced the
incident, run before this harness existed: those commands set only `PI_CODING_AGENT_DIR` to a
temp directory, never `SANDPIPER_CODING_AGENT_DIR`, and never overrode `PI_PACKAGE_DIR`. Because
`PI_PACKAGE_DIR` was left unset, it inherited the *invoking* Sandpiper session's own value —
pointed at Sandpiper's branded package (with `piConfig`), making `APP_NAME` resolve to
`"sandpiper"` and `ENV_AGENT_DIR` resolve to `"SANDPIPER_CODING_AGENT_DIR"` (AGENT-221's
confirmed derivation) — the one variable name those commands never touched, which therefore
inherited the *real* `~/.sandpiper/agent`. Real `settings.json` loaded, with Doug's real
configured providers (a `claude-cli` provider that forks to the real Claude Code CLI binary,
needing no stored credential file at all — explaining the keyless success; and a Codex-family
provider — explaining the separate strict-schema rejection incident, consistent with, not
contradicted by, AGENT-254's independently source-verified capability-only-gating finding).
Verified by reconstruction and by a safe re-run: identical invocation, both agent-dir names set
to the same fresh temp dir, keyless — clean, deterministic `"No API key found for the selected
model."` exit, zero completion, the temp agent dir left holding only fresh empty state.

**This harness's own `prepareIsolatedSpawn()` was never affected.** It has set *both* agent-dir
env var names unconditionally since AGENT-251 — precisely the fix this correction confirms is
sufficient. The incident was a property of hand-run debug commands that predated the harness,
not a gap in its design.

### The network-deny guard: built, then torn down, and why

Between the corrected root cause above and AGENT-252's build of the guard-fires proof, this
design carried a "network-deny guard" — a monkeypatch of `fetch`/`https.request`/`http2.connect`
inside every spawned process, with a documented enumeration+canary+backstop threat model, built
in direct response to what was, at the time, believed to be an ambient-credential leak the
harness couldn't otherwise contain. Building its per-provider-family guard-fires tests found and
fixed two real, specific gaps in it along the way (a broken `https.request` patch attempt, then
a missed `http2.connect` transport used by Bedrock's actual default handler) — both real
findings, verified empirically, and both now moot for a reason that has nothing to do with
either fix being wrong.

**Doug's question, unanswered until he asked it directly: what situation causes a pinned
invocation to *not* use the mock?** Answer: none. An unknown `--provider` value is a hard error.
An unresolvable `--model` value is a hard error. Pi 0.84.0 makes model-resolution ambiguity an
explicit error, not a silent substitution. There is no fall-through mechanism from an explicit
provider pin to *anything* else — real credential, ambient OAuth, or otherwise. Every layer of
the guard was scar tissue from an incident whose real root cause (the branding-trap isolation
gap above) was found only once Doug pushed past the pair's own prior framing. The guard
machinery was built to defend against a fallback path that does not exist in pi.

**Torn down entirely, not reframed**: the guard extension, its diagnostic-log mechanism, all
transport patches, the per-provider-family guard-fires tests, and the fake-AWS-credential env
defaults that existed to backstop them. What replaced it, per Doug's ruling, is simpler and maps
onto what's actually true:

- **Config isolation** (dual agent-dir env var names, always set — the real fix for the real
  incident) plus **routing through an isolated `settings.json`** is what prevents a spawned test
  from ever reaching real credentials. Proven directly by
  `config-isolation-canary.integration.test.ts`: isolated, keyless, and deliberately unpinned
  (reproducing the incident's exact invocation shape) — hard error, no completion, confirmed.
- **Explicit `--provider`/`--model` pinning** to the mock, for every test that isn't the canary
  above, relies on pi's own hard-error-on-unknown-provider behavior rather than a
  process-level interception layer backing it up. There is no known mechanism by which that pin
  gets silently ignored.
- **`--offline`**, passed unconditionally by `prepareIsolatedSpawn()`, is the answer to the one
  real *hermeticity* (not safety) concern that survived the teardown: isolated test runs were
  making incidental network calls at startup regardless of whether a turn was ever attempted —
  observed directly while building the guard, as repeated `https://pi.dev/api/models/providers/
  ...` catalog-refresh fetches even in a keyless, immediately-failing run. `--offline` suppresses
  pi's startup network operations; verified empirically (with the guard's diagnostic log, before
  it was deleted, as a one-time debugging tool) that the catalog fetches stop happening with the
  flag set. This is a determinism measure — isolated tests shouldn't depend on reaching a real
  network endpoint just to start up — not a credential-safety mechanism.

The mock provider itself (below) is unaffected by this teardown: it was never the thing doing
the protecting, and remains the right mechanism for deterministic, scripted, offline turns.

### Mechanism evaluation

**(a) `pi.registerProvider()` with a full `streamSimple` implementation — recommended, and
what's implemented.** `docs/custom-provider.md` documents `streamSimple: (model, context,
options) => AssistantMessageEventStream` as a complete escape hatch: the extension owns the
entire event sequence (`start` → content deltas → `done`/`error`) and pi never constructs its
own HTTP client for that provider at all. A mock built this way is structurally incapable of
network I/O in its own right — no code path inside `mock-provider.ts`'s `streamSimple`
implementation calls `fetch`/`http`/`https` — independent of whatever else this design does or
doesn't do around it.

**(b) The "faux-provider" deferred-response contracts (0.84.0, #7339) — investigated, not
useful for this.** Changelog: "deferred provider request contracts, durable response handles,
authenticated fetch/cancel dispatch, and faux-provider support for pending, ready, failed, and
cancelled responses." This is infrastructure for **async external interactions with durable,
resumable state** (the shape matches OAuth device-flow polling or long-running external
approval, not a scripted chat-completion mock). AGENT-250's task description flagged this as a
candidate to evaluate; verdict: **not applicable** — wrong feature, no scripted-conversation
surface, dropping it from consideration.

**(c) Blackholed provider + error-path-only assertions — rejected outright.** The whole reason
this section exists is that env-var blackholing doesn't work as a control at all (see the
`ANTHROPIC_BASE_URL` finding above). This option is retired along with the overnight rule that
inspired it.

**Scripting (AGENT-252, implemented)**: `mock-provider.ts` supports scripted multi-turn
conversations and scripted tool calls via `SANDPIPER_INTEGRATION_MOCK_SCRIPT` (a JSON-encoded
array of text/toolCall steps), indexed by how many assistant messages already exist in
`context.messages` — not a call counter, so script position is immune to retries. Falls back to
a single canned reply (`SANDPIPER_INTEGRATION_MOCK_REPLY`, AGENT-251's original scope) when no
script is set. Proved end-to-end via a real spawned RPC session driving a real tool execution
against a test fixture tool, including a deterministic error when a script runs out of steps.

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
(`env GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null
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
  single shared helper, `devtools/integration/harness.ts`'s `prepareIsolatedSpawn()`. It is the
  *only* supported way to spawn `pi`/`sandpiper` from a test; it always sets **both**
  `SANDPIPER_CODING_AGENT_DIR` and `PI_CODING_AGENT_DIR` to a fresh `mkdtempSync` directory (per
  §1's raw-vs-wrapper env-var divergence -- this is the actual fix for the incident described in
  §3, not a guard around it), always neutralizes `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM`/points
  `JJ_CONFIG` at Trail's existing fixture where the extension under test might spawn VCS, always
  passes `--offline` (§3, hermeticity not safety), and always requires an explicit
  `--provider`/`--model` pin to the mock by default (overridable for the config-isolation
  canary, which deliberately omits it). No test file constructs its own `spawn()` call.
- Because this lives under the default include glob, it *is* swept by a bare `bun run test`
  today — confirmed no existing mechanism in this repo actually excludes suites from the default
  sweep (`test:distribution`/`test:standalone` are convenience subset scripts for targeted CI
  staging, not exclusions; their files are *also* part of the default 117-file sweep already).
  Given wave 1 is only 2-3 extensions with a fast in-process mock (no real subprocess network
  wait, no real model latency), this is likely fine to leave in the default gate — revisit only
  if real measured latency argues otherwise once AGENT-253 lands actual tests.

## 5. Wave 1 scope cut

**Status: implemented (AGENT-253).** `devtools/integration/wave1-skill.integration.test.ts`,
`wave1-autotoon.integration.test.ts`, and `wave1-compaction.integration.test.ts` land the
scope described below, plus the AGENT-237(e) payoff hypothesis (see the new subsection at the
end of this section) and direct unit coverage of `rpc-driver.ts`'s line-buffering
(`rpc-driver.test.ts`, forcing the OS-timing-dependent multi-line-per-chunk and
split-across-chunks cases a real spawn can't reliably be made to exercise on demand).

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
- The compiled-binary variant of `entry:'sandpiper'` (running the actual compiled standalone
  app bundle rather than source) stayed OPTIONAL per the coordinator's ruling and was evaluated,
  not skipped by default: the compiled binary isn't currently built in this environment, and
  building it is a real `bun compile` step, not something a skip-if-not-built test can make
  cheap on its own. Left as named wave-2 scope, per the same ruling.

### The AGENT-237(e) payoff, realized

AGENT-237(e) (tattler/chorus `deliverAs:'steer'` delivery through compaction) was deferred to
Doug's manual sweep because, at the time, "there was zero existing test coverage of compaction
anywhere in extensions/ or packages/core/, and the risk lives entirely inside Pi's internal
turn/compaction state machine, which only exists during a real streaming turn -- nothing to mock
without testing the mock instead of Pi's actual behavior." That reasoning predates this harness:
the mock provider is a real, structurally-network-incapable *provider* that pi's actual
compaction/turn machinery treats exactly like any other provider -- only the model *content* is
scripted, not pi's internal state machine.

`wave1-compaction.integration.test.ts` (AGENT-253) drives real manual compaction via the RPC
`compact` command and a `steer`-delivered message mid-turn against the mock, both against real
pi compaction/turn machinery, zero real network egress. Two real findings surfaced building it,
recorded rather than smoothed over: (1) pi's default `compaction.keepRecentTokens` (20000)
means a realistically-sized scripted conversation never has anything old enough to compact --
a genuine pi safeguard, not a bug; `harness.ts` gained a `settingsJson` option (writes
`settings.json` into the isolated agent dir before spawn) to make manual compaction reachable
without an unreasonably large scripted conversation. (2) the compaction summarization
`streamSimple()` call does not receive the same context shape a normal turn does (observed, not
assumed) -- the mock's `context.messages`-count script-step indexing (AGENT-252) doesn't
reliably land on a chosen "summary" step for compaction specifically. The tests therefore assert
real structural claims (compact succeeds with a non-empty summary; a steer-delivered message is
visible in `get_entries` before compaction; a normal turn completes correctly after compaction)
rather than the compaction summary's exact content, which would assert an indexing accident, not
a real claim -- exactly the tautological-test failure mode this whole project has repeatedly had
to catch and correct elsewhere.

Net result: AGENT-237(e) moves from "needs Doug at a real terminal, no headless path existed" to
"headlessly tested, structurally proven, in CI." AGENT-237's own task record is the source of
truth for its final disposition (Doug's call, not this design doc's).

## Dependency inversion: live verification moves downstream

Per the coordinator's ruling: mock-provider-only is now a standing rule, and it did not exist
when this task was scoped. This design was going to include a live-verified confirmation of §1's
flag composition and §2's RPC handshake shape (both were about to be run live when the incident
happened). **That verification is now impossible under the current rule** without the mock
existing first. Restating the actual dependency graph:

- AGENT-250 (this doc) ships on **static grounding only**: `--help` output, installed source
  reading, docs reading, and the one static (no-network, no-completion) `-e`/`--no-extensions`
  flag-composition smoke test that predates the mock-provider rule and needed no model call.
- AGENT-252 built the mock provider and its scripting, and (per §3's postmortem) the
  config-isolation containment canary, before any of §2's RPC-handshake claims got
  live-exercised for the first time.
- AGENT-253's wave-1 coverage is the first real exercise of the full stack end-to-end.

**Historical note**: this section originally stated "nothing in §2 or §3 of this document has
been run against a live model or a live RPC session" -- true when AGENT-250 was written, no
longer true. AGENT-251 and AGENT-252 both ran extensive live verification (real spawned
processes, real RPC sessions, real tool execution, the real incident and its correction
documented in §3) -- kept here as a record of the dependency structure this design was built
under, not a claim about current state. See the Status line at the top of this document.

## Open questions for the coordinator

1. Does `devtools/integration/` match intent, or should this live under a different top-level
   directory given it's a new *class* of test (spawns real binaries) rather than a build/dist
   check?
2. Is leaving wave-1 tests in the default `bun run test` sweep (no exclusion) acceptable, or
   should this design add an actual exclusion mechanism up front rather than deferring to
   AGENT-253?
3. Confirm the skill + autotoon wave-1 pair, or redirect to a different 2-3.
