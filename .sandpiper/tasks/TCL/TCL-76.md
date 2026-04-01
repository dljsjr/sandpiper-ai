---
title: "sandpiper-tasks-cli baseline test regressions in search and index command suites"
status: COMPLETE
resolution: DONE
kind: BUG
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-04-01T06:07:06.413Z
updated_at: 2026-04-01T12:29:17.663Z
---

# sandpiper-tasks-cli baseline test regressions in search and index command suites

Investigation summary:
- Re-ran previously failing suites in isolation: `search.test.ts` and `index-cmd.test.ts` (pass).
- Re-ran all tasks-cli tests: `bun test packages/sandpiper-tasks-cli/src` (pass).
- Re-ran full repo suite: `bun test` (pass).
- Stress-ran target suites 10x in a loop (all pass).

No current reproducible failure remains on this stack. Treating as resolved by intervening refactor/test-stability changes; close with documentation.

---

# Activity Log

## 2026-04-01T06:07:06.440Z

- **description**: added (5 lines)

## 2026-04-01T12:28:13.763Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-04-01T12:29:17.630Z

- **description**: 5 lines → updated (7 lines)

## 2026-04-01T12:29:17.663Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: DONE
