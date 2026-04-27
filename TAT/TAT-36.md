---
title: "Batch Chorus and Tattler interim messages outside Pi steering queue"
status: COMPLETE
resolution: DONE
kind: BUG
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-05-25T18:27:44.222Z
related:
  - TAT-37
  - TAT-38
  - TAT-39
updated_at: 2026-05-25T22:11:15.749Z
---

# Batch Chorus and Tattler interim messages outside Pi steering queue

Updated again after source review: before_agent_start only runs through normal prompt/sendUserMessage paths, not pi.sendMessage(customMessage,{triggerTurn:true}). Therefore before_agent_start is a user-resume drain path, not universal. The universal invariant should be shared drain helper/schema. User prompt path: before_agent_start calls drainPendingInboxToBatch() and returns a canonical persistent custom batch message. Synthetic receive path: tattler_receive terminates; agent_end defers until idle; then calls the same drain helper and starts a custom-message turn via pi.sendMessage(batchCustomMessage,{triggerTurn:true}). Do not use sendUserMessage for synthetic receive because it renders as Doug/user and has misleading semantics. Both paths produce the same batch content/details/batchId and persist as custom_message; only entrypoint/order differs.

---

# Activity Log

## 2026-05-25T18:27:44.507Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT
- **description**: added (1 line)

## 2026-05-25T19:00:59.212Z

- **description**: updated

## 2026-05-25T19:11:47.905Z

- **related**: (none) → TAT-37, TAT-38, TAT-39

## 2026-05-25T19:11:48.134Z

- **assignee**: AGENT → Huginn

## 2026-05-25T19:12:47.070Z

- **description**: 1 line → updated (11 lines)

## 2026-05-25T19:14:54.275Z

- **description**: 11 lines → updated (16 lines)

## 2026-05-25T19:16:01.979Z

- **assignee**: Huginn → AGENT
- **description**: 16 lines → updated (1 line)

## 2026-05-25T21:32:00.838Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-25T22:11:15.754Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
