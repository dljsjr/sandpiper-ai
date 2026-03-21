---
title: "Implement fish Enter key binding override"
status: NEEDS REVIEW
kind: SUBTASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-21T01:42:02-05:00
---

# Implement fish Enter key binding override

Override the Enter key binding to wrap user-typed commands in the capture pattern.

**Requirements:**
- `bind \r __relay_execute` and `bind \n __relay_execute`
- Check `commandline --is-valid` before wrapping — if incomplete (unclosed brackets, quotes), insert a newline instead (preserving default multiline behavior)
- Only wrap when `$SHELL_RELAY_SIGNAL` is defined and valid; otherwise delegate to `commandline -f execute`
- Use `string escape --style=script` to escape the command before passing to `__relay_run`

**Reference:** FR-14 (Enter key binding section)
