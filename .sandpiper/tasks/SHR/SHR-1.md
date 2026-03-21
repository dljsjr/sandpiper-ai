---
title: "Fish shell integration"
status: NEEDS REVIEW
kind: TASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-21T01:42:02-05:00
---

# Fish shell integration

Implement the full fish shell integration script (`relay.fish`) that enables communication between the relay extension and the user's fish shell session.

This is the MVP shell — fish gets full functionality including prompt hook, command wrapper, Enter key binding override, and terminal title override. Bash and zsh get basic support (prompt hook + wrapper only) in separate tasks.

**Acceptance criteria:**
- User can source `relay.fish` in their `config.fish`
- Sourcing is safe in all fish instances (no-op when relay is not active)
- Prompt hook writes `prompt_ready` to signal FIFO on each prompt draw
- `__relay_run` wrapper captures stdout/stderr via FIFOs, exit code via `$pipestatus[1]`, writes `last_status:N` to signal FIFO
- Enter key binding wraps user-typed commands in capture pattern
- `fish_title` displays clean command without wrapper boilerplate
- All guards are defensive: silent no-op on missing/broken FIFO

**References:** FR-14, FR-3, FR-9
