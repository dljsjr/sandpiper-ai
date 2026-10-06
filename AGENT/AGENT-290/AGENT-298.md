---
title: "AutoTOON: skip nested tool calls and preserve structuredContent"
status: NOT STARTED
kind: SUBTASK
priority: HIGH
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-10-06T02:57:59.557Z
updated_at: 2026-10-06T02:57:59.557Z
depends_on:
  - AGENT-293
---

# AutoTOON: skip nested tool calls and preserve structuredContent

extensions/autotoon/autotoon.ts rewrites JSON text in every non-error tool_result. In Pi 1.0, codemode scripts' nested calls (event.parentToolCallId set) also emit tool_result, and replacing content without returning structuredContent drops the structured result. Skip nested calls and return event.structuredContent alongside converted content. Add tests for both.
