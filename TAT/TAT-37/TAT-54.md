---
title: "Source-verify queued custom-message abort loss"
status: NOT STARTED
kind: SUBTASK
priority: HIGH
assignee: "Huginn"
reporter: USER
created_at: 2026-05-25T19:12:27.178Z
updated_at: 2026-05-25T19:12:57.013Z
---

# Source-verify queued custom-message abort loss

Document and/or test the current failure mode: sendCustomMessage while streaming queues a role=custom object directly into core steer/followUp queues, not AgentSession's mirrored string queues; Escape/abort clearQueue can therefore drop it before message_start/end persistence. Distinguish this from already-persisted custom_message entries that are on the active branch/context.

---

# Activity Log

## 2026-05-25T19:12:57.014Z

- **assignee**: UNASSIGNED → Huginn
