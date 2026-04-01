---
title: "Spike: validate jj/git worktree mechanics for task storage at .sandpiper/tasks"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-04-01T17:38:25.745Z
updated_at: 2026-04-01T17:46:33.702Z
---

# Spike: validate jj/git worktree mechanics for task storage at .sandpiper/tasks

Validate the storage mechanics described in `.sandpiper/docs/task-storage-strategy.md`.

## Goal

Determine whether we can safely store `.sandpiper/tasks/` on a separate branch in the current repo using either:
- `jj workspace add` into a subdirectory of the existing workspace, or
- `git worktree add` in a colocated jj repo

## Questions to answer

1. Can `jj workspace add` target a subdirectory of an existing workspace?
2. If not, does `git worktree add .sandpiper/tasks <branch>` work cleanly in a colocated jj repo?
3. Does the main workspace `jj st` / `jj diff` ignore files in the worktree path?
4. Can the task worktree be committed independently without confusing the main workspace?
5. What bootstrap / teardown commands are required?
6. Are there path, nested-repo, or snapshot edge cases that make the approach unsafe?

## Deliverable

- A short findings doc or section appended to the design doc with a recommendation
- If viable: exact bootstrap commands for implementation
- If not viable: rejection rationale and fallback strategy

## References

- `.sandpiper/docs/task-storage-strategy.md`
- `dist/skills/sandpiper/jj/SKILL.md`

---

# Activity Log

## 2026-04-01T17:38:25.773Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-04-01T17:38:36.098Z

- **description**: added (140 lines)

## 2026-04-01T17:39:12.101Z

- **description**: 140 lines → updated (27 lines)

## 2026-04-01T17:46:33.702Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: DONE
