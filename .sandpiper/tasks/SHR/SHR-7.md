---
title: "Zsh shell integration"
status: NEEDS REVIEW
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-21T01:42:02-05:00
---

# Zsh shell integration

Implement the basic zsh shell integration script (`relay.zsh`) with prompt hook and command wrapper function. User command capture (`zle` widget override) is deferred to future work.

**Acceptance criteria:**
- User can source `relay.zsh` in their `.zshrc`
- Sourcing is safe in all zsh instances (no-op when relay is not active)
- `precmd` hook writes `prompt_ready` to signal FIFO
- `__relay_run` wrapper captures stdout/stderr via FIFOs, exit code via `${PIPESTATUS[0]}`
- All guards are defensive: silent no-op on missing/broken FIFO
- Validation deferred to full bash/zsh implementation phase

**References:** FR-14, FR-3
