---
title: "Drain pending inbox for normal prompts via before_agent_start"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: "Huginn"
reporter: USER
created_at: 2026-05-25T19:11:37.749Z
depends_on:
  - TAT-40
  - TAT-45
  - TAT-58
updated_at: 2026-05-25T19:48:17.995Z
---

# Drain pending inbox for normal prompts via before_agent_start

Implemented in jj changes xszoyull / 7401716b plus review fix wxqnulxl / 5874382f. before_agent_start drains normal user-prompt/abort-resume path through the shared pending-inbox helper, returns the custom batch message, marks messages handedToTurn, clears only after message_end for tattler:pending-batch, and releases handed batches on agent_end if no matching message_end arrives. Synthetic receive remains a separate direct-batch path for TAT-47.

---

# Activity Log

## 2026-05-25T19:12:56.464Z

- **assignee**: UNASSIGNED → Huginn

## 2026-05-25T19:14:54.364Z

- **title**: Drain pending inbox through before_agent_start → Drain pending inbox for normal prompts through before_agent_start
- **description**: updated

## 2026-05-25T19:17:28.035Z

- **depends_on**: (none) → TAT-40, TAT-45, TAT-58

## 2026-05-25T19:20:14.047Z

- **title**: Drain pending inbox for normal prompts through before_agent_start → Drain pending inbox for normal prompts via before_agent_start
- **description**: updated

## 2026-05-25T19:38:32.832Z

- **description**: updated

## 2026-05-25T19:38:32.941Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-05-25T19:46:26.340Z

- **description**: updated

## 2026-05-25T19:48:17.995Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
