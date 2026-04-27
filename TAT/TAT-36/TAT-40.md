---
title: "Implement Tattler pending inbox state and dedupe"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: "Huginn"
reporter: USER
created_at: 2026-05-25T19:11:37.658Z
depends_on:
  - TAT-45
  - TAT-58
updated_at: 2026-05-25T19:48:17.910Z
---

# Implement Tattler pending inbox state and dedupe

Implemented in jj changes xszoyull / 7401716b plus review fix wxqnulxl / 5874382f. Adds TattlerPendingInbox with dedupe keys, ordered snapshots, session clear/reset, and explicit lifecycle states pending -> reserved -> handedToTurn -> delivered/cleared. Busy inbound Tattler agent messages ACK at transport and queue here instead of entering Pi steer/followUp. Focused tests cover dedupe, lifecycle, mixed visibility guard, and session clear. Remaining durability/abort proof is tracked in TAT-37/TAT-44.

---

# Activity Log

## 2026-05-25T19:12:56.402Z

- **assignee**: UNASSIGNED → Huginn

## 2026-05-25T19:17:27.978Z

- **depends_on**: (none) → TAT-45, TAT-58

## 2026-05-25T19:38:32.666Z

- **description**: updated

## 2026-05-25T19:38:32.887Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-05-25T19:46:26.251Z

- **description**: updated

## 2026-05-25T19:48:17.914Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
