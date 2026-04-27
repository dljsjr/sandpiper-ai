---
title: "Trigger synthetic receive turn with a direct batch message"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: "Huginn"
reporter: USER
created_at: 2026-05-25T19:12:00.367Z
depends_on:
  - TAT-46
updated_at: 2026-05-25T21:23:39.773Z
---

# Trigger synthetic receive turn with a direct batch message

Implemented in jj change nnuynvtq / cfab0afb. agent_end observes tattler_receive request, defers until idle with retry timer, drains pending inbox through the shared drain helper, and starts a direct extension-authored custom batch turn via pi.sendMessage(batch, { triggerTurn: true, deliverAs: 'steer' }). The batch is marked handedToTurn and existing message_end hook clears it after persistence. No sendUserMessage/fake user prompt is used.

---

# Activity Log

## 2026-05-25T19:12:56.735Z

- **assignee**: UNASSIGNED → Huginn

## 2026-05-25T19:14:54.425Z

- **title**: Schedule synthetic receive turn safely after agent_end → Trigger synthetic receive turn with a direct batch message
- **description**: updated

## 2026-05-25T19:17:28.366Z

- **depends_on**: (none) → TAT-46

## 2026-05-25T19:20:14.117Z

- **description**: updated

## 2026-05-25T20:16:28.629Z

- **description**: updated

## 2026-05-25T20:16:28.746Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-05-25T21:23:39.774Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
