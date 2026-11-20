---
title: "Tattler startup can take over a live peer's socket or identity file"
status: NEEDS REVIEW
kind: BUG
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-11-20T15:27:07.638Z
updated_at: 2026-11-20T15:47:21.805Z
---

# Tattler startup can take over a live peer's socket or identity file

From the 2026-11-20 claude-tattler comparison (candidates 2, 4, 7; its 4e, 4f): (1) startup unlinks a socket that does not answer in 300 ms; only a refused connection proves it dead. (2) startup unlinks an existing <name>.id whatever its owner, and tmp removes it on exit, so the first of two sessions with one name loses its identity file; names that sanitize to the same or an empty stem collide too. claude-tattler keeps a name a live peer holds and falls back to the default name. (3) the identity write is stat/unlink/write; write a temp file and rename.

Outcome (xzvkksvz): startup reuses its socket path only on a refused connection; a name whose identity file names another live socket stays with that session (fallback session:<shortId>, warning, chosen name stays stored); names sanitizing to nothing are not used; identity file written via temp file + rename and removed at shutdown/exit only while it names our socket; tmp dependency removed. bun check clean, 93 files/883 tests, dist rebuilt.

---

# Activity Log

## 2026-11-20T15:37:12.336Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-20T15:47:21.805Z

- **status**: IN PROGRESS → NEEDS REVIEW
- **description**: 1 line → updated (3 lines)
