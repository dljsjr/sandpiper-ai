---
title: "Implement fish prompt hook"
status: NEEDS REVIEW
kind: SUBTASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-21T01:42:02-05:00
---

# Implement fish prompt hook

Implement the `fish_prompt` event handler that writes `prompt_ready\n` to `$SHELL_RELAY_SIGNAL`.

**Requirements:**
- Register via `--on-event fish_prompt`
- MUST check on every invocation that `$SHELL_RELAY_SIGNAL` is defined AND the FIFO exists and is writable
- MUST silently no-op if the signal channel is absent, undefined, or broken
- MUST NOT interfere with other prompt customizations (starship, powerlevel10k, etc.)

**Reference:** FR-14 (Prompt hook section)
