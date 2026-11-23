---
title: "Remove ast-grep"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-11-11T15:54:45.887Z
updated_at: 2026-11-23T22:05:39.264Z
related:
  - TOOLS-92
---

# Remove ast-grep

## Full gate passed (2026-11-11)

wvpsuuxu / 7fba4a71: 65 files, 535 tests passed in 83s after TOOLS-126 removed the smoke file that had stopped this gate. Each ran in a fresh isolated checkout: frozen install, clean bun check, then bun run test --maxWorkers 1 --no-file-parallelism with no filters, retries or timeout changes; source tree clean afterwards.

## Final corrected queue checkpoint (2026-11-11)

Corrected reference and seven implementation units passed full gates; the ninth run stopped at TOOLS-113 with three different existing5-second source-entrypoint smoke timeouts. The guarded runtime-import case did not fail. No retry, new source change or cause attribution followed. TOOLS-122 records the new blocker. Consolidation and two Markdown unit full gates and without-bunfig probe remain unattempted. All agents/processes are stopped and checkouts removed.

## Verification stopped at TOOLS-116 (2026-11-11)

All ten approved implementations are committed and independently reviewed. Six tasks passed full per-commit gates and are NEEDS REVIEW. This task remains IN PROGRESS, not accepted. TOOLS-112 full gate hit the runtime-Pi-import smoke timeout at load below5. Controlled comparison passed that case on112 but reproduced it on the already-full-gated110 predecessor at load2.83. Relevant source/dependencies are identical; root cause is unknown, not a proven112 regression. No source or timeout was changed for the failure.113/111/114 full gates remain unattempted. TOOLS-116 holds exact evidence and is NOT STARTED pending Doug's go for broader diagnosis. Work is at rest.

## Independent check checkpoint (2026-11-11)

Parent/gate independently passed frozen install and the revision-specific bun check with zero errors/warnings. All ten tasks are implemented and independently reviewed with no outstanding actionable findings. Full/per-commit full-test gates remain pending quiet load; no completion or acceptance is claimed.

## Implementation checkpoint (2026-11-11)

Change wvpsuuxu removes ast-grep tree/config/script and its Knip binary ignore, without changing Biome rules. Worker clean check and live-reference sweep passed; independent review found no actionable issue. Tests/full per-commit gates remain deferred under severe machine load, not waived.

Status remains IN PROGRESS. This checkpoint is not verified completion or user acceptance.

## Decision

Doug decided on 2026-11-10 (TOOLS-92 review, inventory row B-5): remove ast-grep from the repository. Do not turn on Biome's noConsole or noEmptyBlockStatements as part of this. Not started.

## Facts

- 16 files under ast-grep/ (README, 6 rules, 6 queries, 3 transforms), sgconfig.yml, and the check:ast-grep script. Not in the bun check gate. The binary comes from Homebrew; no manifest or mise.toml declares it.
- Three rules repeat Biome rules that are already on and report nothing. The other three reported 22 findings on 2026-11-10 that nobody acts on: 11 console calls, 9 comment-only catch blocks, 2 process.exit calls.
- The queries and transforms are reference snippets named only in ast-grep/README.md.

## Scope

- Delete ast-grep/ and sgconfig.yml. Remove the check:ast-grep script.
- Remove the mentions in README.md (the directory tree and the command list), .sandpiper/playbooks/development/typescript-and-tests.md, and the ast-grep entry in knip.jsonc ignoreBinaries.

---

# Activity Log

## 2026-11-11T17:03:40.447Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-11T17:32:19.291Z

- **description**: 14 lines → updated (20 lines)

## 2026-11-11T17:58:20.677Z

- **description**: 20 lines → updated (24 lines)

## 2026-11-11T18:20:23.042Z

- **description**: 24 lines → updated (28 lines)

## 2026-11-11T19:21:13.482Z

- **description**: 28 lines → updated (32 lines)

## 2026-11-11T21:09:12.565Z

- **description**: 32 lines → updated (36 lines)

## 2026-11-11T21:09:13.388Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-11T21:49:42.443Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:05:39.264Z

- **description**: updated
