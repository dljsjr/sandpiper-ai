---
title: "Add Chorus participant audience metadata to room messages"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: "Huginn"
reporter: USER
created_at: 2026-05-25T19:05:32.074Z
related:
  - TAT-36
updated_at: 2026-07-11T16:53:29.590Z
---

# Add Chorus participant audience metadata to room messages

Add broker-owned participant/audience metadata to Chorus room messages so receiving agents know who can see a reply.

The broker owns this metadata because it owns room membership/fanout. send_chorus_reply and other agent-facing tools should not require agents to populate participant lists.

Acceptance criteria:
- Canonical broker room posts include a best-effort participant snapshot at fanout time.
- Model-visible Chorus content includes a concise participant/audience list.
- Structured details include participants for renderers/batch entries.
- Batch rendering preserves per-message audience details.
- Tests cover local, remote, and backwards-compatible messages without participant metadata.
- Documentation/prompt wording makes clear this is a snapshot, not a stable identity/read-receipt protocol.

---

# Activity Log

## 2026-05-25T19:05:32.170Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT
- **description**: added (1 line)

## 2026-05-25T19:11:48.022Z

- **related**: (none) → TAT-36

## 2026-05-25T19:12:47.239Z

- **assignee**: AGENT → Huginn
- **description**: 1 line → updated (11 lines)

## 2026-07-01T02:51:09.444Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-07-11T16:53:29.590Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
