---
title: "Disable Bun auto-install in the built-bin smoke helper"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-11-11T18:45:09.884Z
updated_at: 2026-11-11T21:49:41.686Z
---

# Disable Bun auto-install in the built-bin smoke helper

## Final corrected queue checkpoint (2026-11-11)

Corrected reference and seven implementation units passed full gates; the ninth run stopped at TOOLS-113 with three different existing5-second source-entrypoint smoke timeouts. The guarded runtime-import case did not fail. No retry, new source change or cause attribution followed. TOOLS-122 records the new blocker. Consolidation and two Markdown unit full gates and without-bunfig probe remain unattempted. Full logs: /var/folders/zj/49vt4cds6l15fs_1frdvz89r0000gn/T/sandpiper-tools121-independent.7rb1rlik; summary.json contains exact results. All agents/processes are stopped and checkouts removed.

The one-line test-only fix itself is independently verified: corrected reference69files/532tests passed, and guarded runtime-import case passed in all nine full runs. This fix is NEEDS REVIEW, not blocked by a newly attributed import defect. TOOLS-121 moved underTOOLS-30 and is blocked byTOOLS-122.

Approved test-only correction: insert Bun --no-install before the built bin path in runSandpiperBin. Preserve fixture, runtime Pi import, existing timeout and no retries. No product launcher/global config/Pi loader change. Verify focused case and full corrected reference without network-capable probes.

---

# Activity Log

## 2026-11-11T18:45:10.100Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-11T18:58:17.463Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-11T19:21:13.176Z

- **description**: 1 line → updated (7 lines)

## 2026-11-11T21:49:41.686Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
