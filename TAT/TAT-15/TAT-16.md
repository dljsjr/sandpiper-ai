---
title: "Define Tattler Pi event-bus API for Chorus"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: "Piper"
reporter: AGENT
created_at: 2026-05-23T06:23:56.662Z
updated_at: 2026-07-11T16:53:29.553Z
---

# Define Tattler Pi event-bus API for Chorus

Expose Tattler-owned capabilities to Chorus through pi.events rather than direct module imports. Use a non-blocking readiness/request state-machine shape so load order does not matter and Chorus registers /chorus only after the room API is available.

---

# Activity Log

## 2026-05-23T06:43:33.174Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Piper

## 2026-05-23T17:43:50.071Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-07-11T16:53:29.553Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
