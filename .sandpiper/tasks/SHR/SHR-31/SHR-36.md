---
title: "Shell integration guard behavior tests"
status: NEEDS REVIEW
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-21T01:50:57-05:00
---

# Shell integration guard behavior tests

Test shell integration scripts for guard behavior:

- Prompt hook: no-op when `$SHELL_RELAY_SIGNAL` is undefined
- Prompt hook: no-op when `$SHELL_RELAY_SIGNAL` points to nonexistent file
- Prompt hook: no-op when FIFO exists but is not writable
- Prompt hook: writes `prompt_ready` when FIFO is valid
- Wrapper function: detects `unbuffer-relay` availability
- Fish Enter binding: delegates to default execute when relay is not active
- Fish Enter binding: inserts newline for incomplete commands (`commandline --is-valid`)

These tests may require spawning shell subprocesses with controlled environments.
