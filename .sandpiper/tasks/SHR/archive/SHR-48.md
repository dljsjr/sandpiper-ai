---
title: "Use FIFO for dump-screen output in shell_relay_inspect tool"
status: COMPLETE
resolution: WONTFIX
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-03-23T04:32:18.462Z
updated_at: 2026-03-23T05:29:32.348Z
---

# Use FIFO for dump-screen output in shell_relay_inspect tool

WONTFIX: Using a FIFO for dump-screen output introduces deadlock risk — zellij dump-screen writes synchronously, and the FIFO reader must be attached before the writer opens. The temp file approach is simple, reliable, and the performance difference is negligible for a screen dump that happens on-demand.

---

# Activity Log

## 2026-03-23T04:32:18.501Z

- **description**: added (5 lines)

## 2026-03-23T05:29:27.728Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: WONTFIX

## 2026-03-23T05:29:32.348Z

- **description**: 5 lines → updated (1 line)
