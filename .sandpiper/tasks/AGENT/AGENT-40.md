---
title: "Deduplicate parseTaskIndex flush logic in startup-context"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-04-01T06:05:06.955Z
updated_at: 2026-04-01T15:14:55.374Z
---

# Deduplicate parseTaskIndex flush logic in startup-context

Remove duplicated task object construction in packages/core/src/startup-context.ts parseTaskIndex by introducing a shared flush helper and reusing it at loop boundaries.

Verification:
- startup-context tests
- bun check

---

# Activity Log

## 2026-04-01T06:05:26.636Z

- **description**: added (5 lines)

## 2026-04-01T06:17:40.985Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-04-01T06:18:30.818Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-04-01T15:14:55.374Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
