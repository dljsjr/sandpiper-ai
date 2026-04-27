---
title: "Design Pi display-only message API for live extension transcript entries"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-05-25T14:56:05.538Z
updated_at: 2026-07-11T16:53:29.580Z
---

# Design Pi display-only message API for live extension transcript entries

Design note: a proper Pi host API would separate display-only transcript entries from model-visible custom messages. Current docs/source: appendEntry -> appendCustomEntry, no renderer, no LLM context, no message events. sendMessage -> CustomMessageEntry, renderable and model-visible, but queues during streaming. Desired upstream shape later: sendDisplayMessage/appendDisplayMessage with stable caller key (e.g. chorus:<postId>) that renders immediately and never enters buildSessionContext, plus separate hidden custom_message/model injection. No-upstream MVP should avoid private chat-container injection unless Doug accepts maintenance risk.

---

# Activity Log

## 2026-05-25T14:56:16.037Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT
- **description**: added (1 line)

## 2026-05-25T18:27:44.451Z

- **description**: updated

## 2026-07-01T15:05:30.433Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-07-11T16:53:29.580Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
