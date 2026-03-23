---
title: "Implement signal channel line parser and event emitter"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-23T04:32:36.803Z
---

# Implement signal channel line parser and event emitter

Parse the signal FIFO as line-delimited text and emit typed events:

- `last_status:N\n` → emit `lastStatus` event with exit code `N`
- `prompt_ready\n` → emit `promptReady` event

Use an EventEmitter (or similar pattern) so the relay orchestrator can await these signals.

**Reference:** FR-9

---

# Activity Log

## 2026-03-23T04:32:36.803Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
