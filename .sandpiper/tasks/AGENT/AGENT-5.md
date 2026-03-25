---
title: "CLI flags for pi config migration"
status: NEEDS REVIEW
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-03-25T17:58:15.773Z
updated_at: 2026-03-25T19:45:39.585Z
depends_on:
  - AGENT-2
---

# CLI flags for pi config migration

Register CLI flags for migration and handle them in `session_directory` event handler.

## Flags to Register

```typescript
pi.registerFlag("migrate-pi-configs", {
  description: "Migrate ~/.pi and ./.pi to ~/.sandpiper and ./.sandpiper, then exit",
  type: "boolean",
  default: false,
});

pi.registerFlag("symlink-config", {
  description: "Symlink ~/.pi and ./.pi to ~/.sandpiper and ./.sandpiper, then exit",
  type: "boolean",
  default: false,
});

// Modifier flags for scope
pi.registerFlag("global", { description: "Only migrate global config", type: "boolean" });
pi.registerFlag("local", { description: "Only migrate project-local config", type: "boolean" });
```

## Handler Logic

In `session_directory` event:
1. Check if flag is set via `pi.getFlag()`
2. Parse scope from `--global`/`--local` modifiers
3. Call migration function
4. Print result to stdout/stderr
5. Exit with appropriate code (0 for success, 1 for failure)

## Behavior

- If both flags passed → error (mutually exclusive)
- If destination exists → error
- If source doesn't exist → success (nothing to do)
- If migration fails → error with details

## Subtasks

- AGENT-6: --migrate-pi-configs flag
- AGENT-7: --symlink-config flag

## Depends on

- AGENT-2: Migration functions

---

# Activity Log

## 2026-03-25T18:00:02.308Z

- **description**: added (46 lines)

## 2026-03-25T18:55:54.056Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-25T19:00:38.178Z

- **status**: IN PROGRESS → NEEDS REVIEW
- **resolution**: DONE
