---
title: "Configuration UX"
status: NOT STARTED
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-20T23:00:00Z
---

# Configuration UX

Implement interactive configuration for the relay extension.

**Acceptance criteria:**
- `/relay-config` command to select or create target session/pane
- Persist configuration across pi sessions via `pi.appendEntry()`
- Auto-detect Zellij via `$ZELLIJ_SESSION_NAME` environment variable

**References:** Work Plan Phase 4.1
