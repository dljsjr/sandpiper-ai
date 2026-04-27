---
title: "Deliver v0 messages as compact system notifications"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: UNASSIGNED
reporter: USER
created_at: 2026-05-15T03:13:18.485Z
updated_at: 2026-07-11T16:53:29.543Z
---

# Deliver v0 messages as compact system notifications

Wire the v0 message receive path into Sandpiper/Pi delivery.

Scope:
- Convert incoming v0 frames to compact prose.
- Use existing Sandpiper system notifications and Pi sendMessage behavior.
- Avoid injecting raw transport envelopes or extra metadata into LLM context.

Acceptance:
- Recipient LLM sees only sender display and message text.
- Delivery uses steer + triggerTurn where appropriate.

---

# Activity Log

## 2026-05-19T18:45:48.335Z

- **status**: NOT STARTED → IN PROGRESS

## 2026-05-19T20:30:08.433Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-07-11T16:53:29.543Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
