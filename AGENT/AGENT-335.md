---
title: "Background process exit notification fires twice when the command cannot start"
status: COMPLETE
resolution: DONE
kind: BUG
priority: LOW
assignee: AGENT
reporter: AGENT
created_at: 2026-11-17T22:50:12.699Z
updated_at: 2026-11-18T21:02:57.863Z
---

# Background process exit notification fires twice when the command cannot start

`ManagedProcess._start()` in `packages/core/src/process-manager.ts` runs the exit handlers from both the child's `error` event, with code 1, and its `close` event. When the command cannot start, for example a missing executable, the child emits both, so the handlers run twice: first with code 1, then with -2 for ENOENT. `start_background_process` registers its exit notification as an exit handler, so the model gets two exit notifications for one process, and `check_background_process` reports the second exit code (-2), not the 1 that the first notification claimed.

Found while updating `.sandpiper/docs/specs/background-processes.md` under AGENT-332. Measured on 2026-11-17 under Bun and under Node (`--experimental-strip-types`): `new ProcessManager().spawn({ id: 'x', command: 'definitely-not-a-command-xyz' })` with one `onExit` handler recorded the calls `[[1,null],[-2,null]]`, a final `exitCode` of -2, and stderr `spawn error: ...`.

Expected: one exit per process, with one exit code. Add a regression test in `packages/core/src/process-manager.test.ts`, and update the "Double exit on spawn failure" row in `background-processes.md` when fixed.

## Outcome (upnvnkzx)

The `error` handler now only appends `spawn error: <message>` to stderr; `close` is the only place that runs the exit handlers. Node and Bun both emit `error` then `close` for a missing executable (-2), a non-executable file (-13) and a missing working directory (-2), measured on 2026-11-18.

Decision: the single exit code is the runtime's negative error number, which `close` reports and `exitCode` keeps, not the old made-up 1. A real program can exit with 1, so 1 was ambiguous.

Regression test in `process-manager.test.ts`; `background-processes.md` updated and its known-gaps row removed. `bun check` clean, full suite 91 files/837 tests, dist rebuilt. End-to-end through `ProcessManager` under Node and Bun: one exit call, `[-2, null]`.

---

# Activity Log

## 2026-11-18T20:28:01.669Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-18T20:31:03.439Z

- **description**: 5 lines → updated (13 lines)

## 2026-11-18T20:31:03.524Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-18T21:02:57.864Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
