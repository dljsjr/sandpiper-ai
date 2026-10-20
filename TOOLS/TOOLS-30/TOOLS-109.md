---
title: "Remove the DuckDuckGo search adapter"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-11-10T23:39:42.625Z
updated_at: 2026-11-11T21:49:42.161Z
related:
  - TOOLS-92
  - TOOLS-108
---

# Remove the DuckDuckGo search adapter

## Corrected hermetic full gate passed (2026-11-11)

With the approved mwqvznwo smoke guard inherited, independent frozen install, zero-warning check and unfiltered full suite passed: 71 files/562 tests. Actual offline/read-only packed CLI checks included. Exact command: bun run test --maxWorkers 1 --no-file-parallelism. No timeout changes or retries. Status NEEDS REVIEW, not accepted. Logs: /var/folders/zj/49vt4cds6l15fs_1frdvz89r0000gn/T/sandpiper-tools121-independent.7rb1rlik/05-uwwxxmml/.

## Full verification passed (2026-11-11)

uwwxxmml: independent frozen install, zero-warning bun check, and full `bun run test --maxWorkers 1 --no-file-parallelism` passed: 71 files / 562 tests. No filters, exclusions or timeout changes; real offline/read-only packed CLI checks included. Fresh start load was below8. Independent code review found no outstanding actionable findings. Status is NEEDS REVIEW, not user-accepted COMPLETE. Logs: /tmp/sandpiper-gate-last-seven-full.ARdI8S/uwwxxmml/. Earlier implementation checkpoints below preceded this full gate.

## Per-commit regression correction (2026-11-11)

Parent reproduced rootProductMetadata failure in the intermediate109 commit: web-search no longer declares jsdom but its exact expectation still did. Removed only that stale extension expectation, retaining root runtime-jsdom coverage. Focused regression changed from1fail to1pass/8skipped and bun check passed. Folded into uwwxxmml (c37cc725). Rebased descendants; final sntvwxtp implementation tree is byte-identical to the previously reviewed bfcd98c4 tree. Logs: /tmp/sandpiper-sol-review.GL7plD/109-{red,green,fix-check}.log.

## Independent check checkpoint (2026-11-11)

Parent/gate independently passed frozen install and the revision-specific bun check with zero errors/warnings. All ten tasks are implemented and independently reviewed with no outstanding actionable findings. Full/per-commit full-test gates remain pending quiet load; no completion or acceptance is claimed.

## Implementation checkpoint (2026-11-11)

Change uwwxxmml removes DDG, fixture/test, extension-only jsdom declarations and shared unused timeout/signal options. SCOUT moved unchanged to .sandpiper/archive/web-search-ddg-scout-2026-06.md (not previously moved by115). Worker passed 39 focused tests, frozen install and clean check. Independent review found no actionable issue. Full/per-commit quiet-machine gates are pending.

Status remains IN PROGRESS. This checkpoint is not verified completion or user acceptance.

## Decision

Doug approved removing the DuckDuckGo search adapter on 2026-11-10 (TOOLS-92 review, inventory row B-1). Not started.

## Facts

- extensions/web-search/src/ddg-adapter.ts (185 lines), its test (218), its fixture (76) and the research note extensions/web-search/SCOUT.md (138).
- Adapter selection is injected adapter, then Brave, then Parallel. Nothing injects an adapter, so this one cannot be selected.
- It is the only jsdom importer in web-search. extensions/web-search/package.json declares jsdom and @types/jsdom only for it. web-fetch and the root keep their own jsdom.

## Scope

- Delete the adapter, its test and its fixture. Move SCOUT.md to .sandpiper/archive/ (inventory row C-12).
- Remove jsdom and @types/jsdom from extensions/web-search/package.json and update bun.lock.
- Finish inventory row A-21: with this adapter gone, nothing reads SearchAdapterOptions.timeoutMs or .signal. TOOLS-108 already removed their handling from the Brave and Parallel adapters. Remove the two options from the shared type.
- Correct extensions/web-search/README.md where it says the adapter remains available, and its file layout.

---

# Activity Log

## 2026-11-11T17:03:39.951Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-11T17:32:18.131Z

- **description**: 16 lines → updated (22 lines)

## 2026-11-11T17:58:20.250Z

- **description**: 22 lines → updated (26 lines)

## 2026-11-11T18:07:53.772Z

- **description**: 26 lines → updated (30 lines)

## 2026-11-11T18:14:48.373Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-11T18:15:17.342Z

- **description**: 30 lines → updated (34 lines)

## 2026-11-11T19:21:12.552Z

- **description**: 34 lines → updated (38 lines)

## 2026-11-11T21:49:42.162Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
