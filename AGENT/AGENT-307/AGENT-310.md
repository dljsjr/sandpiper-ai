---
title: "Flip the first-turn-gap prompt-ownership test"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-10-16T17:17:57.360Z
updated_at: 2026-10-19T17:27:17.956Z
---

# Flip the first-turn-gap prompt-ownership test

Renamed and flipped: "sends the Sandpiper prompt on a fresh session's synthetic first run" asserts both requests start with <system_prompt>. Red on 1.0.4 (verified in the workspace before the bump), green on stock and patched 1.3.0. Docs updated: docs/dev/build-system.md, docs/dev/prompt-contributions.md, .sandpiper/docs/specs/sandpiper-system-prompt.md; stale comment in extensions/system/startup-hooks.ts.

---

# Activity Log

## 2026-10-16T17:24:46.630Z

- **description**: added (1 line)

## 2026-10-16T17:27:41.215Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-10-19T17:27:17.957Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
