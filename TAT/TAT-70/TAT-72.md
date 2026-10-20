---
title: "C2: Audience snapshot at append (Tattler layer)"
status: NOT STARTED
kind: SUBTASK
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-05-27T15:45:26.253Z
depends_on:
  - TAT-71
updated_at: 2026-11-19T20:49:09.681Z
---

# C2: Audience snapshot at append (Tattler layer)

Audience snapshot design doc written at .sandpiper/docs/specs/tat-72-audience-snapshot-design.md. Denormalized JSON array of agentId+handle at append time. Consumes TAT-50 broker stamp, fallback to broker.participants() if TAT-50 not yet landed. Implementation: extract participant list at ChorusRoomPostV0 receipt, transform to snapshot format, pass to appendMessage().

## Note: room log migrations are not packed (2026-11-17)

From the archived TOOLS-92 retained-surface inventory (row K-11), checked against the code on 2026-11-17. `extensions/tattler/tattler-room-log.ts` reads its SQL from `new URL('./migrations', import.meta.url)`, and nothing in the runtime imports the module yet. When this task wires `appendMessage()` into the bundled extension, the module runs from root `dist/`, where no `migrations/` directory exists, and the package `files` list does not pack `extensions/tattler/migrations/`. Embed the SQL in the bundle, or pack the directory and resolve it from the product root, and cover the packed case with `devtools/packedCli.test.ts`. The log now uses `node:sqlite` (TOOLS-103), not `better-sqlite3` as TAT-71 recorded.

## Parked in backlog triage (2026-11-19)

Tattler v1, with the durable message log folded into it, is the long-term goal and not current work (Doug). Parked at LOW. Design: `.sandpiper/docs/specs/durable-rooms-sizing.md` and `tat-72-audience-snapshot-design.md`, restored on 2026-11-19 from an abandoned change. Reset from IN PROGRESS: no implementation exists beyond the design doc.

---

# Activity Log

## 2026-05-27T15:45:26.323Z

- **description**: added (1 line)

## 2026-05-27T15:46:02.234Z

- **depends_on**: (none) → TAT-71

## 2026-05-27T15:51:14.939Z

- **title**: C2: Audience snapshot at append → C2: Audience snapshot at append (Tattler layer)
- **description**: updated

## 2026-05-27T16:59:18.807Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Piper

## 2026-05-27T16:59:53.278Z

- **description**: 1 line → updated (36 lines)

## 2026-05-27T20:34:46.141Z

- **description**: 36 lines → updated (1 line)

## 2026-11-17T22:46:28.552Z

- **description**: 1 line → updated (5 lines)

## 2026-11-19T20:49:09.681Z

- **status**: IN PROGRESS → NOT STARTED
- **assignee**: Piper → UNASSIGNED
- **priority**: HIGH → LOW
- **description**: 5 lines → updated (9 lines)
