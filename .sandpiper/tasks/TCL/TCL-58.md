---
title: "Pi TUI integration for task board"
status: NOT STARTED
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-23T03:18:38.896Z
depends_on:
  - TCL-57
updated_at: 2026-03-23T03:19:16.492Z
---

# Pi TUI integration for task board

Implement a Pi TUI component for the task board using Pi's custom UI API (`ctx.ui.custom()`).

This should provide:
- Interactive board view within the Pi TUI
- Keyboard navigation between lanes and cards
- Quick actions (pickup, complete, update status) via keybindings
- Filtering controls
- Integration with the tasks CLI for mutations

Depends on the board data model from TCL-57.
Requires understanding of Pi's TUI component API (`docs/tui.md`).

---

# Activity Log

## 2026-03-23T03:19:16.492Z

- **description**: added (11 lines)
- **depends_on**: (none) → TCL-57
