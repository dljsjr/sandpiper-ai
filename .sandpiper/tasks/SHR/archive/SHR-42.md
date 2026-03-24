---
title: "Graceful degradation"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-23T05:16:42.679Z
---

# Graceful degradation

When the relay is unavailable, return clear actionable errors.

**Acceptance criteria:**
- Detect: Zellij not running, pane not configured, shell integration not set up
- Return specific remediation steps for each failure mode
- Suggest falling back to `bash` for commands that don't need session state

**References:** Work Plan Phase 4.5, NFR-3

---

# Activity Log

## 2026-03-23T05:14:55.902Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-23T05:16:42.680Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: DONE
