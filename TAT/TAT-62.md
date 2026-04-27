---
title: "Unify idle and batched inbound message custom type"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: "Huginn"
reporter: USER
created_at: 2026-05-25T21:40:22.427Z
updated_at: 2026-05-25T21:50:33.700Z
related:
  - TAT-36
  - TAT-43
  - TAT-60
---

# Unify idle and batched inbound message custom type

Implemented in jj change sxrpyyxq / a017f56b. Unifies idle/direct inbound delivery and busy drained delivery on the canonical Tattler pending batch custom message shape. Direct idle Tattler DMs now emit a one-message tattler:pending-batch instead of a sandpiper system notification. Direct idle Chorus messages and display-only self messages now emit one-message tattler:pending-batch messages instead of chorus-room-message. Batch content remains canonical concatenated XML/text when model-visible; model-hidden self display emits the same details.messages[] shape with empty content. Tests cover busy queue unchanged, idle Chorus one-element batch, display-only self one-element batch, and idle direct Tattler one-element hidden batch.

---

# Activity Log

## 2026-05-25T21:40:50.288Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT
- **description**: updated

## 2026-05-25T21:41:02.820Z

- **assignee**: AGENT → Huginn

## 2026-05-25T21:47:20.618Z

- **description**: updated

## 2026-05-25T21:47:20.692Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-25T21:50:33.706Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
