---
title: "Independently rerun the corrected reference and implementation gates"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-11-11T18:45:09.987Z
blocked_by:
  - TOOLS-122
updated_at: 2026-11-11T21:49:51.343Z
---

# Independently rerun the corrected reference and implementation gates

## Remaining gates completed (2026-11-11)

After TOOLS-126 removed the smoke file, the four unattempted or failed unit gates passed (TOOLS-113, TOOLS-111 and both TOOLS-114 units), plus the new unit twvrvxws and the without-bunfig probe. Results are in TOOLS-126 and TOOLS-111. The seven units gated earlier were not rerun.

## Final corrected queue checkpoint (2026-11-11)

Corrected reference and seven implementation units passed full gates; the ninth run stopped at TOOLS-113 with three different existing5-second source-entrypoint smoke timeouts. The guarded runtime-import case did not fail. No retry, new source change or cause attribution followed. TOOLS-122 records the new blocker. Consolidation and two Markdown unit full gates and without-bunfig probe remain unattempted. Full logs: /var/folders/zj/49vt4cds6l15fs_1frdvz89r0000gn/T/sandpiper-tools121-independent.7rb1rlik; summary.json contains exact results. All agents/processes are stopped and checkouts removed.

## Updated verification policy (2026-11-11)

Corrected reference mwqvznwo passed all69 files/532 tests. Parent retired the old load<8 launch heuristic: it did not prevent the original network-dependent failure at load2.83, and the corrected full suite passed while load rose to40. Record load as data, not a gate. Preserve one worker, no file parallelism, every test/assertion and existing timeout; no filters or blind retries. Stop on any actual check/test failure. This changes scheduling only, not pass criteria. Remaining unit gates continue serially.

After test-only fix, verify corrected reference plus every implementation unit with frozen install, zero-warning check and full suite, one worker/no file parallelism, no filters/timeouts changes. Fresh load below8; no original unsafe smoke runs. Include actual offline/read-only packing and record all results.

---

# Activity Log

## 2026-11-11T18:45:10.197Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-11T18:58:17.793Z

- **description**: 1 line → updated (5 lines)

## 2026-11-11T19:17:58.537Z

- **parent**: TOOLS-116 → TOOLS-30

## 2026-11-11T19:17:58.620Z

- **blocked_by**: (none) → TOOLS-122

## 2026-11-11T19:21:13.331Z

- **description**: 5 lines → updated (9 lines)

## 2026-11-11T21:09:13.178Z

- **description**: 9 lines → updated (13 lines)

## 2026-11-11T21:49:51.282Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-11T21:49:51.344Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
