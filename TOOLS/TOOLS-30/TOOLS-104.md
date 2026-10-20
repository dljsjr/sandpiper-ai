---
title: "Trim the core system-prompt modules: fast-xml-parser, VCS detection, identity typos"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: "prompt-trim"
reporter: USER
created_at: 2026-11-09T22:37:52.756Z
updated_at: 2026-11-10T15:48:33.133Z
related:
  - TOOLS-92
---

# Trim the core system-prompt modules: fast-xml-parser, VCS detection, identity typos

## History squashed (2026-11-10)

Doug asked for one commit per atomic unit of work. The commit ids listed under "Delivered" below are superseded. Current commits, by jj change id (stable across rewrites) with the commit id at the time of writing:

- onwqxmtt (eaf4a1bd) refactor: Build system prompt XML without fast-xml-parser; 86 files / 746 tests
- kprmruvt (489ea43f) fix: Correct two typos in the built-in identity prompt; 86 / 746
- pkrqssox (b61efc42) refactor: Detect only jj and git for the system prompt; 86 / 745

Source and tests at the new tip are identical to the tree that was gated before the squash. Each commit was then gated on its own in an isolated workspace: bun check clean and bun run test passing with the counts shown.

## Delivered, awaiting review (2026-11-09)

Agent prompt-trim (Sonnet 5.5, high) delivered four commits from an isolated jj workspace. They now sit on the main working line above 69da93b2. The main bookmark is unchanged. Root dist was not rebuilt, so the running harness still uses the old build.

- 1fcd7f0b test: Pin the exact system prompt XML output (75 exact-equality tests, written against the unchanged implementation)
- ac8f0b99 refactor: Build system prompt XML without fast-xml-parser (test file untouched; dependency and eight lockfile packages removed)
- 444bd8e2 fix: Correct two typos in the built-in identity prompt
- 5c445107 refactor: Detect only jj and git for the system prompt

Verification by the agent: baseline 86 files / 671 tests; final 86 files / 745 tests; bun check clean; 20,000 random inputs through old and new block functions, 0 mismatches; built dist contains no fast-xml code; dist JavaScript 507,551 to 428,100 bytes.

Verification repeated by the coordinator in the agent's workspace: bun check clean; bun run test 86 files / 745 tests pass. Separate differential run of the old and new builders on real inputs (7 real files as context, 9 real skills, the real USER.md): 27 cases, 0 mismatches.

Reproduced on purpose: the old builder escaped only quotes in attributes, never escaped text, and switched to a multi-line layout when a body contained a less-than sign. The pinned tests record this.

Accepted behavior change: the prompt dump file ends with the prompt as built instead of a re-indented copy.

Open: none for this task. Noted for later: the dumpSystemPrompt path writes to the home directory and has no test (B-9 is undecided).

## Decision

Doug approved three changes to the core system-prompt modules on 2026-11-09, during the TOOLS-92 review. Inventory rows K-14c, K-14e and K-14f in .sandpiper/docs/specs/retained-surface-inventory.md.

## Scope

1. K-14c: replace fast-xml-parser in packages/core/src/system-prompt.ts with template code. The prompt text must stay byte-identical. Pin the current output with characterization tests first. Remove the dependency from packages/core/package.json and bun.lock. The prompt dump file loses its re-indented XML tail, because that tail is the only XMLParser use; the per-block dump stays.
2. K-14f: fix two typos in the built-in identity text: "an export coder" and "test cases are assertions are for".
3. K-14e: detect only jj and git in packages/core/src/version-control.ts. Remove Mercurial, Subversion, Fossil and Perforce detection, including the p4 info call at session start.

## Out of scope

The SANDPIPER_DUMP_SYSTEM_PROMPT decision (B-9), resolveEnvVar (K-14d), PID file removal (K-10) and the resources slot (K-12).

## Execution

One implementation agent in an isolated jj workspace, so its install, build and test runs do not touch the live checkout. Verify with bun check and bun run test in that workspace.

---

# Activity Log

## 2026-11-09T22:37:52.891Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → prompt-trim

## 2026-11-09T22:46:30.329Z

- **description**: 17 lines → updated (36 lines)

## 2026-11-09T22:46:30.397Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-10T15:20:25.059Z

- **description**: 36 lines → updated (46 lines)

## 2026-11-10T15:20:59.021Z

- **description**: updated

## 2026-11-10T15:48:33.134Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
