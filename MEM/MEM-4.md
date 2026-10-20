---
title: "Evaluate ctx.getSystemPromptOptions() (and ctx.mode) for YAAMS"
status: COMPLETE
resolution: WONTFIX
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-06-23T20:28:30.773Z
updated_at: 2026-10-19T19:39:15.843Z
---

# Evaluate ctx.getSystemPromptOptions() (and ctx.mode) for YAAMS

Pi 0.78.1 (#5306) added ctx.getSystemPromptOptions() so extension commands can inspect the current base system-prompt inputs. ALREADY IN our 0.79.1 build. Same release added ctx.mode (distinguish TUI/RPC/JSON/print mode).

Doug flagged getSystemPromptOptions() as a candidate for YAAMS (and possibly elsewhere).

FIRST STEP (grounding): identify what YAAMS currently does that would benefit from inspecting base system-prompt inputs (e.g. memory-injection sizing/placement decisions). Spike whether getSystemPromptOptions()/ctx.mode change or simplify that logic.

Refiled 2026-10-19 to ~/.sandpiper/agent/inbox/yaams-system-prompt-options-and-mode.md at Doug's request; closed here when the MEM project was archived.

---

# Activity Log

## 2026-10-19T19:39:08.032Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: WONTFIX

## 2026-10-19T19:39:15.844Z

- **description**: 5 lines → updated (7 lines)
