---
title: "Error on relay tool/command use if shell integration not sourced"
status: NOT STARTED
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-26T04:25:52.770Z
updated_at: 2026-04-01T16:30:37.060Z
---

# Error on relay tool/command use if shell integration not sourced

Call checkShellIntegration() at the start of /relay-connect and shell_relay tool calls. If unhealthy, show an actionable error toast and bail before creating the session.

Subtlety: the probe checks the login shell config, which is what matters for new Zellij sessions. But an existing session started before sourcing won't have it — the probe would pass but the session would fail. This edge case is acceptable for now; revisit if it causes real issues.

Deferred from the SHR-64 shell integration installer work.

---

# Activity Log

## 2026-03-26T04:25:59.595Z

- **description**: added (5 lines)

## 2026-04-01T16:30:37.060Z

- **priority**: LOW → MEDIUM
