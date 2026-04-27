---
title: "Make mutating task/project update commands require a key or explicit filter"
status: COMPLETE
resolution: DONE
kind: BUG
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-03-30T20:47:48.695Z
updated_at: 2026-05-12T21:13:12.550Z
---

# Make mutating task/project update commands require a key or explicit filter

The sandpiper-tasks CLI currently allows dangerous broad mutations when a mutating subcommand omits both a specific target key and any explicit filter/query. Example: running `task update --status 'NOT STARTED'` without a task key or filter appears to update all tasks across all projects. That is surprising and too dangerous for a command that mutates existing task-management data. Fix the CLI so mutating commands that operate on existing tasks or existing projects (for example update-style commands) fail with an error unless the invocation includes either: (1) a specific key / target identifier, or (2) an explicit filter/query that clearly scopes the mutation. Review other mutating commands for similar unsafe defaults and tighten them consistently. This should likely be treated as a bug because the current behavior can silently damage task state.

---

# Activity Log

## 2026-03-30T20:47:48.738Z

- **description**: added (1 line)

## 2026-05-12T14:49:30.628Z

- **status**: NOT STARTED → IN PROGRESS

## 2026-05-12T19:58:26.129Z

- **status**: IN PROGRESS → NOT STARTED

## 2026-05-12T20:10:28.676Z

- **status**: NOT STARTED → IN PROGRESS

## 2026-05-12T20:11:55.708Z

- **assignee**: UNASSIGNED → AGENT

## 2026-05-12T20:20:41.378Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-12T21:13:12.550Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
