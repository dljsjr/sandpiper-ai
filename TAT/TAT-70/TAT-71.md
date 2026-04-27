---
title: "C1: Append-only Tattler message log + record schema"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: "Huginn"
reporter: AGENT
created_at: 2026-05-27T15:45:19.332Z
updated_at: 2026-05-27T20:31:34.770Z
---

# C1: Append-only Tattler message log + record schema

Create the SQLite message log table and the immutable append record schema at the Tattler layer. Bootstrap from current Tattler/Chorus message JSON — strip ephemeral fields (broker socket paths, batch-wrapper metadata, self flag); keep postId, roomId, from, body, timestamp; add spec-required fields. DECIDED: agentId uses the existing Tattler ID convention for MVP — no identity-layer work (birdup UUID) required before schema definition. birdup already soft-enforces persistent identity; ephemeral agents don't need durability. Schema is designed to be UUID-compatible (same column type, same FK relationship) for directory rollout later — swap key type, same foreign key shape. Snapshot display handle at post time for rendering. Migrations from day 1: simple/manual approach using a _migrations table + ordered SQL files. No migration library — just version tracking in SQLite and DDL scripts applied incrementally. Two columns for ordering: UUIDv7 as globally-stable post id; SQLite rowid seq integer as cursor range-query key (WHERE seq > :cursor). SQLite transaction serialization gives monotonic insertion order. Immutable append-only — no UPDATE/DELETE. C1 schema gates Track 2 (TUI) but not Track 3 (Chorus refactor, which is post-C6 anyway). UNBLOCKED — no identity-layer prerequisite. DECIDED: SQLite driver is better-sqlite3 (not bun:sqlite) for runtime-agnostic distribution. Bun for dev, but distributed packages must run under Node. Migration strategy: simple/manual — _migrations table + ordered SQL files, no migration library.

---

# Activity Log

## 2026-05-27T15:45:22.967Z

- **description**: added (1 line)

## 2026-05-27T15:51:09.862Z

- **title**: C1: Append-only room log + record schema → C1: Append-only Tattler message log + record schema
- **description**: updated

## 2026-05-27T15:51:52.414Z

- **description**: updated

## 2026-05-27T15:54:30.276Z

- **description**: updated

## 2026-05-27T15:57:49.970Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Huginn

## 2026-05-27T16:36:26.611Z

- **description**: updated

## 2026-05-27T16:39:37.572Z

- **description**: updated

## 2026-05-27T18:02:23.609Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-27T20:31:34.771Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
