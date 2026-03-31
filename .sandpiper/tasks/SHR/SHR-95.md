---
title: "Fish __relay_run cannot execute heredoc commands"
status: NOT STARTED
kind: BUG
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-03-31T17:15:03.901Z
updated_at: 2026-03-31T17:15:14.947Z
---

# Fish __relay_run cannot execute heredoc commands

Repro: running shell_relay with a heredoc command such as python3 - <<'PY' newline print("OK") newline PY fails in fish with: Expected a string, but found a redirection. The relay fish wrapper currently assigns argv[1] to a variable and executes eval on that variable; multiline/heredoc syntax appears to break in this form. Need a fish-compatible execution strategy that preserves multiline and redirection semantics while still emitting last_status via SHELL_RELAY_SIGNAL. Independent of snapshot-diff parsing.

---

# Activity Log

## 2026-03-31T17:15:03.945Z

- **description**: added (1 line)

## 2026-03-31T17:15:14.948Z

- **description**: updated
