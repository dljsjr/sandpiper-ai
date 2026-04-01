---
title: "Implement fish __relay_run wrapper function"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-23T04:32:36.688Z
---

# Implement fish __relay_run wrapper function

Implement the `__relay_run` function that wraps a command in the capture pattern.

**Capture pattern:**
```fish
{ [unbuffer-relay -p] eval (string unescape --style=script -- $argv[1]) | tee $SHELL_RELAY_STDOUT > /dev/tty; set -g __relay_exit $pipestatus[1]; } 2>&1 >/dev/null | tee $SHELL_RELAY_STDERR > /dev/tty
echo "last_status:$__relay_exit" > $SHELL_RELAY_SIGNAL
```

**Requirements:**
- Accept escaped command string as `$argv[1]`, unescape via `string unescape --style=script`
- Execute via `eval` in the current shell session (no forking)
- Capture exit code via `$pipestatus[1]` inside the group
- Write `last_status:EXIT_CODE\n` to signal FIFO
- Detect `unbuffer-relay` availability (`command -v unbuffer-relay`) and use when present
- Read FIFO paths from `$SHELL_RELAY_STDOUT`, `$SHELL_RELAY_STDERR`, `$SHELL_RELAY_SIGNAL`

**Reference:** FR-14 (Command wrapper function section), FR-3

---

# Activity Log

## 2026-03-23T04:32:36.688Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
