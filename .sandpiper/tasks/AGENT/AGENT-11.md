---
title: "Warning banner for unmigrated pi configs"
status: NOT STARTED
kind: TASK
priority: HIGH
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-25T18:01:30.626Z
updated_at: 2026-03-25T18:01:50.085Z
---

# Warning banner for unmigrated pi configs

Display a persistent warning banner when unmigrated pi configs are detected.

## Detection Logic

In `session_start` event handler:
- Check if `~/.pi/agent` exists but `~/.sandpiper/agent` doesn't
- Check if `./.pi` exists but `./.sandpiper` doesn't
- Respect env var overrides (use captured `__PI_CODING_AGENT_DIR_ORIGINAL`)

## Banner Implementation

```typescript
const unmigrated = detectUnmigratedConfigs();
if (unmigrated.length > 0) {
  ctx.ui.setWidget("migration-warning", [
    ctx.ui.theme.fg("warning", "⚠️  Unmigrated pi configs detected:"),
    `   ${unmigrated.join(", ")}`,
    "",
    "   Migrate:  sandpiper --migrate-pi-configs",
    "   Symlink:  sandpiper --symlink-config",
    "   Or run:   /migrate-pi move",
  ]);
}
```

## Clearing the Banner

The banner should be cleared by the `/migrate-pi` command handler after successful migration:

```typescript
ctx.ui.setWidget("migration-warning", undefined);
```

## No Subtasks

This is a single implementation task.

---

# Activity Log

## 2026-03-25T18:01:50.086Z

- **description**: added (36 lines)
