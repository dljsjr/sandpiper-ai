---
title: "No-session standup read can delete active standup state"
status: COMPLETE
resolution: WONTFIX
kind: BUG
priority: HIGH
assignee: UNASSIGNED
reporter: USER
created_at: 2026-04-28T18:22:51.472Z
updated_at: 2026-05-04T19:34:08.881Z
---

# No-session standup read can delete active standup state

Reading standup state from an agent launched with `--no-session` can trigger cleanup logic that treats the active standup file as orphaned/dead and deletes or rewrites it.

Observed scenario:
- Start a separate agent for code review with `--no-session`.
- That agent runs the standup CLI `read` flow.
- Cleanup logic nukes the standup file even though another normal session still needs it.

Expected behavior:
- `--no-session` agents should not participate in destructive standup cleanup, or cleanup should distinguish "no session metadata" from "dead/orphaned session".
- A read operation should not delete valid standup state for other sessions.

This is a data-loss class bug; add regression coverage for no-session reads before fixing.

---

# Activity Log

## 2026-04-28T18:22:51.518Z

- **description**: added (12 lines)

## 2026-05-04T19:34:08.882Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: WONTFIX
