---
title: "Slash command for pi config migration"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-03-25T18:00:23.127Z
updated_at: 2026-03-26T04:27:06.107Z
depends_on:
  - AGENT-2
---

# Slash command for pi config migration

Register `/migrate-pi` slash command for interactive migration.

## Command Registration

```typescript
pi.registerCommand("migrate-pi", {
  description: "Migrate pi configs (move|symlink [--global|--local])",
  getArgumentCompletions: (prefix) => {
    const options = ["move", "symlink", "--global", "--local"];
    return options.filter(o => o.startsWith(prefix)).map(o => ({ value: o, label: o }));
  },
  handler: async (args, ctx) => { ... }
});
```

## Argument Parsing

```
/migrate-pi move           # Both global + project-local
/migrate-pi move --global  # Only global
/migrate-pi move --local   # Only project-local
/migrate-pi symlink        # Symlink both
/migrate-pi symlink --local
```

## Handler Logic

1. Parse args to extract mode (move/symlink) and scope (both/global/local)
2. Call migration function
3. On success: clear warning widget, notify, `await ctx.reload()`
4. On failure: notify with error message

## Subtasks

- AGENT-9: /migrate-pi move command
- AGENT-10: /migrate-pi symlink command

## Depends on

- AGENT-2: Migration functions

---

# Activity Log

## 2026-03-25T18:01:14.793Z

- **description**: added (40 lines)

## 2026-03-25T20:06:46.733Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-25T20:07:41.249Z

- **status**: IN PROGRESS → NEEDS REVIEW
- **resolution**: DONE

## 2026-03-26T04:27:06.108Z

- **status**: NEEDS REVIEW → COMPLETE
