---
title: "C3: Per-agent read cursor (Tattler layer) — persistence + advance-on-handle"
status: NOT STARTED
kind: SUBTASK
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-05-27T15:45:30.357Z
depends_on:
  - TAT-71
  - TAT-72

related:
  - TAT-56
  - TAT-68
updated_at: 2026-11-19T20:49:09.865Z
---

# C3: Per-agent read cursor (Tattler layer) — persistence + advance-on-handle

THIS CHUNK IS THE BUG FIX for TAT-68. Per-agent cursor in a SQLite cursors table (agentId × roomId → last_seq), at the Tattler layer — NOT Pi appendEntry/session files (the thing we're escaping). Advance the cursor on tool-call success, not on delivery — the tool-call boundary is the atomicity seam. Batch-atomic: cursor advances to last_seq of the batch only if the entire tool call succeeds; partial failure rewinds to pre-call position, so messages re-deliver on resume (correct; idempotent processing expected). Per-message advance was considered and rejected — it fixes over-delivery but creates under-delivery (partial failures silently drop already-processed messages), which is TAT-37 territory. Abort/resume is safe by construction: delivered-but-uncommitted messages re-deliver (correct); committed messages never re-deliver (kills the bug). Legacy cursor initialization: start at current HEAD, not beginning — replaying full history would dump the whole log into context. Depends on C1 (TAT-71) and C2 (TAT-72).

Acceptance criteria:
- Cursor table (agentId, roomId, last_seq) persists across abort/resume
- Cursor advances to batch last_seq only on tool-call success
- Partial tool-call failure: cursor stays at pre-call position
- New agent initialization: cursor starts at log HEAD, not seq 0
- TAT-68 re-delivery bug no longer reproduces

Acceptance (moved from TAT-56, 2026-10-19): add a real-session regression test for abort recovery: messages that arrive while a run is active accumulate in the inbox, the run is aborted (Escape path, which clears Pi's steer queue), and the next run delivers them exactly once without re-delivering on later runs. TAT-56 verified this behavior live on Pi 1.3.0; see its description for the probe setup. Cover TAT-68's re-delivery case with the same harness.

## Parked in backlog triage (2026-11-19)

Tattler v1, with the durable message log folded into it, is the long-term goal and not current work (Doug). Parked at LOW. Design: `.sandpiper/docs/specs/durable-rooms-sizing.md` and `tat-72-audience-snapshot-design.md`, restored on 2026-11-19 from an abandoned change.

---

# Activity Log

## 2026-05-27T15:45:30.440Z

- **description**: added (1 line)

## 2026-05-27T15:46:02.292Z

- **depends_on**: (none) → TAT-71, TAT-72
- **related**: (none) → TAT-68

## 2026-05-27T15:51:17.816Z

- **title**: C3: Per-agent read cursor — persistence + advance-on-handle → C3: Per-agent read cursor (Tattler layer) — persistence + advance-on-handle
- **description**: updated

## 2026-05-27T15:53:42.504Z

- **description**: 1 line → updated (8 lines)

## 2026-10-19T19:27:14.259Z

- **description**: 8 lines → updated (10 lines)

## 2026-10-19T19:29:36.769Z

- **related**: TAT-68 → TAT-56, TAT-68

## 2026-11-19T20:49:09.865Z

- **priority**: HIGH → LOW
- **description**: 10 lines → updated (14 lines)
