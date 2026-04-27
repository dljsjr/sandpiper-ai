---
title: "Migrate extensions to Pi 0.65.0 event API"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-04-03T20:46:46.332Z
updated_at: 2026-04-03T20:53:47.592Z
---

# Migrate extensions to Pi 0.65.0 event API

Pi 0.65.0 removed session_switch, session_fork, and session_directory events. Migrate all extension handlers to use session_start with event.reason. Affected: shell-relay/src/index.ts, system/startup-hooks.ts, system/migration-controls.ts, and their tests.

---

# Activity Log

## 2026-04-03T20:46:50.008Z

- **description**: added (1 line)

## 2026-04-03T20:46:50.055Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-04-03T20:53:47.596Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: DONE
