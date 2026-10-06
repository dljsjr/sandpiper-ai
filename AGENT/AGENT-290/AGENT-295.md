---
title: "Implement prompt ownership and the Shape B Pi patch"
status: NOT STARTED
kind: SUBTASK
priority: HIGH
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-10-06T02:57:59.333Z
updated_at: 2026-10-06T15:49:53.307Z
depends_on:
  - AGENT-293
---

# Implement prompt ownership and the Shape B Pi patch

Implement the System prompt section of .sandpiper/docs/specs/agent-290-pi-1-0-migration-spec.md (Ownership and Synthetic runs) in extensions/system/startup-hooks.ts and packages/core.

Ownership: in before_agent_start, set systemPromptOptions.customPrompt to the rendered Sandpiper prompt, clear the inputs Sandpiper renders itself (appendSystemPrompt, contextFiles, skills), stop returning systemPrompt, and drop cwd from the environment block.

Shape B: ship a local `bun patch` of @earendil-works/pi-coding-agent (dist/core/agent-session.js, saved under patches/ with a patchedDependencies entry) so idle synthetic runs keep the prompt the transcript records and apply only tool loadout changes. before_agent_start semantics stay unchanged.

Tests first, red on stock Pi: turn the AGENT-290 discovery probes into Vitest tests against the real Sandpiper identity extension and an in-process recording provider, asserting the spec's Invariants. Cover user-prompted runs, idle synthetic runs including a second turn, a synthetic turn before the first user prompt (the documented first-turn gap), a resumed session, session.state.systemPrompt as /export renders it, byte-for-byte request prefix stability, and an extension-added section such as mcp_servers. Tests must not touch real user state.

Done when: the new tests pass, bun check is clean, and bun run test is green.

History (2026-10-06): absorbed AGENT-294, because tests are part of the implementation they verify. The earlier context_with_system guard design is superseded by Shape B; see the spec's Ownership decision note.

---

# Activity Log

## 2026-10-06T15:17:17.269Z

- **title**: Implement hybrid system prompt ownership with a context_with_system guard → Implement prompt ownership and the Shape B Pi patch

## 2026-10-06T15:17:17.402Z

- **description**: 1 line → updated (3 lines)

## 2026-10-06T15:49:53.307Z

- **description**: 3 lines → updated (11 lines)
