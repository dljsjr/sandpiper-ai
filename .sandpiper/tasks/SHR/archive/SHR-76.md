---
title: "Investigate zellij action send-keys as replacement for write-chars"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-27T20:45:55.442Z
updated_at: 2026-03-28T02:21:17.614Z
---

# Investigate zellij action send-keys as replacement for write-chars

CONFIRMED in SHR-78 spike: paste + send-keys work perfectly for command injection.

Pattern: paste the command text (bracketed paste mode — fast, robust, handles multi-line),
then send-keys 'Enter' to execute. Both accept --pane-id for targeted delivery.

Replaces write-chars entirely. No shell quoting issues with special characters since
bracketed paste mode is handled by the terminal, not the shell.

---

# Activity Log

## 2026-03-27T21:22:38.417Z

- **description**: added (8 lines)

## 2026-03-28T02:21:17.571Z

- **description**: 8 lines → updated (7 lines)

## 2026-03-28T02:21:17.615Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: DONE
