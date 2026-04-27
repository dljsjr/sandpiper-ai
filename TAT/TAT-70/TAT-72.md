---
title: "C2: Audience snapshot at append (Tattler layer)"
status: IN PROGRESS
kind: SUBTASK
priority: HIGH
assignee: "Piper"
reporter: AGENT
created_at: 2026-05-27T15:45:26.253Z
depends_on:
  - TAT-71
updated_at: 2026-05-27T20:34:46.140Z
---

# C2: Audience snapshot at append (Tattler layer)

Audience snapshot design doc written at .sandpiper/docs/specs/tat-72-audience-snapshot-design.md. Denormalized JSON array of agentId+handle at append time. Consumes TAT-50 broker stamp, fallback to broker.participants() if TAT-50 not yet landed. Implementation: extract participant list at ChorusRoomPostV0 receipt, transform to snapshot format, pass to appendMessage().

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
