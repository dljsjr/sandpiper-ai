---
title: "Implement tattler_receive cooperative interruption tool"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: "Huginn"
reporter: USER
created_at: 2026-05-25T19:12:00.288Z
depends_on:
  - TAT-40
  - TAT-41
  - TAT-42
  - TAT-58
updated_at: 2026-05-25T21:23:39.685Z
---

# Implement tattler_receive cooperative interruption tool

Implemented in jj change nnuynvtq / cfab0afb. Adds tattler_receive tool with sequential execution, call-alone guidance, hidden call/result renderers, provider-safe content, and terminate:true. Calling it records a receive request for agent_end rather than delivering messages during tool execution. Focused test covers terminate behavior and no immediate send while current turn is active.

---

# Activity Log

## 2026-05-25T19:12:56.681Z

- **assignee**: UNASSIGNED → Huginn

## 2026-05-25T19:17:28.301Z

- **depends_on**: (none) → TAT-40, TAT-41, TAT-42, TAT-58

## 2026-05-25T20:16:28.568Z

- **description**: updated

## 2026-05-25T20:16:28.686Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-05-25T21:23:39.686Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
