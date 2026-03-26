---
title: "Implement migration functions for pi config"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-03-25T17:56:54.966Z
updated_at: 2026-03-26T04:27:06.032Z
---

# Implement migration functions for pi config

Create the core migration logic for moving or symlinking pi config directories to sandpiper equivalents.

## Scope

**Global config:**
- Source: `~/.pi/agent` (or `PI_CODING_AGENT_DIR` env var captured as `__PI_CODING_AGENT_DIR_ORIGINAL`)
- Target: `~/.sandpiper/agent` (or `SANDPIPER_CODING_AGENT_DIR` env var)

**Project-local config:**
- Source: `./.pi`
- Target: `./.sandpiper`

## Requirements

- Detect unmigrated configs (source exists, target doesn't)
- Handle env var overrides (respect user's PI_* env vars via captured originals)
- Error handling: destination exists, source doesn't, permissions, etc.
- Return structured result: `{ success: boolean; error?: string; migrated: string[] }`

## Prerequisite

Update `packages/cli/pi_wrapper.ts` to capture original PI_* env vars before remapping:
```typescript
process.env.__PI_CODING_AGENT_DIR_ORIGINAL = process.env.PI_CODING_AGENT_DIR;
```

## Subtasks

- AGENT-3: Move migration (renameSync)
- AGENT-4: Symlink migration (symlinkSync)

---

# Activity Log

## 2026-03-25T17:58:02.020Z

- **description**: added (30 lines)

## 2026-03-25T18:02:41.075Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-25T18:07:29.798Z

- **status**: IN PROGRESS → NEEDS REVIEW
- **resolution**: DONE

## 2026-03-26T04:27:06.032Z

- **status**: NEEDS REVIEW → COMPLETE
