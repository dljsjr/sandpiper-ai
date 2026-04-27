---
title: "Verify queued custom messages after abort are in active context"
status: COMPLETE
resolution: DONE
kind: BUG
priority: HIGH
assignee: "Huginn"
reporter: USER
created_at: 2026-05-25T18:27:44.324Z
updated_at: 2026-07-11T16:53:29.585Z
---

# Verify queued custom messages after abort are in active context

Investigate and regression-test the distinction between UI replay delay and true data/context loss for queued custom messages.

Findings to preserve:
- Already-emitted and persisted custom_message entries on the active branch should be included by buildSessionContext and convertToLlm, or represented by compaction summary after compaction.
- While streaming, sendCustomMessage queues role=custom objects directly in core steer/followUp queues. These are not mirrored in AgentSession's string queue display/restore path; abort/clearQueue can drop them before persistence.

Acceptance criteria:
- Source/test evidence documents the current loss path for undrained queued custom messages.
- Source/test evidence verifies persisted custom_message entries remain context-recoverable.
- The pending inbox fix proves abort + next prompt drains missed messages through before_agent_start.

---

# Activity Log

## 2026-05-25T18:27:44.567Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT
- **description**: added (1 line)

## 2026-05-25T19:00:59.270Z

- **description**: updated

## 2026-05-25T19:11:48.189Z

- **assignee**: AGENT → Huginn

## 2026-05-25T19:12:47.127Z

- **description**: 1 line → updated (10 lines)

## 2026-07-01T17:36:28.391Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-07-11T16:53:29.585Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
