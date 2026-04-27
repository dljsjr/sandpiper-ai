---
title: "Brainstorm Chorus reply storm and context growth controls"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-05-24T17:57:19.192Z
updated_at: 2026-07-11T16:53:29.577Z
---

# Brainstorm Chorus reply storm and context growth controls

Brainstorm controls for Chorus reply storms/context growth. Problem: model-visible room messages prompt every participant to reply, which is semantically okay but burns context very fast. Initial direction: do not suppress at transport layer for MVP; define participation norms and explicit addressing. Agents should reply only when addressed, when they own a lane, when they have new information, or when silence would block progress. Consider lightweight conventions like @Piper, @Scout, @all, topic/turn ownership, and later message metadata such as audience/replyRequested if norms are insufficient.

---

# Activity Log

## 2026-05-24T17:57:29.482Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-05-24T17:57:51.709Z

- **description**: added (1 line)

## 2026-05-25T13:59:17.432Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-07-11T16:53:29.577Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
