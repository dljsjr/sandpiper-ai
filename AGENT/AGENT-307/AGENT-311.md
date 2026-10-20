---
title: "Tattler test for the 1.2.0 busy-during-setup window"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-10-16T17:17:57.441Z
updated_at: 2026-10-19T17:27:18.024Z
---

# Tattler test for the 1.2.0 busy-during-setup window

Added a real-session case to extensions/tattler/tattler-pending-cue.session.test.ts: a probe extension registered after Tattler delivers a peer message from before_agent_start (after Tattler's drain, while Pi 1.2.0+ counts the session busy). Result on 1.3.0: green with no Tattler change. The message goes to the pending inbox (busy) and the cue is sent with triggerTurn false; Pi's _startRun holds it and flushes held custom messages before the run's starting messages, so the cue is in the first request. AGENT-306's feared gap does not occur.

---

# Activity Log

## 2026-10-16T17:24:46.695Z

- **description**: added (1 line)

## 2026-10-16T17:27:41.280Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-10-19T17:27:18.025Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
