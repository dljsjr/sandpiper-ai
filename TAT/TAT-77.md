---
title: "Track 2: Standalone read-only TUI for durable message log"
status: NOT STARTED
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-05-27T15:51:55.758Z
blocked_by:
  - TAT-71
related:
  - TAT-70
updated_at: 2026-05-27T16:51:39.871Z
---

# Track 2: Standalone read-only TUI for durable message log

Standalone TUI (not coupled to Pi harness) that renders the SQLite durable message log. TypeScript, using terminal-kit for TUI rendering. Read + send capable — Doug uses this as his primary room interface. Reads room transcript and cursors from SQLite, sends messages via Tattler IPC. Hydrates room state from SQLite on startup. Not a Pi widget, not a compiled Bun binary — a separate client binary (like Trail and Standup). Parallel-ready with Track 1 once C1 schema is stable. Post-MVP: Rust + Ratatui is the long-game direction, but TS + terminal-kit ships first. Full send-capable TUI (replacing current Chorus editor UI) is in-scope, not just read-only. Decoupled from session-broker model entirely.

---

# Activity Log

## 2026-05-27T15:51:55.833Z

- **description**: added (1 line)
- **blocked_by**: (none) → TAT-71
- **related**: (none) → TAT-70

## 2026-05-27T16:51:39.873Z

- **description**: updated
