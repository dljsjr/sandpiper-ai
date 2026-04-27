---
title: "Evaluate ctx.getSystemPromptOptions() (and ctx.mode) for YAAMS"
status: NOT STARTED
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-06-23T20:28:30.773Z
updated_at: 2026-06-23T20:28:30.773Z
---

# Evaluate ctx.getSystemPromptOptions() (and ctx.mode) for YAAMS

Pi 0.78.1 (#5306) added ctx.getSystemPromptOptions() so extension commands can inspect the current base system-prompt inputs. ALREADY IN our 0.79.1 build. Same release added ctx.mode (distinguish TUI/RPC/JSON/print mode).

Doug flagged getSystemPromptOptions() as a candidate for YAAMS (and possibly elsewhere).

FIRST STEP (grounding): identify what YAAMS currently does that would benefit from inspecting base system-prompt inputs (e.g. memory-injection sizing/placement decisions). Spike whether getSystemPromptOptions()/ctx.mode change or simplify that logic.
