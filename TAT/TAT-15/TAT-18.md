---
title: "Route room posts through broker fanout"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-05-23T06:23:56.789Z
updated_at: 2026-07-11T16:53:29.556Z
---

# Route room posts through broker fanout

Change Chorus composer semantics so user messages post to the room broker first. The broker appends/renders the outbound message, fans it out to participant agent sockets, and tracks delivery status instead of the editor directly broadcasting to peers.

---

# Activity Log

## 2026-05-23T17:43:50.180Z

- **status**: NOT STARTED → NEEDS REVIEW
- **assignee**: UNASSIGNED → AGENT

## 2026-07-11T16:53:29.556Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
