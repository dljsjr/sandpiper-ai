---
title: "Implement external repo bootstrap with jj/git clone semantics"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-04-01T18:02:15.231Z
updated_at: 2026-04-01T18:54:08.200Z
---

# Implement external repo bootstrap with jj/git clone semantics

Phase 3 subtask.

Implement external-repo bootstrap using repo-appropriate clone semantics.

## Required behavior

- jj-managed current repo → `jj git clone --colocate`
- plain git current repo → `git clone`
- external repos are plain clones, never workspaces/worktrees

## Parent

- TCL-88

---

# Activity Log

## 2026-04-01T18:04:23.106Z

- **description**: added (13 lines)

## 2026-04-01T18:51:36.955Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-04-01T18:54:08.200Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: DONE
