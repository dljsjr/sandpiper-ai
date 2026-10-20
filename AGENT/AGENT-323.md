---
title: "AutoTOON rewrites read results of JSON files"
status: COMPLETE
resolution: DONE
kind: BUG
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-11-10T23:39:43.099Z
updated_at: 2026-11-11T21:36:57.258Z
related:
  - TOOLS-92
---

# AutoTOON rewrites read results of JSON files

## Corrected hermetic full gate passed (2026-11-11)

With the approved mwqvznwo smoke guard inherited, independent frozen install, zero-warning check and unfiltered full suite passed: 69 files/534 tests. Actual offline/read-only packed CLI checks included. Exact command: bun run test --maxWorkers 1 --no-file-parallelism. No timeout changes or retries. Status NEEDS REVIEW, not accepted. Logs: /var/folders/zj/49vt4cds6l15fs_1frdvz89r0000gn/T/sandpiper-tools121-independent.7rb1rlik/01-zstuyrmu/.

## Full verification passed (2026-11-11)

zstuyrmu: independent frozen install, zero-warning bun check, and full `bun run test --maxWorkers 1 --no-file-parallelism` passed: 69 files / 534 tests. No filters, exclusions or timeout changes; real offline/read-only packed CLI checks included. Fresh start load was below8. Independent code review found no outstanding actionable findings. Status is NEEDS REVIEW, not user-accepted COMPLETE. Logs: /tmp/sandpiper-gate-first-four-full.3QipCL/zstuyrmu/. Earlier implementation checkpoints below preceded this full gate.

## Independent check checkpoint (2026-11-11)

Parent/gate independently passed frozen install and the revision-specific bun check with zero errors/warnings. All ten tasks are implemented and independently reviewed with no outstanding actionable findings. Full/per-commit full-test gates remain pending quiet load; no completion or acceptance is claimed.

## Implementation checkpoint (2026-11-11)

Change zstuyrmu exempts read results without patching content or metadata. Unit and real-RPC regressions failed first and then passed; worker focused gate passed 20 tests. Other conversion surfaces remain unchanged. Independent review found no actionable issue; independent frozen install and bun check passed. Full/per-commit quiet-machine gates are pending.

Status remains IN PROGRESS. This checkpoint is not verified completion or user acceptance.

## Defect

AutoTOON rewrites every tool result that looks like JSON and is 256 to 100,000 characters long, from any tool (extensions/autotoon/autotoon.ts has no tool filter). That includes the read tool. The model then gets TOON text where it asked for a file's text.

Seen live on 2026-11-10: read of .syncpackrc.json (938 bytes) returned a result that starts with [TOON] and holds none of the file's JSON syntax. The model cannot copy exact text from such a file for the edit tool.

docs/features/autotoon.md lists read among the converted tools, so this was intended when written.

## Decision

Doug decided on 2026-11-10 (inventory row B-23): stop converting read results; keep AutoTOON for the rest.

## Notes for the fix

- Write the failing test first: a read result that holds JSON must come back unchanged.
- Decide during the fix whether other tools that return file content verbatim need the same exemption, and report them.
- Correct docs/features/autotoon.md. Related document errors are in inventory row C-14: the encoder uses commas, not tabs; the limits count characters, not bytes; the stated saving has no measurement.

---

# Activity Log

## 2026-11-11T17:03:39.629Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-11T17:32:17.040Z

- **description**: 17 lines → updated (23 lines)

## 2026-11-11T17:58:19.970Z

- **description**: 23 lines → updated (27 lines)

## 2026-11-11T18:14:48.076Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-11T18:15:16.598Z

- **description**: 27 lines → updated (31 lines)

## 2026-11-11T19:21:11.967Z

- **description**: 31 lines → updated (35 lines)

## 2026-11-11T21:36:57.263Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
