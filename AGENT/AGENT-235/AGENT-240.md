---
title: "Adopt constrainedSampling across custom tools"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: "sandpiper-0.84-dev"
reporter: AGENT
created_at: 2026-08-06T20:41:56.977Z
updated_at: 2026-08-07T15:21:01.930Z
depends_on:
  - AGENT-236
---

# Adopt constrainedSampling across custom tools

Adopt constrainedSampling with strict:'prefer' across 9 custom tools (19 call sites across tattler, chorus, shell-relay, web-fetch, web-search, skill-loading, background-process). The reviewer's own verification at the time proved graceful degradation on strict-UNSUPPORTED providers (resolveJsonSchemaStrictSampling returns undefined, falls through cleanly) -- that path was real and correct.

## AGENT-254 outcome (2026-08-07): REVERTED

A live grounding session (AGENT-250) surfaced a "Codex error: Invalid schema for function 'skill': ... additionalProperties is required to be supplied and to be false" failure. AGENT-254's static investigation (source-verified, not live-tested, per the pair's mock-provider-only rule) found the strict-SUPPORTED path -- the one this approval never exercised -- is broken:

- resolveJsonSchemaStrictSampling() (pi-ai's constrained-sampling.js) gates purely on the boolean supportsStrictMode capability flag; zero schema-shape inspection.
- openai-completions.js forwards tool.parameters verbatim into the strict function-calling entry with no transformation (no additionalProperties:false injection, no required/optional normalization).
- None of the 9 tools' TypeBox schemas set additionalProperties:false (confirmed by compiling one directly) -- so strict:'prefer' silently produces a strict-mode request pi-ai forwards as-is, which strict-supporting providers reject.
- Pi's own built-in tools (read/bash/edit/write/find/grep/ls) never set constrainedSampling at all, confirming they were never exposed to this failure mode -- this is why it went unnoticed until our own tools opted in.

Coordinator ruling: full revert of strict:'prefer' from all 19 occurrences (mechanical, Refs: AGENT-254) rather than a partial additionalProperties:false patch, since OpenAI-strict mode has more requirements than just that one (every property must be in `required` with optionals as nullable unions, at every nesting level) and per-family validation minutiae are unverifiable under the live-testing ban. This restores known-good pre-240 behavior; strict adoption was an enhancement, not load-bearing.

Re-adoption path: AGENT-255 (depends on AGENT-252's mock provider) -- re-adopt with fully strict-valid schema emission, verified headlessly via a scriptable OpenAI-strict validator in the mock provider, converting this exact gap into CI coverage. Upstream ask (prefer's capability-only gate contradicts its "transparent fallback" promise) recorded there for Doug.

---

# Activity Log

## 2026-08-07T00:08:52.151Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → sandpiper-0.84-dev

## 2026-08-07T00:18:15.075Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-08-07T00:18:15.139Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-08-07T15:16:36.454Z

- **description**: 3 lines → updated (7 lines)

## 2026-08-07T15:21:01.931Z

- **description**: 7 lines → updated (14 lines)
