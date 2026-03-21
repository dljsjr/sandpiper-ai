---
title: "Relay orchestration"
status: NEEDS REVIEW
kind: TASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-21T01:40:34-05:00
---

# Relay orchestration

Implement the core relay orchestration logic (`relay.ts`) that ties together the FIFO manager, Zellij integration, and signal channel into the end-to-end command execution flow.

**Acceptance criteria:**
- Full execution flow: readiness check → command injection → FIFO capture → signal wait → result return
- Command serialization (one at a time, concurrent calls queued)
- Command escaping via `string escape --style=script` (fish) / `printf '%q'` (bash/zsh)
- Timeout support with Ctrl+C injection
- Framework-independent: no pi imports

**References:** FR-3, FR-4, FR-8, FR-9, FR-12, FR-13
