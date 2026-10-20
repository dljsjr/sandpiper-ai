---
title: "Verify persisted custom messages remain in active context"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: "Huginn"
reporter: USER
created_at: 2026-05-25T19:12:27.264Z
updated_at: 2026-10-19T19:29:30.843Z
---

# Verify persisted custom messages remain in active context

Add or document a regression proving that once a Chorus/Tattler custom_message has emitted and persisted on the active branch, buildSessionContext and convertToLlm include it on subsequent turns or in compaction summary. If chat UI misses it after abort, classify that as UI/replay reconciliation rather than data loss.

Verified 2026-10-19 on Pi 1.3.0 / Sandpiper main, in a real interactive sandpiper instance driven through herdr (isolated agent dir; probe provider whose first request blocks until aborted; Escape pressed mid-request; then two more prompts). Live result: the tattler:pending-batch custom_message delivered on the post-abort prompt was persisted to the session JSONL and was present in the context of the following request as well. Compaction-summary case not tested.

---

# Activity Log

## 2026-05-25T19:12:57.067Z

- **assignee**: UNASSIGNED → Huginn

## 2026-10-19T19:13:31.281Z

- **description**: 1 line → updated (3 lines)

## 2026-10-19T19:29:30.844Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: DONE
