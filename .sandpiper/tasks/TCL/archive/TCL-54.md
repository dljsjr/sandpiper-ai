---
title: "Design task archival strategy for completed tasks"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-03-23T03:18:38.780Z
updated_at: 2026-03-24T07:24:38.028Z
---

# Design task archival strategy for completed tasks

Design a strategy for archiving completed tasks without deleting them.

Current behavior: completed tasks remain in place indefinitely, which can make project directories noisy over time.

Options to explore:
- Move completed tasks to an archive/ subdirectory within the project
- Compress/bundle completed tasks into a single archive file per project
- Age-based auto-archival (e.g., tasks completed more than N days ago)
- Manual archive command (`task archive`) with filtering
- Impact on the index, counter preservation, and cross-references
- Ability to unarchive/restore tasks

Constraint: archived tasks MUST remain accessible for historical reference and audit trail.

---

# Activity Log

## 2026-03-23T03:19:16.383Z

- **description**: added (13 lines)

## 2026-03-24T07:16:40.881Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-24T07:24:38.029Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: DONE
