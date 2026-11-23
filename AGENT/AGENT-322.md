---
title: "Context-usage notes reach the model with escaped tags"
status: COMPLETE
resolution: DONE
kind: BUG
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-11-10T23:39:42.912Z
updated_at: 2026-11-23T22:05:36.533Z
related:
  - TOOLS-92
---

# Context-usage notes reach the model with escaped tags

## Corrected hermetic full gate passed (2026-11-11)

With the approved mwqvznwo smoke guard inherited, independent frozen install, zero-warning check and unfiltered full suite passed: 71 files/568 tests. Actual offline/read-only packed CLI checks included. Exact command: bun run test --maxWorkers 1 --no-file-parallelism. No timeout changes or retries. Status NEEDS REVIEW, not accepted.

## Full verification passed (2026-11-11)

mrrwutsk: independent frozen install, zero-warning bun check, and full `bun run test --maxWorkers 1 --no-file-parallelism` passed: 71 files / 568 tests. No filters, exclusions or timeout changes; real offline/read-only packed CLI checks included. Fresh start load was below8. Independent code review found no outstanding actionable findings. Status is NEEDS REVIEW, not user-accepted COMPLETE. Earlier implementation checkpoints below preceded this full gate.

## Independent check checkpoint (2026-11-11)

Parent/gate independently passed frozen install and the revision-specific bun check with zero errors/warnings. All ten tasks are implemented and independently reviewed with no outstanding actionable findings. Full/per-commit full-test gates remain pending quiet load; no completion or acceptance is claimed.

## Implementation checkpoint (2026-11-11)

Change mrrwutsk removes nested notification markup and resets the 10% counter after successful compaction. Worker reproduced both markup failures and compaction reset failure, then passed 28 focused tests. Session-change claim was refuted against Pi lifecycle: factories are recreated. Independent review found no actionable issue. Full/per-commit quiet-machine gates are pending.

Status remains IN PROGRESS. This checkpoint is not verified completion or user acceptance.

## Defect

extensions/system/context-management.ts sends the model hidden context-usage notes. The 50% and 80% notes wrap their text in <info> and <important> tags and pass it as the notification's instructions. formatSystemNotification escapes instruction text (packages/core/src/system-notification.ts), so the model receives the tags as text:

    <instructions>&lt;info&gt;Context usage is above 50%.&lt;/info&gt;</instructions>

Seen live in the TOOLS-92 review session on 2026-11-10.

## Second claim, not yet verified

From code reading by an audit agent: the counter for the 10% steps (nextContextMessageThreshold) only rises. It does not reset after compaction or a session change, so after a compaction no further contextUsage data is sent until usage passes the old peak. The 50% and 80% flags do reset. Reproduce this before changing it.

## Decision

Doug decided on 2026-11-10 to keep the notifier and fix it (inventory row B-19).

## Notes for the fix

- The module has no test of its behavior. Write tests first: one that fails on the escaped tags, one that reproduces or refutes the reset claim.
- The fix must not stop the formatter from escaping other instruction text.

---

# Activity Log

## 2026-11-11T17:03:39.478Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-11T17:32:16.617Z

- **description**: 20 lines → updated (26 lines)

## 2026-11-11T17:58:19.827Z

- **description**: 26 lines → updated (30 lines)

## 2026-11-11T18:14:48.225Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-11T18:15:17.028Z

- **description**: 30 lines → updated (34 lines)

## 2026-11-11T19:21:12.268Z

- **description**: 34 lines → updated (38 lines)

## 2026-11-11T21:54:01.501Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:05:36.533Z

- **description**: updated
