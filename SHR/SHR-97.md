---
title: "Shell relay returns empty output after ~50+ invocations in long session"
status: NOT STARTED
kind: BUG
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-04-03T20:46:22.153Z
related:
  - SHR-99
updated_at: 2026-05-14T14:46:07.908Z
---

# Shell relay returns empty output after ~50+ invocations in long session

After extended use (~6 hours, ~50+ invocations), shell_relay commands return empty output with exit code 0 despite executing successfully in the underlying pane. The relay pane itself is functional — commands execute and output is visible — but the relay capture mechanism fails.

Suspected cause: Zellij pane scrollback buffer accumulates significant content, and the output extraction or signal detection mechanism fails when the buffer exceeds a certain size.

Workaround: use bash instead of shell_relay for commands that don't require session state.

Discovered during vcode infrastructure project session on 2026-04-01.

---

# Activity Log

## 2026-04-03T20:46:33.382Z

- **description**: added (7 lines)

## 2026-05-14T14:46:07.908Z

- **related**: (none) → SHR-99
