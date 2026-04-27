---
title: "Harness foundation: isolated-env spawn + print-mode and RPC drivers"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: "sandpiper-0.84-dev"
reporter: AGENT
created_at: 2026-08-07T14:57:56.381Z
updated_at: 2026-08-07T16:04:33.230Z
depends_on:
  - AGENT-250
---

# Harness foundation: isolated-env spawn + print-mode and RPC drivers

Build the shared integration harness per the approved AGENT-250 design. Requirements fixed regardless of design details: (1) isolation-by-construction - every spawn goes through one helper that defaults SANDPIPER_CODING_AGENT_DIR to a per-test temp dir, neutralizes GIT_CONFIG_GLOBAL/GIT_CONFIG_SYSTEM, sets JJ_CONFIG to the trail fixture when VCS could spawn, blackholes the provider base URL unless a mock provider is configured, and tolerates the op-shim PATH prefix; (2) two entry modes - sandpiper binary and bare pi with restricted extension loading; (3) print-mode driver handling the AGENT-248 landmines (stdin from /dev/null, placeholder API key, no reliance on ctx.shutdown-dependent behavior); (4) RPC driver that is delta-native for message_update (0.84.0 breaking change; message_end authoritative) and exposes tool-call/tool-result events for assertions; (5) placement compatible with the root test:vitest gate (nested vitest configs are not discovered from root - proven earlier this session). Unit tests for the harness helpers themselves; a smoke integration test proving both drivers against a trivial scripted turn.

Note on requirement (1)'s literal wording ("blackholes the provider base URL"): superseded by the design's own approved mechanism (registerProvider+streamSimple mock, network-deny guard, explicit provider/model pinning) -- base-URL blackholing was retired earlier this session as a non-functional mechanism. Implemented per the design doc, not the task's original phrasing.

## Implementation (2026-08-07)

Built at devtools/integration/:

