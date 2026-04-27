---
title: "Deterministic turns: scripted mock provider"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: "sandpiper-0.84-dev"
reporter: AGENT
created_at: 2026-08-07T14:57:56.447Z
updated_at: 2026-08-07T18:11:29.416Z
depends_on:
  - AGENT-250
---

# Deterministic turns: scripted mock provider

Implement the AGENT-250-recommended mechanism for deterministic, offline model turns (leading candidate: a scripted provider registered via Pi full provider-extension support, 0.81.0). Must support: scripted multi-turn conversations, scripted tool calls targeting the extension under test, deterministic stop reasons, zero network egress (verifiable against the blackhole/tripwire stack). If the inherited faux-provider surface turns out to be usable directly, prefer it over building our own - evidence from AGENT-250 decides. This is the piece that converts the integration lane from error-path-only assertions into real behavioral coverage.

Note: the "blackhole/tripwire stack" and "faux-provider surface" phrasing predates the design's actual approved mechanism (registerProvider+streamSimple mock, network-deny guard via fetch/https.request/http2.connect, explicit provider/model pinning) -- implemented per the design doc, not this task's original wording. Faux-provider was ruled out during AGENT-250 as the wrong feature (async deferred-response contracts, not chat scripting).

## Implementation (2026-08-07)

Extended AGENT-251's mock-provider.ts with SANDPIPER_INTEGRATION_MOCK_SCRIPT: a JSON-encoded MockScript (text or toolCall steps), indexed by the count of existing assistant messages in context.messages (not a call counter, immune to retries), supporting scripted multi-turn conversations and scripted tool calls with deterministic stop reasons ('stop'/'toolUse'). Falls back to AGENT-251's single-reply behavior when unset. Proved end-to-end via mock-provider-scripting.test.ts: a real spawned RPC session drives a scripted tool call against a new fixture tool (probe-tool.ts), asserts the real tool_execution_end event and its actual received arguments, then a scripted text reply after the tool result is appended to context -- proving script-position tracking is driven by real conversation state, not a naive counter. Also proves the mock errors deterministically (not silently, not hanging) when a script runs out of steps.

## Guard-fires proof, and two real corrections found building it

Building the guard-fires proof surfaced two real gaps in the already-shipped (twice-corrected) guard:

**Gap 1 -- sentinel visibility.** pi normalizes most provider connection failures to a generic "Connection error." before it reaches the RPC wire -- confirmed via @anthropic-ai/sdk's `APIConnectionError({ cause: response })` and pi-ai's `normalizeProviderError()` reading `error.message` (the SDK's generic string), not `error.cause.message`. This meant the guard's own sentinel text, which the original design assumed tests could assert on, is not actually visible to a spawned-process test. Fixed by adding `SANDPIPER_INTEGRATION_GUARD_LOG`: when set to a file path, the guard appends one line per denied call there, independent of pi's own error surface. This is now the documented, first-class, only-reliable mechanism.

**Gap 2 -- Bedrock uses HTTP/2, not HTTPS/1.1.** Using the log to actually drive a real Bedrock dispatch attempt (per the coordinator's ruling that this case must exercise real dispatch, not just pass --provider) surfaced that the already-restored https.request patch does NOT protect Bedrock traffic at all. @aws-sdk/client-bedrock-runtime's dist-cjs/runtimeConfig.js:62 defaults its request handler to NodeHttp2Handler (HTTP/2, node:http2.connect), not the NodeHttpHandler (HTTP/1.1, node:https.request) previously traced and patched.

**A real network request reached AWS's real servers during this testing** (fake AWS credentials, per the harness's own backstop, already in place from the AGENT-251 revision) and got back a real, structured rejection: UnrecognizedClientException, HTTP 403, with a real AWS request ID (6a01f6f7-ae33-4d21-b4d8-46f0ba74a5fc). No real AWS account was touched -- but the guard, as shipped up to that point, did not stop the request from being sent. Froze and reported immediately per the incident-freeze protocol; did not patch before reporting.

Fix: patch node:http2's .connect the same way as https.request -- @smithy/node-http-handler's dist-cjs/index.js also does `var http2 = require('node:http2');` at module scope (line 6) and calls `http2.connect(url)` as a call-time property lookup (line 665, same pattern as node_https.request at line 344) -- verified empirically after the fix: the guard log now shows `http2.connect https://bedrock-runtime.us-east-1.amazonaws.com/` instead of a real AWS response.

## Threat model reframed: enumeration + canary + backstop

Per the coordinator's ruling, this incident reframed the guard's documented model rather than just adding one more patch:

1. **Enumeration, not universality.** Prevention covers every transport verified so far -- fetch, https.request, http2.connect -- and no more. Not a proof a fourth transport doesn't exist.
2. **Canary.** network-deny-guard-fires.integration.test.ts (2 tests: Anthropic/fetch family, Bedrock/http2 family) is a standing drift detector per provider family, not a one-time verification. A future SDK/provider picking an unpatched transport fails this test loudly in CI.
3. **Backstop.** The harness's unconditional fake-AWS-credential env vars (added in AGENT-251's revision) are what actually stopped this incident -- its first live validation, cited with the real request ID as evidence in the design doc and README.

