# Sandpiper Tasks CLI

Markdown-based task management with YAML frontmatter. Tasks are stored as individual `.md` files with structured metadata, organized by project.

## Usage

```
Usage: sandpiper-tasks [options] [command]

Markdown-based task management with YAML frontmatter

Options:
  -V, --version          output the version number
  -d, --dir <path>       Path to the directory containing .sandpiper/tasks
                         (defaults to cwd)
  -f, --format <format>  Output format: raw, json, toon
  --no-save              Skip writing to disk and index; output only (implies
                         --format raw if no format set)
  -h, --help             display help for command

Commands:
  index                  Manage the task index
  task                   Query and inspect tasks
  project                Query and inspect projects
  help [command]         display help for command
```

## Examples

### Creating tasks

```console
$ sandpiper-tasks task create -p SHR -t "Install shell integration to well-known location" -k TASK --priority MEDIUM --reporter USER
Created SHR-64: Install shell integration to well-known location
  File: /path/to/.sandpiper/tasks/SHR/SHR-64.md

$ sandpiper-tasks task create -p PKM -t "Design PKM system with Zettelkasten semantics" -k TASK --priority MEDIUM
Created PKM-1: Design PKM system with Zettelkasten semantics
  File: /path/to/.sandpiper/tasks/PKM/PKM-1.md
```

### Querying tasks

```console
$ sandpiper-tasks task list -p SHR --top-level
SHR-64 [MEDIUM] Install shell integration to well-known location (NOT STARTED)
SHR-63 [MEDIUM] Fix first-command race condition after setup (NOT STARTED)
SHR-62 [MEDIUM] Investigate write-chars line wrapping (NOT STARTED)

$ sandpiper-tasks task summary
Status Breakdown:
  NOT STARTED    12
  IN PROGRESS    0
  BLOCKED        0
  NEEDS REVIEW   0
  COMPLETE       67

Priority Breakdown:
  HIGH    3
  MEDIUM  9
  LOW     0
```

### Workflow

```console
$ sandpiper-tasks task pickup PKM-2
Picked up 1 task.

$ sandpiper-tasks task complete PKM-2 --final --resolution DONE
Completed 1 task → COMPLETE.

$ sandpiper-tasks task archive -p PKM
Archived 1 task from PKM.
```

See the [tasks skill](../../skills/sandpiper/tasks/SKILL.md) for comprehensive usage documentation.

## Architecture

```
src/
├── index.ts              # CLI entry point (Commander program)
├── commands/
│   ├── task-cmd.ts       # Task command orchestrator (wires subcommands)
│   ├── task-*.ts         # Task subcommands (list, show, create, update, etc.)
│   ├── task-cmd-helpers.ts # Shared task command helper logic
│   ├── project-cmd.ts    # Project subcommands (list, create)
│   ├── index-cmd.ts      # Index management subcommands
│   └── helpers.ts        # Shared CLI helpers
└── core/
    ├── types.ts          # Domain types (Task, TaskStatus, etc.)
    ├── frontmatter.ts    # YAML frontmatter parser
    ├── query.ts          # Query API (filter, sort, search)
    ├── mutate.ts         # Create, update, complete, pickup
    ├── move.ts           # Move tasks between projects/kinds
    ├── archive.ts        # Archive completed tasks
    ├── index-update.ts   # TOON index management (derived state — see below)
    ├── schema.ts         # Schema versioning + migrations
    ├── activity-log.ts   # Append-only activity log per task
    ├── history.ts        # Unified diffs for task modifications
    └── ...
```

### `index.toon` is derived state

`index.toon` is a cache over the task files on disk. It is **never committed to VCS**
— a `.gitignore` entry is automatically maintained by the CLI.

- **Auto-rebuilt** when missing or when the task file count has changed.
- **Scan-from-disk is primary** for counter allocation: `task create` always scans
  existing `.md` files and `.moved` tombstones to find the highest allocated number.
  The index counter acts as a floor to guard against regression if files are deleted.
- Running `sandpiper-tasks index update` explicitly rebuilds the index from scratch.

Core logic is framework-independent (no CLI imports). The CLI layer is a thin Commander wrapper that delegates to core functions.

## Build

```bash
bun run build    # tsc + bun build → dist/sandpiper-tasks
bun run test     # vitest (188 tests)
```

## Task File Format

```yaml
---
title: "Task title"
status: NOT STARTED
kind: TASK
priority: HIGH
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-24T00:00:00Z
updated_at: 2026-03-24T00:00:00Z
---

# Task title

Description and acceptance criteria here.
```

See [SPEC.md](../../skills/sandpiper/tasks/references/SPEC.md) for the full specification.

## Related design docs

- [Task storage strategy](../../.sandpiper/docs/task-storage-strategy.md) — approved design for reducing VCS churn from task operations
- [Task storage implementation plan](../../.sandpiper/docs/task-storage-implementation-plan.md) — phased execution plan and ticket map
