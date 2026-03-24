---
title: "expect is now a hard dependency for ghost client, not just color preservation"
status: COMPLETE
resolution: DONE
kind: TASK
priority: LOW
assignee: AGENT
reporter: AGENT
created_at: 2026-03-23T06:47:43.020Z
updated_at: 2026-03-23T07:16:42.436Z
---

# expect is now a hard dependency for ghost client, not just color preservation

The ghost-attach script uses expect to spawn a headless Zellij client, making expect/tclsh a hard dependency for Shell Relay. On macOS, expect ships with the OS (just not the full ecosystem that includes unbuffer). On Linux, it's a common package (apt install expect / yum install expect). This is a documentation task — update the README requirements section to note expect as required (not optional), and update the session_start hook diagnostic to check for it. Low risk since expect is widely available.

---

# Activity Log

## 2026-03-23T06:47:49.846Z

- **description**: added (1 line)

## 2026-03-23T06:50:15.771Z

- **description**: updated

## 2026-03-23T06:50:19.700Z

- **priority**: MEDIUM → LOW

## 2026-03-23T07:14:45.826Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-23T07:16:42.436Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: DONE
