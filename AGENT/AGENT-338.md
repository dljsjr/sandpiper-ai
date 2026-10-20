---
title: "Fix delivery timing of the model and context usage notifications, and rework their shape"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-11-19T21:37:10.819Z
updated_at: 2026-11-20T02:07:58.912Z
---

# Fix delivery timing of the model and context usage notifications, and rework their shape

extensions/system/context-management.ts sends model changes and context usage as hidden system notifications from turn_end with deliverAs nextTurn. Doug sees deliveries at odd times and wants the shape revisited: slimmer and more informative, for example tokens left in the window, since 80% of 500k differs from 80% of 1M.

## Findings (from this session's 9 notifications)

1. Every report waited for the next user prompt (`nextTurn`), so mid-run crossings, including the 80% alert, arrived after the run.
2. Model info arrived one run late (first report on the second prompt).
3. The 50% warning fired three times: a low reading after an aborted reply reset the flag, and a reload reset all in-memory state (re-sent model info, restarted steps).
4. Float noise: `percentUsed="30.044700000000002"`.

## Outcome (spxwptyk)

Agreed with Doug: context usage as a `turn_end` custom_message entry (verified with a probe: joins the next request mid-run, adds no request after the last response); model at `before_agent_start` compared by provider and id; last reports read from the session branch (`sandpiper:model`, `sandpiper:context-usage`, details version 1), so only a compaction re-arms; bare elements `<contextUsage percentUsed tokensLeft contextWindow/>` (whole percent, k/M tokens) and `<model provider id name/>`; 50% instruction dropped; the 80% crossing also carries the save-your-work system notification; a separate protocol bullet.

Checks: bun check clean, 91 files/865 tests, 13 prompt snapshots changed by the bullet only, dist rebuilt. Isolated RPC E2E: model element in the first request, not repeated. Docs: extensions/README.md, sandpiper-system-prompt.md.

## Follow-up: model report after compaction

Agreed with Doug: a compaction starts both reports over, since its summary may drop the last model report; the next run names the model again (about 90 characters per compaction). A compaction mid-run waits for the next run; a report kept in the compaction tail can appear twice, accepted. Squashed into spxwptyk. bun check clean, 91 files/866 tests, dist rebuilt.

---

# Activity Log

## 2026-11-19T22:30:59.426Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-19T22:34:25.422Z

- **status**: IN PROGRESS → NEEDS REVIEW
- **description**: 1 line → updated (14 lines)

## 2026-11-19T22:43:55.288Z

- **description**: 14 lines → updated (18 lines)

## 2026-11-20T02:07:58.912Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: UNRESOLVED → DONE
