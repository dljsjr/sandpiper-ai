---
title: "Block fish heredoc shell_relay calls via generic enforcement API"
status: NOT STARTED
kind: BUG
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-03-31T17:15:03.901Z
blocked_by:
  - AGENT-35
updated_at: 2026-03-31T19:48:31.436Z
---

# Block fish heredoc shell_relay calls via generic enforcement API

Do not implement a one-off fish heredoc guard directly in shell-relay yet.

This bug should be solved using the planned generic deterministic tool-call enforcement framework (AGENT-35), so shell-relay can register a reusable pre-execution rule instead of bespoke inline blocking logic.

Planned outcome after AGENT-35:
- Add a shell-relay pre-execution rule that detects heredoc syntax in shell_relay tool calls when the active shell is fish.
- Block execution before injection with an informative deterministic error telling the agent to rewrite the command (for example, avoid heredoc syntax in fish).
- Keep rule logic extension-level/configurable through the shared enforcement API, not hardcoded ad hoc in tool execution flow.

This task is intentionally backlogged and blocked until AGENT-35 designs and lands the reusable enforcement API.

---

# Activity Log

## 2026-03-31T17:15:03.945Z

- **description**: added (1 line)

## 2026-03-31T17:15:14.948Z

- **description**: updated

## 2026-03-31T19:48:31.440Z

- **title**: Fish __relay_run cannot execute heredoc commands → Block fish heredoc shell_relay calls via generic enforcement API
- **description**: 1 line → updated (10 lines)
- **blocked_by**: (none) → AGENT-35
