---
title: "Agent commands double-wrapped by fish Enter keybind"
status: COMPLETE
resolution: DONE
kind: BUG
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-03-23T05:42:59.163Z
updated_at: 2026-03-23T05:44:26.854Z
---

# Agent commands double-wrapped by fish Enter keybind

When the agent injects a command via write-chars, the injection includes a trailing newline which triggers fish's Enter keybind override. The keybind wraps the already-wrapped `__relay_run` invocation in another `__relay_run`, causing double-wrapping. The inner wrapper captures output correctly so commands work, but it's redundant and means stdout/stderr flow through two layers of tee/FIFO piping.

Fix: The fish Enter keybind should detect when the commandline already starts with `__relay_run` (or starts with a space prefix indicating an agent-injected command) and skip wrapping — just execute directly via `commandline -f execute`.

---

# Activity Log

## 2026-03-23T05:43:06.447Z

- **description**: added (3 lines)

## 2026-03-23T05:43:44.053Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-23T05:44:26.854Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: DONE
