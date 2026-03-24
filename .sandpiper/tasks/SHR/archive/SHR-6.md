---
title: "Bash shell integration"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-23T04:32:35.907Z
---

# Bash shell integration

Implement the basic bash shell integration script (`relay.bash`) with prompt hook and command wrapper function. User command capture (DEBUG trap) is deferred to future work.

**Acceptance criteria:**
- User can source `relay.bash` in their `.bashrc`
- Sourcing is safe in all bash instances (no-op when relay is not active)
- `PROMPT_COMMAND` hook writes `prompt_ready` to signal FIFO
- `__relay_run` wrapper captures stdout/stderr via FIFOs, exit code via `${PIPESTATUS[0]}`
- All guards are defensive: silent no-op on missing/broken FIFO
- Validation deferred to full bash/zsh implementation phase

**References:** FR-14, FR-3

---

# Activity Log

## 2026-03-23T04:32:35.907Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
