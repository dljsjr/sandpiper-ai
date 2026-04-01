---
title: "Gitignore index.toon and rebuild it when missing or stale"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-04-01T18:02:14.960Z
updated_at: 2026-04-01T18:30:09.319Z
---

# Gitignore index.toon and rebuild it when missing or stale

Phase 1 subtask.

Add VCS ignore handling for `index.toon` and make commands rebuild the index automatically when it is missing or stale.

## Done when

- `index.toon` is not expected in commits
- CLI commands detect missing/stale index and rebuild it before proceeding
- operator-facing behavior is documented

## Parent

- TCL-86

---

# Activity Log

## 2026-04-01T18:04:22.816Z

- **description**: added (13 lines)

## 2026-04-01T18:18:02.405Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-04-01T18:29:50.765Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-04-01T18:30:09.319Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
