---
title: "Format Markdown once and add a Prettier check to the gate"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-11-11T15:54:46.048Z
updated_at: 2026-11-23T22:05:39.527Z
related:
  - TOOLS-92
  - TOOLS-112
---

# Format Markdown once and add a Prettier check to the gate

## Full gates passed (2026-11-11)

zuylmqmn / d89f88e6 (formatting): 65 files, 535 tests passed in 114s. sntvwxtp / b28ec60f (Prettier check in the gate): 65 files, 535 tests passed in 98s. Each ran in a fresh isolated checkout: frozen install, clean bun check, then bun run test --maxWorkers 1 --no-file-parallelism with no filters, retries or timeout changes; source tree clean afterwards.

## Final corrected queue checkpoint (2026-11-11)

Corrected reference and seven implementation units passed full gates; the ninth run stopped at TOOLS-113 with three different existing5-second source-entrypoint smoke timeouts. The guarded runtime-import case did not fail. No retry, new source change or cause attribution followed. TOOLS-122 records the new blocker. Consolidation and two Markdown unit full gates and without-bunfig probe remain unattempted. All agents/processes are stopped and checkouts removed.

## Verification stopped at TOOLS-116 (2026-11-11)

All ten approved implementations are committed and independently reviewed. Six tasks passed full per-commit gates and are NEEDS REVIEW. This task remains IN PROGRESS, not accepted. TOOLS-112 full gate hit the runtime-Pi-import smoke timeout at load below5. Controlled comparison passed that case on112 but reproduced it on the already-full-gated110 predecessor at load2.83. Relevant source/dependencies are identical; root cause is unknown, not a proven112 regression. No source or timeout was changed for the failure.113/111/114 full gates remain unattempted. TOOLS-116 holds exact evidence and is NOT STARTED pending Doug's go for broader diagnosis. Work is at rest.

## Implementation and independent check checkpoint (2026-11-11)

Changes zuylmqmn (format-only) and sntvwxtp (Prettier dependency/gate) implement the full recorded scope. Exact Prettier3.10.0 pin; lock adds only3lines. Independent revision-byte review proves all18 Markdown changes equal formatter(original), all54 selected files are clean, and all75 excluded tracked files are unchanged. Worker fixtures prove hidden guidance is checked and18 ignored areas stay unchanged. Parent independently passed frozen installs, bun check (zero errors/warnings) and the focused metadata regression for both units. Full/heavy and per-unit full-test gates remain pending; status stays IN PROGRESS, not accepted.

## Decision

Doug decided on 2026-11-10 (TOOLS-92 review, inventory row B-16): format the tracked Markdown once and add a Prettier check to the bun check gate. Do it after the Batch C archive moves and the TOOLS-112 deletions, so that files about to move or go are not reformatted first. Not started.

## Facts

- Nothing checks Markdown today. On 2026-11-10, 25 of the 76 tracked Markdown files outside .sandpiper/archive were not Prettier-clean. 13 of those are deleted by TOOLS-112 or archived by Batch C. One is .sandpiper/journal.md, which the Journal tool writes.
- Prettier is not a dependency. Agents run it through bunx. Biome does not handle Markdown in this repository.
- Without a check, an agent that formats a file it edits produces unrelated table changes.

## Scope

- Add Prettier as an exact-version development dependency and a check script for Markdown. Add the script to bun check.
- Exclude .sandpiper/archive/, .sandpiper/journal.md and the task workspace.
- Format the remaining files in one commit that changes nothing else.
- Update the Verification section of AGENTS.md, CONTRIBUTING.md and .sandpiper/playbooks/development/typescript-and-tests.md, which define the gate.

---

# Activity Log

## 2026-11-11T17:43:08.580Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-11T17:58:19.546Z

- **description**: 16 lines → updated (20 lines)

## 2026-11-11T18:20:23.306Z

- **description**: 20 lines → updated (24 lines)

## 2026-11-11T19:21:13.787Z

- **description**: 24 lines → updated (28 lines)

## 2026-11-11T21:09:12.975Z

- **description**: 28 lines → updated (32 lines)

## 2026-11-11T21:09:13.524Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-11T21:49:42.513Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:05:39.527Z

- **description**: updated
