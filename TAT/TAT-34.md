---
title: "Decouple Chorus visual rendering from model-visible message injection"
status: COMPLETE
resolution: DONE
kind: BUG
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-05-25T14:56:05.439Z
related:
  - TAT-36
  - TAT-39
updated_at: 2026-07-11T16:53:29.579Z
---

# Decouple Chorus visual rendering from model-visible message injection

Problem: main Pi chat rendering of Chorus messages is coupled to custom-message/session injection. While an agent is streaming or hung, pi.sendMessage(customType chorus-room-message) queues through agent steer/followUp, so the main chat transcript does not render until the message drains into the session transcript. Current product read: the active Chorus widget should be the live room surface for MVP; main chat can be transcript/context/history/backfill. Existing APIs do not provide immediate main-chat display-only entries; appendEntry is extension-private state, and renderResult only applies to local tool rows. No-upstream plan: use Chorus widget as authoritative live display plane; use hidden custom_message model/context injection later; fallback to display:true sendMessage only when no widget/live bridge is available.

---

# Activity Log

## 2026-05-25T14:56:15.968Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT
- **description**: added (1 line)

## 2026-05-25T18:27:44.392Z

- **description**: updated

## 2026-05-25T19:11:48.078Z

- **related**: (none) → TAT-36, TAT-39

## 2026-07-01T14:35:38.104Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-07-11T16:53:29.579Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
