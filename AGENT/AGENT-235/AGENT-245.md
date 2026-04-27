---
title: "Upstream PR: derive bash session env prefix from APP_NAME"
status: COMPLETE
resolution: WONTFIX
kind: SUBTASK
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-08-06T20:42:18.752Z
updated_at: 2026-08-07T22:05:26.064Z
---

# Upstream PR: derive bash session env prefix from APP_NAME

CLOSED WONTFIX 2026-08-07 under a new standing rule (repo AGENTS.md, Core Invariants): we do not create tasks for changes we believe upstream should make. Tasks tracking an already-filed upstream PR/issue we are blocked on remain fine; speculative upstream asks like this one do not get tickets. This task predates the rule and is the only existing instance of the pattern.

The finding itself remains valid and is preserved here as a record rather than tracked work:

pi-coding-agent's src/core/tools/bash.ts hardcodes the PI_ prefix when injecting session env into bash-tool child processes (PI_SESSION_ID, PI_SESSION_FILE, PI_PROVIDER, PI_MODEL, PI_REASONING_LEVEL, added in 0.82.0). Deriving that prefix from APP_NAME would match Pi's own established precedent - config.ts already derives ENV_AGENT_DIR/ENV_SESSION_DIR from APP_NAME, with a comment reading "e.g., PI_CODING_AGENT_DIR or TAU_CODING_AGENT_DIR" - and would give rebranded installs SANDPIPER_SESSION_ID natively instead of requiring the mirroring layer. Sandpiper's own handling is already complete and unaffected either way (AGENT-242: standup CLI accepts the PI_ names as fallbacks; session-continuity injects the SANDPIPER_ names, which bash-tool children would otherwise never receive).

Three other upstream-adjacent findings from the 0.84.0 work are likewise recorded as notes on their related tasks rather than as tickets: EntryRenderOptions/ToolRenderResultOptions lacking outputPad (AGENT-241), constrainedSampling 'prefer' gating on model capability without schema inspection while forwarding schemas verbatim (AGENT-255), and the fullscreen dock structurally starving the transcript to one row (AGENT-256). If any of these are ever actually filed upstream, a tracking task at that point is appropriate under the rule.

---

# Activity Log

## 2026-08-07T22:05:24.656Z

- **description**: 1 line → updated (7 lines)

## 2026-08-07T22:05:25.370Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-08-07T22:05:26.066Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: WONTFIX
