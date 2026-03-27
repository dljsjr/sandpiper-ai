---
title: "Evaluate whether Zellij 0.44 features warrant a ground-up shell relay redesign"
status: NOT STARTED
kind: TASK
priority: HIGH
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-27T20:45:55.601Z
depends_on:
  - AGENT-15
blocked_by:
  - SHR-75
  - SHR-76
  - SHR-77
  - SHR-78
  - AGENT-15
updated_at: 2026-03-27T21:31:06.778Z
---

# Evaluate whether Zellij 0.44 features warrant a ground-up shell relay redesign

Meta-ticket: once SHR-75 through SHR-78 investigations are complete, decide whether to:
A) Incrementally adopt Zellij 0.44 APIs into the existing FIFO-based architecture
B) Do a ground-up redesign of the shell relay

Likely hybrid approach based on initial findings:
- Replace write-chars with send-keys (SHR-76) — clear improvement
- Replace waitForPane polling with list-panes (SHR-77) — clear improvement  
- Investigate ghost client elimination via --pane-id (SHR-78) — high impact if feasible
- Keep signal FIFO for prompt_ready + exit codes — subscribe can't provide these
- Evaluate subscribe as output capture replacement vs supplement (SHR-75) — needs prototyping

The shell integration scripts (relay.fish/bash/zsh) are likely still needed for structured events (prompt_ready, exit codes) since Zellij's viewport stream doesn't provide process-level boundaries.

---

# Activity Log

## 2026-03-27T21:22:38.580Z

- **description**: added (12 lines)

## 2026-03-27T21:31:06.738Z

- **depends_on**: (none) → AGENT-15

## 2026-03-27T21:31:06.778Z

- **blocked_by**: (none) → SHR-75, SHR-76, SHR-77, SHR-78, AGENT-15
