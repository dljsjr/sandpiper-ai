---
title: "Design general quiet completion tool for no-assistant-message turns"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-05-24T17:57:19.129Z
updated_at: 2026-07-11T16:53:29.577Z
---

# Design general quiet completion tool for no-assistant-message turns

Explore a generic system-owned quiet completion/noop/done tool for turns where the agent has already completed the requested action via another tool and should not emit natural-language assistant chatter. Must be very narrowly guided so agents do not ignore substantive requests. Current finding: terminate:true is the only enforceable loop knob today but is too blunt when placed on send_chorus_reply; a dedicated tool may work only if its semantics fit the agent-loop batching rules, otherwise this likely needs a harness feature for scoped post-tool continuation suppression.

---

# Activity Log

## 2026-05-24T17:57:29.425Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Librarian

## 2026-05-24T17:57:51.653Z

- **description**: added (1 line)

## 2026-05-25T13:59:17.371Z

- **status**: IN PROGRESS → NEEDS REVIEW
- **assignee**: Librarian → AGENT

## 2026-07-11T16:53:29.577Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
