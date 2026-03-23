---
title: "Persistent FIFO manager"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-23T04:32:36.398Z
---

# Persistent FIFO manager

Implement the persistent FIFO lifecycle manager (`fifo.ts`) that creates, manages, and cleans up the three FIFOs (stdout, stderr, signal) used for relay communication.

This is the core data plane — it must be rock-solid and thoroughly tested.

**Acceptance criteria:**
- Three FIFOs created at session start with deterministic paths based on session ID
- FIFOs opened with `O_RDWR` for sentinel behavior (no EOF between commands)
- Continuous reading via readable streams; signal channel parsed as line-delimited text
- Event emitter interface for `last_status` and `prompt_ready` signals
- Secure directory creation (`$XDG_RUNTIME_DIR` or `/tmp/shell-relay-$USER/`, mode `0700`, FIFOs mode `0600`)
- Clean shutdown, stale FIFO detection on startup
- Framework-independent: no pi imports

**References:** FR-4, FR-9, FR-11

---

# Activity Log

## 2026-03-23T04:32:36.398Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
