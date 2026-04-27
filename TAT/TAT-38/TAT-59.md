---
title: "Add first-arrival pending-message cue for tattler_receive"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: "Huginn"
reporter: AGENT
created_at: 2026-05-25T21:23:39.930Z
updated_at: 2026-05-25T21:31:52.025Z
depends_on:
  - TAT-46
  - TAT-47
---

# Add first-arrival pending-message cue for tattler_receive

Implemented in jj changes oxnkmvrx / 1f6c5381 plus review fix ukqlnoyk / a5dd149f. Adds best-effort first-arrival pending-inbox cue on accepted busy enqueue. Cue is deduped while the pending inbox remains non-empty, contains only count/instructions (no payload), tells the model to call tattler_receive by itself if relevant, and is not canonical delivery. Direct Tattler IPC and Chorus queue-event paths both use notifyPendingInbox(). Review fix extracts notifier and resets it after pending inbox drains via registerTattlerPendingInboxHooks onPendingInboxEmpty callback, so a later empty->non-empty burst cues again. Tests cover first busy direct Tattler enqueue nudges once across multiple pending messages and notifier reset/cue-again behavior.

---

# Activity Log

## 2026-05-25T21:25:19.276Z

- **description**: updated

## 2026-05-25T21:25:19.351Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-05-25T21:25:26.103Z

- **status**: NEEDS REVIEW → IN PROGRESS
- **assignee**: UNASSIGNED → Huginn

## 2026-05-25T21:25:35.625Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-25T21:30:59.644Z

- **description**: updated

## 2026-05-25T21:31:52.025Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
