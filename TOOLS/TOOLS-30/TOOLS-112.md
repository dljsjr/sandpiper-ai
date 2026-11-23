---
title: "Remove the logo files, Commander guidance, standup log and test:standalone script"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-11-11T15:30:04.146Z

updated_at: 2026-11-23T22:05:39.032Z
related:
  - TOOLS-92
---

# Remove the logo files, Commander guidance, standup log and test:standalone script

## Corrected hermetic full gate passed (2026-11-11)

With the approved mwqvznwo smoke guard inherited, independent frozen install, zero-warning check and unfiltered full suite passed: 66 files/541 tests. Actual offline/read-only packed CLI checks included. Exact command: bun run test --maxWorkers 1 --no-file-parallelism. No timeout changes or retries. Status NEEDS REVIEW, not accepted.

## Verification stopped at TOOLS-116 (2026-11-11)

All ten approved implementations are committed and independently reviewed. Six tasks passed full per-commit gates and are NEEDS REVIEW. This task remains IN PROGRESS, not accepted. TOOLS-112 full gate hit the runtime-Pi-import smoke timeout at load below5. Controlled comparison passed that case on112 but reproduced it on the already-full-gated110 predecessor at load2.83. Relevant source/dependencies are identical; root cause is unknown, not a proven112 regression. No source or timeout was changed for the failure.113/111/114 full gates remain unattempted. TOOLS-116 holds exact evidence and is NOT STARTED pending Doug's go for broader diagnosis. Work is at rest.

## Independent check checkpoint (2026-11-11)

Parent/gate independently passed frozen install and the revision-specific bun check with zero errors/warnings. All ten tasks are implemented and independently reviewed with no outstanding actionable findings. Full/per-commit full-test gates remain pending quiet load; no completion or acceptance is claimed.

## Implementation checkpoint (2026-11-11)

Change rlkqszyn deletes approved logos, Commander docs/routes and standup log, and removes test:standalone. Worker clean check and static link/reference sweeps passed; independent review found no actionable issue. Tests/full per-commit gates remain deferred under severe machine load, not waived.

Status remains IN PROGRESS. This checkpoint is not verified completion or user acceptance.

## Decision

Doug decided on 2026-11-10 (TOOLS-92 review, inventory rows B-12 to B-15): remove these four leftovers. Not started.

## Scope

- B-13: delete the four logo files at the repository root: sandpiper.png, sandpiper_wordmark.png, sandpiper.asciimtn, sandpiper_wordmark.asciimtn (132 KB). No tracked file references them, and the startup header does not use them.
- B-14: delete docs/dev/cli-development.md and .sandpiper/playbooks/development/cli.md, and remove their routing rows in AGENTS.md, docs/README.md and .sandpiper/playbooks/development/index.md. Commander is in no manifest and the one CLI does not use it. The launcher rules that are still true already exist in the build playbook.
- B-15: delete .sandpiper/standup.md (43,764 bytes), the removed helper's log. Doug chose deletion over archiving. docs/features/journal.md (near line 34) and .sandpiper/playbooks/features/session-continuity.md (near line 15) tell the reader to preserve saved historical notes; correct both, because this file was what they protected. Check devtools/packedCli.test.ts for an assertion that names the file.
- B-12: remove the test:standalone script from the root package.json and its line in packages/cli/README.md. It runs nine files that the full suite already runs. Doug did not object to this row; confirm with him if in doubt.

Version control keeps the deleted files.

---

# Activity Log

## 2026-11-11T17:03:40.275Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-11T17:32:18.903Z

- **description**: 12 lines → updated (18 lines)

## 2026-11-11T17:58:20.531Z

- **description**: 18 lines → updated (22 lines)

## 2026-11-11T18:20:22.534Z

- **blocked_by**: (none) → TOOLS-116

## 2026-11-11T18:20:22.908Z

- **description**: 22 lines → updated (26 lines)

## 2026-11-11T19:17:58.795Z

- **blocked_by**: TOOLS-116 → (none)

## 2026-11-11T19:17:58.898Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-11T19:21:12.860Z

- **description**: 26 lines → updated (30 lines)

## 2026-11-11T21:49:42.371Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:05:39.032Z

- **description**: updated
