---
title: "Evaluate whether Zellij 0.44 features warrant a ground-up shell relay redesign"
status: COMPLETE
resolution: DONE
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
updated_at: 2026-03-28T03:52:01.497Z
---

# Evaluate whether Zellij 0.44 features warrant a ground-up shell relay redesign

DECISION: Incremental rewrite, not ground-up redesign.

All four investigations complete (SHR-75 through SHR-78). The Zellij 0.44 APIs
are a clear upgrade but the overall architecture stays the same — we're swapping
out components, not reimagining the flow.

What changes:
- ELIMINATE ghost-attach expect script + tclsh dependency (SHR-78 confirmed)
- REPLACE write-chars with paste + send-keys (SHR-76 confirmed)
- REPLACE dump-screen-to-dev-null waitForPane with list-panes --json (SHR-77 confirmed)
- REPLACE ZELLIJ_SESSION_NAME env var with --session flag
- SIMPLIFY shell integration: drop stdout/stderr FIFOs, keep only signal FIFO for prompt_ready + exit code
- USE dump-screen --pane-id --full for output capture after prompt_ready

What stays:
- Shell integration scripts (relay.fish/bash/zsh) — simplified but still needed for prompt_ready + exit code
- Signal FIFO — cleanest IPC for structured events from the shell
- Overall flow: inject command → wait for prompt_ready → capture output → return

What's optional/future:
- subscribe for real-time viewport monitoring (enhancement, not core)
- ProcessManager (AGENT-15) as the runtime for subscribe stream if we add it

---

# Activity Log

## 2026-03-27T21:22:38.580Z

- **description**: added (12 lines)

## 2026-03-27T21:31:06.738Z

- **depends_on**: (none) → AGENT-15

## 2026-03-27T21:31:06.778Z

- **blocked_by**: (none) → SHR-75, SHR-76, SHR-77, SHR-78, AGENT-15

## 2026-03-28T02:22:44.488Z

- **description**: 12 lines → updated (22 lines)

## 2026-03-28T03:52:01.498Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: DONE
