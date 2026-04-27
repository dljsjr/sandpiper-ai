---
title: "Replace diagnostics banner chat-container reach-in with entry renderers"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-08-06T20:41:56.829Z
updated_at: 2026-08-06T23:12:50.006Z
---

# Replace diagnostics banner chat-container reach-in with entry renderers

extensions/system/chat-container.ts reaches into tui.children[1] via a register-grab-unregister setWidget trick in diagnostics-hooks.ts to make startup diagnostics/update banners flow with the chat. Fragile against fullscreen TUI mode (0.84.0) where the transcript becomes an independently scrollable region. Replace with pi.appendEntry + pi.registerEntryRenderer (display-only transcript entries, available since 0.80.4 - no bump required). Delete chat-container.ts when done. Same mechanism as AGENT-226; consider doing them together.

---

# Activity Log

## 2026-08-06T23:12:49.938Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-08-06T23:12:50.006Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
