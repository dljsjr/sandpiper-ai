---
title: "Add Tattler receive cooperative interruption tool"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-05-25T19:00:59.110Z
depends_on:
  - TAT-36
updated_at: 2026-05-25T21:31:55.719Z
---

# Add Tattler receive cooperative interruption tool

Updated synthetic receive design: do not use pi.sendUserMessage to trigger receive because it always renders as a user/Doug message and is semantically misleading. Use pi.sendMessage(batchCustomMessage,{triggerTurn:true}) after idle instead. Source says sendCustomMessage(triggerTurn:true) calls _runAgentPrompt(appMessage), emits/persists the role custom prompt as custom_message, and convertToLlm sends custom content as user-role content to the provider. tattler_receive should set a receive-after-agent-end flag and terminate:true; agent_end idle-defers, then calls shared drainPendingInboxToBatch() and pi.sendMessage(batch,{triggerTurn:true}). before_agent_start remains the user-resume drain path, not the synthetic receive path.

---

# Activity Log

## 2026-05-25T19:00:59.328Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT
- **description**: added (1 line)

## 2026-05-25T19:11:47.965Z

- **depends_on**: (none) → TAT-36

## 2026-05-25T19:12:47.184Z

- **assignee**: AGENT → Huginn
- **description**: 1 line → updated (11 lines)

## 2026-05-25T19:16:02.072Z

- **assignee**: Huginn → AGENT
- **description**: 11 lines → updated (1 line)

## 2026-05-25T21:31:55.659Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-25T21:31:55.719Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
