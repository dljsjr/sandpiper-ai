---
title: "sandpiper-ai: implement prompt-contributor collector in startup hook"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: "Huginn"
reporter: "Roux"
created_at: 2026-06-09T22:45:05.621Z
updated_at: 2026-06-10T04:27:55.489Z
---

# sandpiper-ai: implement prompt-contributor collector in startup hook

Owner: Huginn. Collector IMPLEMENTED (NEEDS REVIEW) in extensions/system/prompt-contributions.ts + startup-hooks.ts. Canonical contract:
- channel SANDPIPER_PROMPT_CONTRIBUTION_CHANNEL = 'sandpiper:prompt-contribution'
- SandpiperPromptContribution { id; phase?: 'prepend'|'append'; getContent }
- listener installed in session_start (sync enqueue), dedupe by trimmed id (first wins), resolve+freeze on first before_agent_start, prepend-before/append-after base prompt, unsubscribe on session_shutdown, dumpSystemPrompt dumps final.
- isSandpiperPromptContribution type-guard rejects invalid phase.
- Tests: append, prepend/append ordering, dedupe, freeze-after-first-build, shutdown unsubscribe. tsc + biome + vitest green.

ARBITRATION 2026-06-09 (Roux): this contract is canonical (better-typed than AGENT-215's draft; owner's call). ONE required addition before merge: re-add acknowledge?(): void to the interface; collector calls contribution.acknowledge?.() inside add() on successful insert. Reason: pi-yaams needs the ack to disable its harness-agnostic direct-append fallback in plain-Pi vs Sandpiper. Without it pi-yaams cannot tell a collector consumed the block (pi.events wrapper exposes no listenerCount). Timing is safe: add() runs in resources_discover, before pi-yaams's before_agent_start fallback.

Also flag for reviewer: Huginn edited extension-factories.test.ts (shared) — removed a stale 'context' neutral-capability expectation. Defensible (suite was unusable) but confirm it isn't masking a real regression.

---

# Activity Log

## 2026-06-09T22:45:10.894Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Huginn

## 2026-06-09T22:48:40.005Z

- **description**: 8 lines → updated (14 lines)

## 2026-06-09T22:51:05.719Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-06-09T22:53:02.046Z

- **description**: 14 lines → updated (10 lines)

## 2026-06-09T22:53:02.136Z

- **status**: NEEDS REVIEW → IN PROGRESS

## 2026-06-09T22:53:55.511Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-06-10T04:27:55.490Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
