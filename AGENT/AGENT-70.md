---
title: "Add stop/kill tool to background process tooling"
status: COMPLETE
resolution: DONE
kind: TASK
priority: LOW
assignee: AGENT
reporter: AGENT
created_at: 2026-04-21T19:07:12.108Z
updated_at: 2026-11-19T20:14:37.153Z
---

# Add stop/kill tool to background process tooling

Current background process tooling (start_background_process, check_background_process) has no way to terminate a running process from the agent side. This means processes like long-running matrix evaluations or dev servers can only be killed externally (e.g., via shell commands like `kill`). A `stop_background_process` tool that cleanly terminates by ID would solve the inability to manage process lifetime within the agent harness.

## Outcome

Decided with Doug (2026-11-19): three tools, not one tool with an action enum (a top-level union is not portable across providers, and separate schemas keep their own required fields); `stop_background_process` is deferred; a deliberate stop sends no exit notification.

`stop_background_process(id, signal?)` sends SIGTERM (or SIGINT/SIGKILL) and waits up to 5 s; the result reports the exit, a still-running process (suggesting SIGKILL), an already exited process, or an unknown id (error). Waiting lives in `stopBackgroundProcess()` in `packages/core/src/background-process-capability.ts`. Docs: background-processes.md (new tool section, exit notification, lifecycle, known gaps), sandpiper-system-prompt.md deferred tools table.

Checks: bun check clean, 91 files/861 tests, dist rebuilt. Isolated RPC E2E: start, tool_search, stop, one settled run, no background_process notification, stop listed as deferred in the first request.

---

# Activity Log

## 2026-04-21T19:07:16.076Z

- **description**: added (1 line)

## 2026-06-03T04:43:52.492Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Huginn

## 2026-06-03T04:44:12.556Z

- **status**: IN PROGRESS → NOT STARTED
- **assignee**: Huginn → UNASSIGNED

## 2026-11-19T19:46:33.693Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-19T19:50:00.170Z

- **status**: IN PROGRESS → NEEDS REVIEW
- **description**: 1 line → updated (9 lines)

## 2026-11-19T20:14:37.153Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: UNRESOLVED → DONE
