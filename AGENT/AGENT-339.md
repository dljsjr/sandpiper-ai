---
title: "Update Pi to 1.6.0"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-11-20T16:18:10.842Z
updated_at: 2026-11-23T21:47:17.470Z
---

# Update Pi to 1.6.0

Pi 1.6.0 released 2026-11-20. Review (in chat): local patch applies cleanly (only interactive-mode.js changed among patched files); breaking change: component render() returns readonly string[] with cached arrays, and ChorusRoomEditor.render() mutates super.render() output; siblings pi-ai, pi-tui, pi-mcp move to 1.6.0. 1.6.0 still does not export OutputAccumulator or isMcpToolName.

## Outcome (uzzwxppu)

Four pins at 1.6.0; patch reapplied and regenerated (only the interactive-mode hunk offset moved), nine modules, no .orig/.rej, no .bun-tag. ChorusRoomEditor copies super.render() per the new TUI contract (Editor still returns a fresh array, so it was not actually broken). Version expectations and Pi-version docs updated. bun check clean, 93 files/883 tests, dist rebuilt; sandpiper-system-prompt reports Pi 1.6.0 and still renders <deferred_tools>. Running sessions keep 1.5.2 until restarted.

---

# Activity Log

## 2026-11-20T16:18:27.647Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-20T16:21:25.026Z

- **status**: IN PROGRESS → NEEDS REVIEW
- **description**: 1 line → updated (5 lines)

## 2026-11-23T21:47:17.470Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: UNRESOLVED → DONE
