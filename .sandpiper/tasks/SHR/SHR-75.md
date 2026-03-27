---
title: "Investigate zellij subscribe for output capture (replace FIFO pipeline)"
status: NOT STARTED
kind: TASK
priority: HIGH
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-27T20:45:55.385Z
updated_at: 2026-03-27T21:22:38.363Z
---

# Investigate zellij subscribe for output capture (replace FIFO pipeline)

Zellij 0.44 adds `zellij subscribe` — a continuous viewport stream that fires on every terminal re-render. Potential replacement for stdout/stderr FIFOs.

Key findings from initial exploration:
- Fires on every re-render (every keystroke when user types interactively)
- Bulk operations (send-keys injection) produce ~4 events: chars arriving, enter, output, fresh prompt
- Gives the full rendered viewport — prompt decorations, ANSI, cursor state — not clean process stdout/stderr
- Does NOT provide exit codes or structured process boundaries
- Essentially a streaming version of dump-screen

Architectural implications:
- Cannot fully replace FIFO pipeline — no exit codes, no stdout/stderr separation
- Could replace dump-screen polling for output capture post-command
- Could supplement signal FIFO as an alternative prompt_ready detection mechanism
- Noise filtering needed: ignore events between user keystrokes, only capture between command injection and prompt_ready
- The bulk-vs-interactive distinction is key: our injected commands arrive as bulk (few events), user typing is noisy (event per keystroke)

Open questions:
- Is viewport parsing reliable enough for multi-line output, stderr interleaving, long-running commands?
- Can we use subscribe as the SOLE output channel (replacing stdout/stderr FIFOs) if we accept viewport-level fidelity?
- Or is it better as a supplementary signal alongside the existing FIFO pipeline?
- What does the --json format look like? Does it give us pane metadata alongside content?

---

# Activity Log

## 2026-03-27T21:22:38.368Z

- **description**: added (21 lines)
