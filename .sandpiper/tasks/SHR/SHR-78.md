---
title: "Investigate zellij action dump-screen --pane-id for targeted cross-session queries"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-03-27T20:45:55.549Z
updated_at: 2026-03-28T02:20:35.927Z
---

# Investigate zellij action dump-screen --pane-id for targeted cross-session queries

CONFIRMED: All Zellij CLI operations work against background sessions with --pane-id targeting. No ghost client required.

Verified with spike-test (no attached terminal, no ghost-attach process):
- zellij attach --create-background → creates headless session
- list-panes --json → returns pane metadata including pane_command, pane_cwd, cursor position
- paste --pane-id terminal_0 → injects text via bracketed paste mode
- send-keys --pane-id terminal_0 'Enter' → executes command
- dump-screen --pane-id terminal_0 --full → captures output
- subscribe --pane-id terminal_0 --format json → streams viewport as NDJSON

The ghost-attach expect script and tclsh dependency can be fully eliminated.

---

# Activity Log

## 2026-03-27T21:22:38.530Z

- **description**: added (5 lines)

## 2026-03-28T02:19:28.650Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-28T02:20:35.883Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: DONE

## 2026-03-28T02:20:35.928Z

- **description**: 5 lines → updated (11 lines)