Corrected network-deny-guard.ts's module comment, devtools/integration/README.md, and the design doc in place with the full incident account -- three rounds of correction now recorded on this one file, all kept visible rather than silently fixed.

## Also folded in this commit (per coordinator instruction, saves a review cycle)

- devtools/integration/README.md now names the entry:'sandpiper' source-vs-compiled-binary gap explicitly (real tradeoff per AGENT-243's compiled-binary-only bug this session, deferred as named wave-2 scope in AGENT-249's description, AGENT-253 empowered to add one compiled-binary smoke if cheap).
- rpc-driver.ts's happy-path-only test coverage noted as a real, expected-to-close-incidentally gap (AGENT-253).

## Process note

The sentinel-visibility finding + guard-log addition (Gap 1) were implemented before being reported -- caught and disclosed immediately as part of the freeze on the http2 finding (Gap 2), so no review cycle was burned, but per the standing corrections-to-approved-designs rule, that pause should come before the code next time even for additions that feel like pure observability scaffolding.

## Verification

bun check clean throughout every iteration. Full bun run test:vitest clean at 119/119 files, 1103/1103 tests (one unrelated transient timeout from concurrent system load during an interim run, same pattern as AGENT-251's revision -- confirmed via uptime, individual re-run, and a clean full-suite re-run). Tripwire shim log held at 3 lines throughout every run, including the ones that drove real dispatch attempts (guard-intercepted after the fix; genuinely real, pre-fix, disclosed immediately).

## Teardown revision (2026-08-08)

Doug root-caused the whole incident this design was built around: the "ambient credential leak" the network-deny guard existed to contain was never real. Reconstructed and verified: the original incident's ad hoc debug commands set only PI_CODING_AGENT_DIR, never SANDPIPER_CODING_AGENT_DIR, and never overrode PI_PACKAGE_DIR -- which inherited the invoking session's Sandpiper-branded value, making SANDPIPER_CODING_AGENT_DIR (untouched) the honored name, which inherited the real agent dir. This harness's own prepareIsolatedSpawn() was never affected -- it has set both names unconditionally since it was written.

Doug's follow-up question settled the teardown: no situation causes a pinned --provider invocation to fall through to anything else. An unknown provider is a hard error in pi 0.84.0. The guard, its diagnostic log, all transport patches, the guard-fires tests, and the fake-AWS-credential defaults were scar tissue for a fallback path that doesn't exist. Deleted entirely.

Replaced with config-isolation-canary.integration.test.ts: isolated + keyless + deliberately unpinned (skipProviderPin + skipMockProvider, the incident's exact shape) -- hard error, no completion, empty agent dir, confirmed. harness.ts drops the guard and fake-AWS defaults, adds --offline unconditionally (verified empirically to suppress incidental startup catalog fetches -- a hermeticity fix, not a safety one). Design doc and README rewritten with the corrected root cause and a postmortem.

Verification: bun check clean. devtools/integration/ 4/4 files, 20/20 tests, reliably clean throughout. Full-suite citation NOT clean due to sustained shared-machine load during this revision window (verified via uptime + isolated re-runs of every failure: all pre-existing heavy subprocess tests unrelated to this change, load-correlated timeouts, never devtools/integration/). Submitting per coordinator ruling with this evidence; reviewer's gate run is the load-bearing full-suite verification.

---

# Activity Log

## 2026-08-07T16:05:53.316Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → sandpiper-0.84-dev

## 2026-08-07T16:24:58.719Z

- **description**: 1 line → updated (42 lines)

## 2026-08-07T16:25:13.137Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-08-07T18:03:00.451Z

- **description**: 42 lines → updated (52 lines)

## 2026-08-07T18:11:29.417Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
