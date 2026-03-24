---
title: "PTY color preservation via unbuffer-relay"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-23T04:32:35.991Z
---

# PTY color preservation via unbuffer-relay

Formalize the `unbuffer-relay` expect/TCL script for PTY color preservation with proper exit code propagation. A working prototype exists from the design phase; this task formalizes it into the extension directory.

**Acceptance criteria:**
- `unbuffer-relay` wraps commands in a PTY so `isatty(stdout)` returns true
- Exit code is propagated correctly in both pipeline (`-p`) and non-pipeline modes
- Fast-exiting commands are handled gracefully (`catch`-wrapped `interact` and `wait`)
- Script requires only `tclsh` + expect package
- `SHELL_RELAY_NO_UNBUFFER=1` environment variable forces basic mode (skips PTY wrapping)

**References:** FR-15

---

# Activity Log

## 2026-03-23T04:32:35.991Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