- harness.ts -- prepareIsolatedSpawn(): the single choke point every driver goes through. Always sets SANDPIPER_CODING_AGENT_DIR + PI_CODING_AGENT_DIR (both names, both entry modes -- APP_NAME only rebrands when Sandpiper's package.json is in PI_PACKAGE_DIR's scope, which raw-pi invocations never see), neutralizes GIT_CONFIG_GLOBAL/GIT_CONFIG_SYSTEM, points JJ_CONFIG at Trail's fixture, always loads mock-provider.ts + network-deny-guard.ts via -e, always pins --provider/--model to the mock (overridable only for AGENT-252's deliberate guard-fires scenario), inherits process.env.PATH so the op-shim tripwire prefix survives into spawned children. entry:'pi' adds --no-extensions/--no-skills/--no-prompt-templates/--no-themes/--no-context-files for true single-extension isolation against the raw installed pi CLI (resolved via pi-coding-agent's own package.json "bin" field, not a guessed path); entry:'sandpiper' runs packages/cli/sandpiper_standalone.ts directly from source (no build step required).
- mock-provider.ts -- registers a provider via pi.registerProvider() with a streamSimple implementation that performs zero network I/O (no fetch/http call exists in the function). AGENT-251 scope: one canned text reply per process (SANDPIPER_INTEGRATION_MOCK_REPLY env var, defaults to "ok"). Multi-turn/tool-calling scripting is AGENT-252's extension of this same file.
- network-deny-guard.ts -- monkeypatches globalThis.fetch to reject with a sentinel error. IMPORTANT CORRECTION FROM THE APPROVED DESIGN: the design's sketch also patched node:http/node:https .request. Building it surfaced that half was broken (ECMAScript module namespace objects are immutable from outside the module -- confirmed empirically with a standalone bun script; a separately-require()'d CJS reference can be mutated but that mutation doesn't propagate to the ESM namespace binding other code calls through) AND unnecessary (grepped the full installed pi-ai + pi-coding-agent dist tree: zero direct http.request/https.request/undici-request usage anywhere; Anthropic/OpenAI-family providers go through the official SDKs, which resolve their HTTP client via a bare `fetch` global read at call time -- confirmed via @anthropic-ai/sdk's getDefaultFetch()). Dropped the http/https half from the shipped implementation; fetch-only is correct and sufficient for this dependency chain. Corrected the already-approved design doc in place with this finding (Refs: AGENT-250 doc revision, same commit tree) rather than silently diverging from what was approved.
- print-mode-driver.ts -- runPrintMode(): spawnSync with stdin 'ignore' (Node redirects to /dev/null, avoiding AGENT-248's readPipedStdin() hang), captures stdout/stderr/exitCode.
- rpc-driver.ts -- startRpcSession(): async spawn, splits stdout strictly on '\n' (per docs/rpc.md's own warning that Node's readline is not protocol-compliant for RPC framing), correlates command/response by id, buffers message_update text deltas by contentIndex for streaming assertions while treating message_end.message as authoritative, exposes tool_execution_* events via the general event log for future tool-call/result assertions.

Tests: harness.test.ts (11 cases, pure-function unit tests of prepareIsolatedSpawn's env/args composition), network-deny-guard.test.ts (2 cases, in-process verification the guard's own patch mechanics work, restoring globalThis.fetch afterward to avoid cross-test pollution), smoke.integration.test.ts (3 cases, REAL spawned-process end-to-end proof: print-mode driver against both entry modes, RPC driver streaming+message_end+delta-buffer correctness -- all against the mock provider, all through real bun-spawned pi/sandpiper processes).

Also updated devtools/README.md and added devtools/integration/README.md documenting the isolation model and known limitations (fetch-only guard scope, in-process-only, minimal mock scripting, guard-fires proof not yet built).

Verification: bun check clean throughout every iteration. Full bun run test suite run as final post-edit check. Tripwire shim log held at 3-line baseline across every check AND across every real process spawn in the smoke tests -- zero network egress observed empirically, not just claimed.

Deliberately NOT built (explicitly AGENT-252/253 scope): multi-turn/tool-calling mock scripting beyond one canned reply; the guard-fires proof (deliberately misconfigure a spawn to skip the mock and assert the sentinel fires against a real-but-unmocked provider); wave-1 extension coverage tests.

## Revision (2026-08-07, during review)

Reviewer caught a false claim: "zero http.request/https.request usage in pi-ai's dependency tree" was wrong. @smithy/node-http-handler (transitive dependency of pi-ai's Bedrock provider via @aws-sdk/client-bedrock-runtime) does `require('node:https')` at module scope and reads `.request` as a call-time property lookup, not a cached reference -- so the require()-based patch (which this task originally dropped) actually DOES work for it, and load order doesn't matter because it's a fresh lookup every call.

Restored the https.request patch (fetch stays patched too), keeping the guard's own explanation of why the ORIGINAL http.request/https.request attempt failed (require/import interop mismatch in how it was tested, not proof the target is unpatchable) distinct from why THIS attempt works (require-to-require, no mismatch).

Documented pi-ai's two Bedrock load paths precisely: (a) an eager/static registration path used only by pi's compiled Bun-binary build, unreachable by either harness entry mode by construction; (b) the normal lazy path (bedrock-converse-stream.lazy.js's lazyApi wrapper around a dynamic import), which only loads smithy on an actual dispatch attempt. Consequence: AGENT-252's Bedrock guard-fires case must drive a real turn, not just pass --provider amazon-bedrock, or smithy never loads and the test proves nothing.

Added a second, independent backstop: harness.ts now pins fake AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY/AWS_PROFILE unconditionally on every spawn, so if the guard itself regresses, AGENT-252's Bedrock guard-fires test authenticates as garbage and gets a 403 rather than spending real ambient AWS credentials -- same principle as the op-shim tripwire.

Corrected the design doc and devtools/integration/README.md in place with full evidence for both rounds of correction.

Verification: full bun run test:vitest run clean at 117/117 files, 1097/1097 tests, after ruling out a transient false-negative from a period of extreme system load (load avg 24.94 observed via uptime during a concurrent run, ~19 tests timed out across totally unrelated files -- packages/trail's real jj/git-spawning tests, devtools/ecosystemPackage.test.ts -- none touching devtools/integration/; re-ran the same failing files individually seconds later, all passed in ~1-2s each; re-ran the full suite once more after load dropped to 6.64, clean 117/117 -- confirmed via direct uptime observation, not asserted). Tripwire shim log held at 3 lines throughout every run, including the contended one.

---

# Activity Log

## 2026-08-07T15:28:06.993Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → sandpiper-0.84-dev

## 2026-08-07T15:44:00.288Z

- **description**: 1 line → updated (21 lines)

## 2026-08-07T15:44:31.535Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-08-07T16:00:28.833Z

- **description**: 21 lines → updated (35 lines)

## 2026-08-07T16:04:33.231Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
