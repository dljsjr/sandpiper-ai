# Task Storage Architecture

Design rationale and configuration model for Sandpiper's task storage system.

## Overview

Tasks can be stored in three modes:

1. **Inline** — Tasks committed alongside code on the current branch
2. **Separate branch** — Tasks on a dedicated branch via workspace/worktree
3. **External repo** — Tasks in a separate repository

## Design Rationale

### Problem

Task lifecycle operations (create, update, complete) produce significant VCS churn:

- Every `task update` modifies the task file
- History diff files accumulate in `history/` directory
- Index file (`index.toon`) rewrites entirely on every operation

A single triage session can touch 25+ files. Normal implementation sessions produce 10–15 file changes that are pure bookkeeping.

### Solution

Separate task storage from code storage:

- **Inline mode** — Default, no setup required
- **Separate branch** — Isolates task churn from code history
- **External repo** — Shared task tracking across projects

### Key Decisions

| Decision                   | Choice                         | Rationale                                      |
| -------------------------- | ------------------------------ | ---------------------------------------------- |
| **Task files on disk**     | ✅ Yes                         | CLI, agent, humans interact directly           |
| **History diff files**     | ✅ Yes                         | Append-only audit trail, survives VCS curation |
| **Index as derived state** | ✅ Yes                         | Gitignored, rebuilt from disk on demand        |
| **Counter from disk scan** | ✅ Yes                         | Primary mechanism, index is optimization       |
| **Explicit bootstrap**     | ✅ Yes                         | `storage init` command, not silent             |
| **Backend selection**      | jj → workspace, git → worktree | Use appropriate VCS primitives                 |

## Configuration Model

### Configuration Files

Task storage config lives in two places:

1. **`.sandpiper-tasks.json`** (project root) — Wins if present
2. **`.sandpiper/settings.json`** → `tasks` key — Fallback

### Configuration Schema

```json
{
  "version_control": {
    "enabled": true,
    "mode": {
      "branch": "sandpiper-tasks",
      "repo": "git@github.com:user/project-tasks.git"
    },
    "auto_commit": false,
    "auto_push": false
  }
}
```

### Fields

| Field                         | Default  | Description                                 |
| ----------------------------- | -------- | ------------------------------------------- |
| `version_control.enabled`     | `true`   | VCS-track tasks at all                      |
| `version_control.mode.branch` | `"@"`    | `"@"` = inline; any other = separate branch |
| `version_control.mode.repo`   | _(omit)_ | External repo URL; omit for current repo    |
| `version_control.auto_commit` | `false`  | Auto-commit to task branch after mutations  |
| `version_control.auto_push`   | `false`  | Auto-push after auto-commit                 |

### Configuration Matrix

| `enabled` | `repo`      | `branch`  | Behavior                                    |
| --------- | ----------- | --------- | ------------------------------------------- |
| `false`   | —           | —         | Plain files, gitignored if in VCS           |
| `true`    | omitted     | `"@"`     | Inline on current branch (default)          |
| `true`    | omitted     | `"tasks"` | Separate branch in current repo             |
| `true`    | `"git@..."` | `"@"`     | Clone external repo, use its default branch |
| `true`    | `"git@..."` | `"tasks"` | Clone external repo, use named branch       |

## Backend Selection

When `mode.branch` is not `"@"` and `mode.repo` is omitted (separate branch in current repo):

| Current Repo            | Backend                        |
| ----------------------- | ------------------------------ |
| Has `.jj/`              | `jj workspace add` at `root()` |
| Has `.git/` (no `.jj/`) | `git worktree add --orphan`    |
| Neither                 | Error (not in VCS repo)        |

When `mode.repo` is set (external repo):

| Current Repo            | Backend                   |
| ----------------------- | ------------------------- |
| Has `.jj/`              | `jj git clone --colocate` |
| Has `.git/` (no `.jj/`) | `git clone`               |

## Bootstrap Flow

```bash
# 1. Configure (create .sandpiper-tasks.json)
{
  "version_control": {
    "mode": { "branch": "sandpiper-tasks" }
  }
}

# 2. Initialize
bun sandpiper-tasks storage init

# 3. Migrate existing inline tasks (optional)
bun sandpiper-tasks storage migrate

# 4. Push to remote (first time)
cd .sandpiper/tasks
jj git push --bookmark sandpiper-tasks  # or git push -u origin sandpiper-tasks
```

## Implementation Details

### Index as Derived State

`index.toon` is **gitignored** and rebuilt from disk on every CLI invocation if:

- Index file is missing
- Any task file mtime > index mtime

### Counter Allocation

Task counter is allocated by:

1. **Primary**: Scan all task files + `.moved` tombstones from disk
2. **Optimization**: Use index counter if fresh

This prevents counter reuse even when index is stale.

### History Files

History files (`history/*.md`) are retained because:

- VCS history is lossy (squashing destroys intermediate states)
- TUI/web UI need efficient task evolution rendering
- Each history diff is self-contained, atomic

## Related Documentation

- [Feature Overview](./README.md) — User-facing guide
- [Storage Guide](./storage-guide.md) — Operator commands
