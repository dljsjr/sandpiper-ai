---
title: "Fish Enter keybind replaces visible commandline with wrapper before executing"
status: NOT STARTED
kind: BUG
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-23T05:35:13.798Z
updated_at: 2026-03-23T05:37:52.749Z
---

# Fish Enter keybind replaces visible commandline with wrapper before executing

When the user presses Enter in fish with the relay integration sourced, the Enter keybind replaces the visible commandline text with the __relay_run wrapper + escaped command before executing. For example, typing `echo 'hello, "world"!'` and pressing Enter causes the prompt line itself to show the escaped `__relay_run '...'` invocation before the command runs. The command executes correctly, but the UX is jarring — the user's typed command visually transforms into the wrapper syntax on the prompt line.

This is distinct from the terminal title issue (FR-14) which is about what shows during execution. This is about the commandline buffer content being visibly replaced at the moment Enter is pressed.

Investigate whether we can avoid the visible replacement — e.g., by executing the wrapper without modifying the visible commandline buffer, or by saving the display text and restoring it before execute.

---

# Activity Log

## 2026-03-23T05:35:20.251Z

- **description**: added (1 line)

## 2026-03-23T05:37:52.749Z

- **description**: 1 line → updated (5 lines)
