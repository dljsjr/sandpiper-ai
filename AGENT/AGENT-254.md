---
title: "skill tool schema rejected by strict-schema provider family (possible AGENT-240 interaction)"
status: COMPLETE
resolution: DONE
kind: BUG
priority: HIGH
assignee: "sandpiper-0.84-dev"
reporter: "sandpiper-0.84-dev"
created_at: 2026-08-07T15:03:57.415Z
updated_at: 2026-08-07T22:10:06.335Z
---

# skill tool schema rejected by strict-schema provider family (possible AGENT-240 interaction)

During AGENT-250 grounding (2026-08-07), a keyless bare-pi invocation that auto-selected a Codex/Copilot-family provider via ambient cached auth failed LOCALLY (before network, shim log unchanged) with: "Codex error: Invalid schema for function 'skill': ... additionalProperties is required to be supplied and to be false" - exit 1.

Two candidate explanations, investigation must distinguish them STATICALLY (live testing banned until the mock provider exists):
1. AGENT-240 regression path: constrainedSampling strict:'prefer' (added 2026-08-06 to the skill tool and 8 others) ACTIVATES strict mode on providers that support it. The reviewer's AGENT-240 verification proved graceful degradation on UNSUPPORTED models (resolveJsonSchemaStrictSampling returns undefined) but the strict-SUPPORTED path was never exercised live. If Pi forwards our TypeBox-emitted schemas as-is under strict mode, every Type.Object without additionalProperties:false (all of ours) violates OpenAI-strict requirements - meaning AGENT-240 potentially broke all 9 prefer-marked tools on strict-supporting provider families.
2. Pre-existing Codex-family behavior independent of constrainedSampling (that provider family may require strict-valid schemas for ALL tools regardless of our opt-in).

Static investigation path: read pi's strict-sampling schema pipeline (does resolveJsonSchemaStrictSampling or the provider layer TRANSFORM schemas - adding additionalProperties:false, closing optionals into required-nullable - or forward verbatim?); check whether the error predates AGENT-240 by examining what the Codex provider path does with tools that have NO constrainedSampling set; check pi's own built-in tools' schemas for additionalProperties handling as the reference pattern.

If (1): scope options are emitting strict-compatible schemas (additionalProperties:false on our Type.Objects - verify TypeBox emission), or reverting strict:'prefer' pending upstream clarity. If (2): likely an upstream issue candidate. Either way: report findings to coordinator before any fix; AGENT-240's approval record should be annotated with the outcome.

## Investigation outcome (2026-08-07): HYPOTHESIS 1 CONFIRMED, capability-only gating

Read resolveJsonSchemaStrictSampling() in full (pi-ai/dist/api/constrained-sampling.js): it gates purely on the boolean `supportsStrictMode` parameter passed in by the provider layer -- if true, it unconditionally returns `true` (use strict mode). Zero schema-shape inspection anywhere in the function. No upstream layer filters either: openai-completions.js's tool-mapping (line ~1093-1103) forwards `tool.parameters` verbatim ("TypeBox already generates JSON Schema" -- literal comment in the source) into every strict-marked tool's function-calling entry, with no transformation and no per-tool fallback if that particular schema happens to be strict-incompatible.

Compiled the skill tool's actual TypeBox schema directly to confirm: Type.Object with Type.Optional properties, no `additionalProperties: false` anywhere in the emitted JSON Schema -- exactly what OpenAI-strict mode rejects.

Checked pi's own built-in tools (read/bash/edit/write/find/grep/ls) as the reference pattern: NONE of them set `constrainedSampling` at all, so none of them ever reach the strict-mode code path regardless of provider capability. This explains why the failure mode went unnoticed until our own 9 tools opted in via AGENT-240 -- built-in tools were simply never exposed to it.

Blast radius: 19 `strict: 'prefer'` occurrences across 9 tools in tattler, chorus, shell-relay (2 tools), web-fetch, web-search, skill-loading-tool, background-process-tools (2 tools) -- all equally exposed, all use plain `Type.Object` with no `additionalProperties: false`.

## Resolution: REVERTED (coordinator ruling, 2026-08-07)

