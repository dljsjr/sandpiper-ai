---
title: "Audit packages for Pi-specific extension code"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-05-19T16:36:31.114Z
updated_at: 2026-05-21T03:35:54.086Z
---

# Audit packages for Pi-specific extension code

Audit ./packages/* to ensure no code relies on Pi APIs after the extension/package split. Correct target architecture: generalized Pi-specific extension code belongs in ./extensions; the Sandpiper standalone binary distribution should pull directly from ./extensions to populate the Extension Factories passed to Pi's main; ./plugins/pi is only the Pi Package entry point for vanilla Pi via pi install and should load/re-export extensions for that packaging path. Code in ./packages must not import/depend on Pi APIs whatsoever, even as peer dependencies. Only ./extensions and ./plugins/pi may import/depend on Pi. AutoTOON is a known example to inspect: its Pi shim appears to still live in packages while plugins/pi/extensions re-exports it.

---

# Activity Log

## 2026-05-19T16:41:01.395Z

- **description**: updated

## 2026-05-21T03:35:53.972Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-05-21T03:35:54.034Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-21T03:35:54.087Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
