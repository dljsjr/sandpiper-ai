---
title: "Messages that arrive mid-run wait for the next user prompt when the model ignores the cue"
status: NEEDS REVIEW
kind: BUG
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-11-20T15:27:07.418Z
updated_at: 2026-11-20T15:47:21.411Z
---

# Messages that arrive mid-run wait for the next user prompt when the model ignores the cue

Messages received while busy go to the pending inbox and are drained only at the next before_agent_start or after tattler_receive. If the model ignores the cue, an idle session keeps them until the user types (seen in the 2026-11-19 TAT-68 probe). Fix: at agent_settled, if the inbox is non-empty and the session is idle, deliver the batch with triggerTurn. Comparison with the claude-tattler port (2026-11-20, its candidate 9), which delivers at turn end.

Outcome (pzltlozk): at agent_settled, pending messages are delivered with triggerTurn whether or not the model called tattler_receive; after a user-aborted run they wait for the next prompt unless tattler_receive asked. Cue text now says they arrive when the run ends. Real-session cue tests show cue then delivery. bun check clean, 93 files/883 tests, dist rebuilt.

---

# Activity Log

## 2026-11-20T15:37:12.336Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-20T15:47:21.411Z

- **status**: IN PROGRESS → NEEDS REVIEW
- **description**: 1 line → updated (3 lines)
