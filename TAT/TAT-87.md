---
title: "Tattler startup can take over a live peer's socket or identity file"
status: NOT STARTED
kind: BUG
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-11-20T15:27:07.638Z
updated_at: 2026-11-20T15:27:07.638Z
---

# Tattler startup can take over a live peer's socket or identity file

From the 2026-11-20 claude-tattler comparison (candidates 2, 4, 7; its 4e, 4f): (1) startup unlinks a socket that does not answer in 300 ms; only a refused connection proves it dead. (2) startup unlinks an existing <name>.id whatever its owner, and tmp removes it on exit, so the first of two sessions with one name loses its identity file; names that sanitize to the same or an empty stem collide too. claude-tattler keeps a name a live peer holds and falls back to the default name. (3) the identity write is stat/unlink/write; write a temp file and rename.
