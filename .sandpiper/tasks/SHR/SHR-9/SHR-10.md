---
title: "Implement FIFO creation with deterministic paths"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-23T04:32:36.834Z
---

# Implement FIFO creation with deterministic paths

Create three FIFOs at session start via `mkfifo` with deterministic paths:
- `$XDG_RUNTIME_DIR/shell-relay/<session-id>/stdout`
- `$XDG_RUNTIME_DIR/shell-relay/<session-id>/stderr`
- `$XDG_RUNTIME_DIR/shell-relay/<session-id>/signal`

Fall back to `/tmp/shell-relay-$USER/<session-id>/` when `$XDG_RUNTIME_DIR` is not available.

Directory mode `0700`, FIFO mode `0600`.

**Reference:** FR-4, FR-11

---

# Activity Log

## 2026-03-23T04:32:36.835Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
