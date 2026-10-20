---
title: "Delete the redundant standalone CLI smoke tests"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-11-11T20:54:39.469Z
updated_at: 2026-11-11T21:49:42.026Z
---

# Delete the redundant standalone CLI smoke tests

## Full gates passed (2026-11-11)

Each ran in a fresh isolated checkout: frozen install, clean bun check, then bun run test --maxWorkers 1 --no-file-parallelism with no filters, retries or timeout changes; source tree clean afterwards. Logs: /tmp/sandpiper-tools126.aXQgrZ/gates (summary.tsv).

- twvrvxws / 1d74e04b: 68 files, 526 tests, 65s
- wvpsuuxu / 7fba4a71 (TOOLS-113): 65 files, 535 tests, 83s
- oykttyqt / 1b33b8ff (TOOLS-111): 65 files, 535 tests, 77s
- zuylmqmn / d89f88e6 (TOOLS-114, formatting): 65 files, 535 tests, 114s
- sntvwxtp / b28ec60f (TOOLS-114, gate): 65 files, 535 tests, 98s

Load ranged from 5 to 28 during the runs. The seven units gated earlier were not rerun; they differ from their gated commits by this change only.

Doug decided on design grounds, not as a timing remedy: packages/cli/standalone_cli_smoke.test.ts spawned six CLI processes whose assertions devtools/packedCli.test.ts already makes against the installed tarball (--version, --help flag, runtime Pi import), or that test Pi rather than Sandpiper (list reads settings). Accepted loss: the source entrypoint (bun run sandpiper-dev) has no startup test.

## Implemented (2026-11-11)

Change twvrvxws / 1d74e04b, inserted directly after mwqvznwo so every simplification unit is gated without the file. It deletes the smoke file and replaces the packed test's toContain check on the existing --help output with: exactly one line starts with the Sandpiper flag. No new spawn. A passing run proves one matching line, since zero or two would fail.

Rebase effects: one conflict, in wtvvzmpy (it renamed the asserted flag to --identity in both files); resolved to the deleted file and the exactly-once form with --identity. Each rebased unit differs from its former commit by these two files only (checked zstuyrmu through zuylmqmn and the tip). New implementation tip sntvwxtp / b28ec60f; former 6924a9da.

Verified at twvrvxws in an isolated checkout: frozen install, bun check clean, build, focused packedCli.test.ts 2/2 passed in 30.16s. Full per-commit gates are recorded under /tmp/sandpiper-tools126.aXQgrZ/gates.

---

# Activity Log

## 2026-11-11T20:54:42.205Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-11T20:58:11.395Z

- **description**: 1 line → updated (9 lines)

## 2026-11-11T21:09:12.143Z

- **description**: 9 lines → updated (21 lines)

## 2026-11-11T21:09:13.251Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-11T21:49:42.027Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
