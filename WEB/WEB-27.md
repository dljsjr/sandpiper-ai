---
title: "Stop web-fetch renderer tests depending on subprocess timing"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-11-17T18:29:55.466Z
updated_at: 2026-11-18T18:34:57.323Z
---

# Stop web-fetch renderer tests depending on subprocess timing

Four web-fetch tests failed once under heavy full-suite load: subprocesses ran past a 5 s limit the tests passed only because `runCommand` requires one.

## Plan

1. Renderer tests (`lightpanda-renderer.test.ts`, `obscura-renderer.test.ts`): pass a fake `tools.run` that records arguments and returns prepared output, instead of starting fake browser scripts. Keep the fake executable file on PATH for the "installed" check.
2. `RendererFetchAdapter`: an optional `run` dependency (default `runCommand`); its tests pass a fake and assert the arguments and the abort signal reach it.
3. `runCommand`: a named `NO_TIME_LIMIT` constant (`0`, documented as disabling the limit) for callers that want none; reject other values outside 1..2**31-1 with a clear error (`Infinity` throws `ERR_OUT_OF_RANGE` in execFile, values above 2**31-1 overflow to a 1 ms kill). The `runCommand` tests that are not about timing use `NO_TIME_LIMIT`; the time-limit and abort tests keep their short limits.

---

# Activity Log

## 2026-11-17T18:30:16.039Z

- **description**: added (7 lines)

## 2026-11-17T18:30:16.151Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-17T18:36:54.609Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-18T18:34:57.323Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
