---
title: "Refactor shell-relay index into thin orchestrator + extracted tools/commands"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-04-01T06:05:06.895Z
updated_at: 2026-04-01T15:14:55.571Z
---

# Refactor shell-relay index into thin orchestrator + extracted tools/commands

Refactor extensions/shell-relay/src/index.ts into a thin orchestrator by extracting tool and slash-command registration modules while preserving behavior.

Scope:
- Extract start_shell_relay and inspect_pane registrations
- Extract relay-connect / relay-status / relay-cleanup command registrations
- Share duplicated setupRelay error-handling logic

Verification:
- bun check
- shell-relay test suite

---

# Activity Log

## 2026-04-01T06:05:26.574Z

- **description**: added (10 lines)

## 2026-04-01T06:07:24.499Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-04-01T06:12:32.917Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-04-01T15:14:55.571Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
