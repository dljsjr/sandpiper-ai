---
title: "Durable Tattler message log + per-agent read cursors"
status: NOT STARTED
kind: TASK
priority: HIGH
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-05-27T15:45:09.783Z

related:
  - TAT-68
  - TAT-69
  - TAT-10
  - TAT-39
  - TAT-50
  - TAT-79
updated_at: 2026-05-27T20:32:18.375Z
---

# Durable Tattler message log + per-agent read cursors

Durable append-only Tattler message log (SQLite) + per-agent read cursors that survive abort/resume. Tattler owns the pipe and the persistence; Chorus consumes. Design complete per .sandpiper/docs/specs/durable-rooms-sizing.md — all 5 load-bearing OQs resolved.

Three-track structure:
- Track 1 (serial, C1–C6): Tattler protocol layer. TAT-71 through TAT-76. Chunks 1–4 kill TAT-68.
- Track 2 (parallel-ready once C1 schema frozen): Standalone read-only TUI. TAT-77. Not coupled to Pi harness.
- Track 3 (serial, post-Track 1): Chorus refactor as consumer of Tattler primitives. TAT-78. Broker-less, session-decoupled.

Key invariants:
- Tattler owns schema, write path, cursor table
- Chorus is a consumer (refactor post-C6)
- agentId is stable UUID from identity file (birdup --init), no full Agent Directory for now
- C1 schema gates Track 2 but not Track 3

TUI overhaul (decoupling from session-broker) is captured in Track 2/3. Protocol spec docs remain protocol-only by design.

---

# Activity Log

## 2026-05-27T15:45:15.168Z

- **description**: added (1 line)
- **related**: (none) → TAT-68, TAT-69, TAT-10, TAT-39, TAT-50

## 2026-05-27T15:50:58.352Z

- **title**: Durable Chorus room log + per-agent read cursors → Durable Tattler message log + per-agent read cursors
- **description**: updated

## 2026-05-27T15:52:12.749Z

- **description**: 1 line → updated (14 lines)

## 2026-05-27T20:32:18.376Z

- **related**: TAT-68, TAT-69, TAT-10, TAT-39, TAT-50 → TAT-68, TAT-69, TAT-10, TAT-39, TAT-50, TAT-79
