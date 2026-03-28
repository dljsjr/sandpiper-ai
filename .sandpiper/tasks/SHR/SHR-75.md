---
title: "Investigate zellij subscribe for output capture (replace FIFO pipeline)"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-03-27T20:45:55.385Z
updated_at: 2026-03-28T02:22:32.185Z
---

# Investigate zellij subscribe for output capture (replace FIFO pipeline)

INVESTIGATED: subscribe provides real-time viewport stream but cannot replace FIFO pipeline entirely.

Findings from spike:
- subscribe fires on every re-render, delivers full viewport as JSON array of lines
- Bulk command injection (paste + send-keys) produces ~5 events: initial, paste, enter, output, new prompt
- stdout and stderr are interleaved in the viewport — no separation possible
- Exit codes appear in prompt decorations but not as structured data
- Previous command output and prompt decorations are mixed into viewport
- dump-screen gives the same content as a one-shot snapshot

Assessment: subscribe is useful for detecting state changes (command → output → prompt_ready) but cannot provide clean stdout/stderr separation or structured exit codes.

Recommended approach (Option C - hybrid):
- Keep shell integration scripts but SIMPLIFY: only prompt_ready + exit code signaling
- Drop stdout/stderr FIFO redirection entirely
- Use dump-screen --full after prompt_ready to capture visual output
- Keep signal FIFO for structured prompt_ready/exit_code events from shell
- subscribe as optional enhancement for real-time viewport monitoring

---

# Activity Log

## 2026-03-27T21:22:38.368Z

- **description**: added (21 lines)

## 2026-03-28T02:21:17.745Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-28T02:22:32.141Z

- **description**: 21 lines → updated (18 lines)

## 2026-03-28T02:22:32.186Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: DONE
