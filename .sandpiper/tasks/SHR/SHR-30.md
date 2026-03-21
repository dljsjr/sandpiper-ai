---
title: "Startup validation"
status: NEEDS REVIEW
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-21T01:48:53-05:00
---

# Startup validation

On relay connect, validate that the full pipeline is functional before accepting commands.

**Acceptance criteria:**
- Inject a no-op command (` __relay_run 'true'`) into the pane
- Verify `last_status:0` and `prompt_ready` signals are received
- Report success/failure to the user
- Fail fast with actionable error if pipeline is broken (e.g., shell integration not sourced, FIFO path mismatch)
- Verify signal channel liveness via Zellij pane process state query

**References:** NFR-3
