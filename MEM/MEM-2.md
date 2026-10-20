---
title: "Spike: SQLite index — trade-offs vs human-readable TOON index"
status: COMPLETE
resolution: WONTFIX
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-23T03:18:38.806Z
updated_at: 2026-10-19T19:39:07.904Z
---

# Spike: SQLite index — trade-offs vs human-readable TOON index

Spike: evaluate using SQLite as the task index backend instead of the current TOON flat file.

Measure and compare:
- Query performance at scale (100s, 1000s of tasks)
- Index update speed (incremental vs full rebuild)
- Concurrent access safety (multiple agents/processes)
- Full-text search (FTS5 vs current ripgrep approach)
- Human readability trade-off (TOON is readable, SQLite is not)
- Dependency footprint (SQLite bindings vs zero deps)
- Portability (bun:sqlite vs better-sqlite3 vs cross-runtime)
- Migration path from current TOON index

This is an exploratory spike — the outcome should be a recommendation document, not an implementation.

---

# Activity Log

## 2026-03-23T03:19:16.411Z

- **description**: added (13 lines)

## 2026-10-19T19:39:07.904Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: WONTFIX
