---
title: "System extension: aggregate and display preflight diagnostics"
status: NOT STARTED
kind: TASK
priority: HIGH
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-25T21:55:27.812Z
updated_at: 2026-03-25T21:55:48.141Z
depends_on:
  - AGENT-12
---

# System extension: aggregate and display preflight diagnostics

Wire the preflight registry into system.ts session_start handler.

## Behavior

On session_start:
1. Import getRegisteredPreflightChecks() from sandpiper-ai-core
2. Run all registered check callbacks (synchronously)
3. Filter for unhealthy results
4. If any unhealthy: display single aggregated setWidget banner
5. If all healthy: clear the widget (in case it was previously shown)

## Banner Format

```
⚠  Sandpiper diagnostics:

  shell-relay: Shell integration not installed
    Run: sandpiper --install-shell-integrations
    Then add to ~/.config/fish/config.fish:
      source ~/.sandpiper/shell-integrations/relay.fish

  [other checks...]
```

## Notes

- Banner should coexist with (or replace) the existing migration warning widget
- Consider whether migration warning should be refactored to use the same preflight system
- Widget key: 'sandpiper-diagnostics'

---

# Activity Log

## 2026-03-25T21:55:48.141Z

- **description**: added (29 lines)
