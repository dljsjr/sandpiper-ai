---
title: "Replace tattler-receive idle polling with agent_settled"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-08-06T20:41:56.901Z
updated_at: 2026-08-06T23:37:22.732Z
---

# Replace tattler-receive idle polling with agent_settled

extensions/tattler/tattler-receive.ts flushWhenIdle retries isIdle() on a 25ms setTimeout loop after a tattler_receive call. The agent_settled lifecycle event (0.80.4, fires when no retry/compaction/follow-up work remains) is the precise signal and is available at the current pin. Nothing in the monorepo uses agent_settled yet.

---

# Activity Log

## 2026-08-06T23:37:22.670Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-08-06T23:37:22.732Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
