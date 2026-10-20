---
title: "Remove resolveEnvVar and read PI_OFFLINE directly for the update check"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: "prompt-trim"
reporter: USER
created_at: 2026-11-09T22:57:46.443Z
updated_at: 2026-11-10T15:48:33.231Z
related:
  - TOOLS-92
---

# Remove resolveEnvVar and read PI_OFFLINE directly for the update check

## History squashed (2026-11-10)

Doug asked for one commit per atomic unit of work. The commit ids listed under "Delivered" below are superseded. Current commits, by jj change id (stable across rewrites) with the commit id at the time of writing:

- vxyqxsuw (b78465b3) fix: Read PI_OFFLINE directly and remove resolveEnvVar; 85 files / 739 tests

Source and tests at the new tip are identical to the tree that was gated before the squash. Each commit was then gated on its own in an isolated workspace: bun check clean and bun run test passing with the counts shown.

## Delivered, awaiting review (2026-11-09)

Agent prompt-trim delivered three commits from its isolated jj workspace. They sit on the main working line above be2b28a3. The main bookmark is unchanged and root dist was not rebuilt.

- 35437ac7 fix: Skip the update check whenever Pi is offline
- bf275ec4 refactor: Remove resolveEnvVar
- 5f3c7d30 docs: Describe environment reads without resolveEnvVar

Red run before the fix: with SANDPIPER_OFFLINE=true and PI_OFFLINE=1 the new test failed with "expected true to be false", which is the stale-value defect.

Verification by the agent and repeated by the coordinator in the agent's workspace: bun check clean; bun run test 85 files / 739 tests pass (745 + 3 new - 9 from the deleted env.test.ts). No source file still imports the helper.

The migration call site keeps both reads inline with no behavior change. The public doc statement about --offline and PI_OFFLINE=true was checked against Pi's main.js by the coordinator.

Left as is: the Testing section of docs/dev/env-vars.md still shows a direct PI_OFFLINE read as its example of a test that depends on the real environment.

## Decision

Doug approved on 2026-11-09, during the TOOLS-92 review: remove resolveEnvVar, and have the update check read PI_OFFLINE directly. Inventory row K-14d in .sandpiper/docs/specs/retained-surface-inventory.md.

## Why

Both entrypoints mirror PI_* and SANDPIPER_* before any extension loads, so the helper's two-name lookup is redundant in a running Sandpiper. The one later change is made by Pi: with --offline, or with PI_OFFLINE=true or yes, Pi's main sets PI_OFFLINE=1 after mirroring. The helper reads SANDPIPER_OFFLINE first, so it can return a stale value and let the update check call npm while Pi is offline. PI_OFFLINE is the name Pi sets and honors.

## Scope

1. packages/core/src/system-diagnostics.ts: decide shouldCheckForUpdates from PI_OFFLINE. Add a regression test for the stale SANDPIPER_OFFLINE case, red first.
2. packages/core/src/migrate-pi-configs.ts: inline the two reads at the one remaining call site, with no behavior change. The migration feature itself is inventory row B-2 and is not decided.
3. Delete packages/core/src/env.ts and env.test.ts, and the index export.
4. Update docs/dev/env-vars.md and .sandpiper/playbooks/development/env-vars.md, which tell contributors to always use the helper.

## Out of scope

Environment mirroring in packages/cli/standalone_bootstrap.ts (K-13, kept). The dead __PI_CODING_AGENT_DIR_ORIGINAL branch (A-4). The migration feature (B-2).

---

# Activity Log

## 2026-11-09T22:57:46.537Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → prompt-trim

## 2026-11-09T23:00:54.300Z

- **description**: 18 lines → updated (34 lines)

## 2026-11-09T23:00:54.366Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-10T15:20:25.182Z

- **description**: 34 lines → updated (42 lines)

## 2026-11-10T15:20:59.139Z

- **description**: updated

## 2026-11-10T15:48:33.232Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