Full mechanical revert of `strict: 'prefer'` from all 19 occurrences, rather than a partial `additionalProperties: false` patch: OpenAI-strict mode has more requirements than that single one (every property must be listed in `required`, with optionals expressed as nullable unions, at every nesting level including union arms like web-fetch's filter schema) -- patching one requirement risks trading a visible local error for the next validator complaint, and per-provider-family validation minutiae are unverifiable while live model testing is banned. Reverting restores known-good pre-AGENT-240 behavior; strict-mode adoption was an enhancement, not load-bearing functionality.

Changes: removed the `constrainedSampling: { type: 'json_schema', strict: 'prefer' }` field (and its explanatory comment) from all 9 tool definitions across tattler/index.ts, chorus.ts, shell-relay's inspect-pane.ts and start-relay.ts, web-fetch/src/index.ts, web-search/src/index.ts, skill-loading-tool.ts, and background-process-tools.ts (both tools). Removed the paired "No constrainedSampling: zero parameters" explanatory comments from list_peers, tattler_receive, and the `done` tool. Deleted three test files that existed solely to assert the now-removed field (shell-relay's inspect-pane.test.ts, start-relay.test.ts; web-search's index.test.ts). Removed the constrainedSampling-only test cases from chorus.test.ts, tattler/index.test.ts, background-process-tools.test.ts, and web-fetch/src/index.test.ts, while explicitly preserving the tests in those files that assert unrelated behavior (web-fetch's union-arm-preservation regression test for #7328, skill-loading-tool's registration/prompt-guidance test minus its trailing constrainedSampling assertion). Removed now-orphaned `constrainedSampling` type fields from three test helper types (chorus.test.ts's RegisteredTool, tattler/index.test.ts's inline tool type plus its now-unused `tools` tracking array in fakePi(), and extensions/system/test-helpers.ts's CapturedTool).

Verification: `bun check` clean (0 errors/warnings, 319 files vs 322 pre-revert, matching the 3 deleted files). Full `bun run test`: 114 files / 1079 tests, all pass (down from 117/1086 pre-revert, matching exactly the 3 deleted files and 7 removed constrainedSampling-only test cases). Grepped repo-wide for `strict: 'prefer'`/`constrainedSampling` post-revert: zero remaining occurrences outside `dist/` (generated, not source).

AGENT-240's task record annotated with this outcome and a pointer here.

Re-adoption path: AGENT-255 (depends on AGENT-252's mock provider) -- re-adopt with fully strict-valid schema emission, verified headlessly via a scriptable OpenAI-strict validator in the mock provider. Upstream ask (prefer's capability-only gate contradicts its documented "transparent fallback" promise -- it degrades cleanly on unsupported models but ships broken requests on supported ones) recorded there for Doug's pile.

---

CORRECTION (2026-08-07, Doug): the "upstream ask" framing on strict:'prefer' recorded here and in AGENT-254 is WITHDRAWN - it rested on a misreading by the coordinator, not on pi's actual contract.

Pi documents prefer as: "uses provider-side strict schema enforcement when supported and otherwise falls back to normal tool calling." The fallback condition is PROVIDER CAPABILITY, not schema validity, and the implementation matches that exactly (resolveJsonSchemaStrictSampling: supported -> strict:true, unsupported -> normal, unsupported+require -> throw). prefer is a capability switch, not a safety net. The coordinator read "prefer" as connoting "try, and back off if there is trouble" and built an upstream-bug case on that connotation rather than on the documented behavior.

Correct attribution: AGENT-240 was OUR bug. We opted 9 tools into provider-side strict enforcement without meeting strict mode's schema requirements (additionalProperties:false at every object level, every property in required with optionality expressed as nullable unions). Pi did what it said it would do.

Residual, recorded as a DX observation and explicitly NOT an upstream ask (per the AGENTS.md rule against ticketing upstream wishes): strict mode's schema requirements are not stated where the flag is documented, and violating them surfaces as a provider-side request rejection at turn time rather than a registration-time error. Sharp edge, not a defect. No action.

This does not change this task's work: re-adoption still requires emitting strict-valid schemas and verifying them headlessly, which is exactly what the mock-provider gate is for.

---

# Activity Log

## 2026-08-07T15:11:03.594Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → sandpiper-0.84-dev

## 2026-08-07T15:21:32.246Z

- **description**: 9 lines → updated (31 lines)

## 2026-08-07T15:21:59.919Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-08-07T15:27:20.534Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-08-07T22:10:06.337Z

- **description**: 31 lines → updated (43 lines)
