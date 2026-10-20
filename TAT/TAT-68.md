---
title: "Pending inbox re-delivers already-handled messages after abort+resume"
status: COMPLETE
resolution: WONTFIX
kind: BUG
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-05-27T03:12:35.504Z

related:
  - TAT-73
  - TAT-70
updated_at: 2026-11-19T21:18:18.092Z
---

# Pending inbox re-delivers already-handled messages after abort+resume

Pending inbox re-delivers already-handled messages after abort+resume. Observed by Doug: on a long multi-turn session, a user-originated abort followed by a new user prompt dumps already-handled Tattler/Chorus messages back into context, and the agent reports it already processed them.

**Root cause:** The pending-inbox read position (cursor) is not durably advanced through the abort+resume cycle. The restore path (tattler-inbox-persistence.ts:restoreTattlerPendingInboxFromSession) reconstructs the inbox from session JSONL entries — it finds the latest snapshot and filters out messages whose keys appear in delivered custom_message entries. But if abort occurs between message delivery and markBatchDelivered(), the in-flight messages are not recorded as delivered in the session JSONL. On resume, before_agent_start re-drains an inbox it already drained.

**Reproduction scenario:**
1. Agent receives multiple Tattler/Chorus messages across turns
2. Agent processes them (messages move to handedToTurn state, visible in agent context)
3. User aborts the agent mid-turn (after delivery but before markBatchDelivered completes)
4. Session resumes via a new user prompt
5. before_agent_start fires, restoreTattlerPendingInboxFromSession reconstructs the inbox from JSONL
6. The abort-epoch messages are not in the delivered set (markBatchDelivered never ran), so they re-enter the inbox
7. Agent re-receives already-handled messages and reports déjà vu

**Fix locus:** Durable-rooms v1 slice — per-agent cursor in a SQLite cursors table, advanced on tool-call SUCCESS (atomicity boundary), so delivered-but-uncommitted messages re-deliver on resume (correct) while committed messages never re-deliver (kills the bug). See TAT-73.

Distinct from TAT-64/TAT-65 (render-delay) and TAT-37 (message loss on abort). TAT-68 is over-delivery on abort+resume; TAT-37 is under-delivery.

## Kept in backlog triage (2026-11-19)

The durable log (TAT-73) was meant to fix this, but v1 is long-term. Next: check whether it still reproduces after abort and resume; if it does, fix it in the current pending inbox (`tattler-inbox-persistence.ts`).

## Reproduction attempt (2026-11-19): does not reproduce

Isolated RPC session (`entry: 'sandpiper'`, isolated `XDG_RUNTIME_DIR`), the test process acting as a Tattler peer. Two agent messages arrive during a `bash sleep 3` tool call (queued, not delivered: correct); the next prompt delivers them as one batch; that run is aborted during a `bash sleep 5` tool call; a third prompt follows. Result: the batch appears once in each later request (history only), never re-delivered. Same result with `new_session` + `switch_session` back between the abort and the third prompt (the `session_start` restore path): the session holds two `tattler:pending-inbox` snapshots and one `tattler:pending-batch` custom message, and the restore filters the delivered messages out.

Why the recorded scenario does not happen now: `markBatchDelivered()` runs on the batch's `message_end`, which Pi emits when the run starts, before any mid-turn abort can land. A batch whose `message_end` never fires is released at `agent_end` and re-delivered, which is correct because the model never saw it.

Candidate for the original May sighting, unconfirmed: the old `tattler_receive` path, an `agent_end` + 25 ms `isIdle()` poll that `vowplvzt` replaced with `agent_settled`.

## Closed (2026-11-19)

Cannot reproduce on current code; Doug has no recent sighting. Reopen with the triggering steps if it recurs.

---

# Activity Log

## 2026-05-27T03:13:12.177Z

- **related**: (none) → TAT-37, TAT-58, TAT-64

## 2026-05-27T15:46:02.519Z

- **related**: TAT-37, TAT-58, TAT-64 → TAT-73, TAT-70

## 2026-05-27T16:41:46.824Z

- **description**: 1 line → updated (16 lines)

## 2026-11-19T20:49:11.204Z

- **description**: 16 lines → updated (20 lines)

## 2026-11-19T21:05:13.054Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-19T21:08:26.173Z

- **description**: 20 lines → updated (28 lines)

## 2026-11-19T21:18:17.939Z

- **description**: 28 lines → updated (32 lines)

## 2026-11-19T21:18:18.092Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: UNRESOLVED → WONTFIX
