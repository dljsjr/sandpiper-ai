---
title: "Use exported parseArgs/Args for extension self-arg-parsing instead of main CLI arg parsing"
status: COMPLETE
resolution: WONTFIX
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: USER
created_at: 2026-06-23T20:28:29.611Z
updated_at: 2026-11-19T18:58:29.576Z
---

# Use exported parseArgs/Args for extension self-arg-parsing instead of main CLI arg parsing

Pi 0.78.0 (#5202) exported parseArgs + type Args for extension authors so extensions can parse their own args. ALREADY IN our 0.79.1 build.

FIRST STEP (grounding): grep Sandpiper extensions for hand-rolled arg parsing / reliance on main CLI arg parsing. Where found, evaluate switching to the exported parseArgs. Priority LOW pending whether we actually hand-roll anywhere.

## Closed in backlog triage (2026-11-19)

Nothing in Sandpiper parses its own arguments: extensions use pi.getFlag and the CLI already calls parseArgs.

---

# Activity Log

## 2026-11-19T18:58:29.479Z

- **description**: 3 lines → updated (7 lines)

## 2026-11-19T18:58:29.576Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: UNRESOLVED → WONTFIX
