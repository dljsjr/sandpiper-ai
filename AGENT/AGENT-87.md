---
title: "Split Sandpiper identity from neutral capabilities"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-04-27T18:20:53.126Z
updated_at: 2026-05-01T18:47:29.502Z
depends_on:
  - AGENT-86
related:
  - AGENT-84
---

# Split Sandpiper identity from neutral capabilities

Split current Sandpiper identity behavior from neutral capability extensions.\n\nSee .sandpiper/docs/specs/package-first-multi-distribution.md.\n\nCompletion signal:\n- Sandpiper-only behavior (identity/system prompt/startup/update/migration/env mirroring) lives in a Sandpiper identity adapter/package\n- neutral capability extension set can load in vanilla Pi without Sandpiper identity/system prompt changes\n- tests cover both identity-present and neutral modes

---

# Activity Log

## 2026-04-27T18:22:09.131Z

- **description**: added (1 line)

## 2026-05-01T17:34:24.815Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-05-01T17:46:13.808Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-01T18:47:29.503Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
