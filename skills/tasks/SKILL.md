---
name: tasks
description: Create, update, query, and organize project work items (tasks, bugs, subtasks) as markdown files with YAML frontmatter. Use when the user asks to create a ticket, track work, check task status, assign work, or manage a backlog. Tasks are stored in the local project's .sandpiper/tasks directory.
allowed-tools: read write bash
compatibility: Requires a local .sandpiper/tasks directory in the project. Uses standard POSIX tools (grep, ls) for querying.
---

# Task Management Skill

Manage project work items as markdown files with YAML frontmatter, stored in the local project's `.sandpiper/tasks` directory.

For the full normative specification (RFC 2119), see [SPEC.md](SPEC.md). This skill document provides operational guidance and quick reference.

## Directory Structure

```
.sandpiper/tasks/
├── <PROJECT_KEY>/                      # One directory per project (e.g., SHR/)
│   ├── .meta.yml                       # Project metadata (task counter)
│   ├── <PROJECT_KEY>-<N>.md            # Top-level TASK or BUG
│   ├── <PROJECT_KEY>-<N>/              # Subtask directory (only if task has subtasks)
│   │   ├── <PROJECT_KEY>-<M>.md        # SUBTASK of the parent task
│   │   └── ...
│   └── ...
└── ...
```

### Example

```
.sandpiper/tasks/
└── SHR/
    ├── .meta.yml
    ├── SHR-1.md                        # TASK: Implement FIFO manager
    ├── SHR-1/                          # Subtasks of SHR-1
    │   ├── SHR-2.md                    # SUBTASK: Write O_RDWR sentinel logic
    │   └── SHR-3.md                    # SUBTASK: Implement stale FIFO cleanup
    ├── SHR-4.md                        # BUG: Signal channel drops messages
    └── SHR-5.md                        # TASK: Implement Zellij integration
```

## Project Metadata (`.meta.yml`)

Each project directory MUST contain a `.meta.yml` file tracking the next task number:

```yaml
project_key: SHR
next_task_number: 6
```

When creating a new task, read `next_task_number`, use it for the new task key, then increment and write it back.

## Project Keys

- MUST be exactly 3 uppercase ASCII letters: `[A-Z]{3}`
- Examples: `SHR` (Shell Relay), `CLI` (CLI tooling), `COR` (Core library)

## Task File Format

Every task is a markdown file with YAML frontmatter:

```markdown
---
title: Implement persistent FIFO manager
status: IN PROGRESS
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-03-20T15:00:00Z
updated_at: 2026-03-20T16:30:00Z
depends_on:
  - SHR-1
related:
  - SHR-5
blocked_by:
  - SHR-4
---

# Implement persistent FIFO manager

Detailed description of the work to be performed...
```

### Required Frontmatter Fields

| Field | Type | Values |
|-------|------|--------|
| `title` | string | Short summary of the task |
| `status` | enum | `NOT STARTED`, `IN PROGRESS`, `NEEDS REVIEW`, `COMPLETE` |
| `kind` | enum | `BUG`, `TASK`, `SUBTASK` |
| `priority` | enum | `LOW`, `MEDIUM`, `HIGH` |
| `assignee` | string | `UNASSIGNED`, `USER`, or `AGENT` |
| `reporter` | string | `USER` or `AGENT` |
| `created_at` | ISO 8601 | Timestamp when the task was created |
| `updated_at` | ISO 8601 | Timestamp when the task was last modified |

### Optional Frontmatter Fields

| Field | Type | Description |
|-------|------|-------------|
| `related` | array of task keys | Work that relates to this task but doesn't form a dependency |
| `depends_on` | array of task keys | Tasks that must be completed before this one (planned dependencies) |
| `blocked_by` | array of task keys | Tasks blocking this one from completion (unplanned dependencies, bugs, interrupt work) |

### Body

The markdown body MUST start with a level-1 heading (`#`) that matches the `title` frontmatter field, followed by a detailed description of the work.

## Task Hierarchy Rules

- `TASK` and `BUG` are ALWAYS top-level (directly under the project directory)
- `SUBTASK` MUST be a child of a `TASK` or `BUG` (inside the parent's subtask directory)
- `SUBTASK` CANNOT have its own subtasks (max depth is one level)
- A bug discovered while working on a task is a separate top-level `BUG`, NOT a `SUBTASK` — use `related` or `blocked_by` to link them

## Task Numbering Rules

- Task numbers are **monotonically increasing integers**, starting at 1
- Task numbers are **scoped to the project key** — each project has its own counter
- The counter is shared across all task kinds (`TASK`, `BUG`, `SUBTASK`) within a project
- The counter is tracked in the project's `.meta.yml` file

## Assignee Conventions

- `UNASSIGNED` — no one is working on this
- `USER` — the user is working on this
- `AGENT` — the agent is working on this
- When the user asks you to create a task, set `reporter: USER`
- When you surface a work item yourself, set `reporter: AGENT`
- When you pick up a task to work on, set `assignee: AGENT` and `status: IN PROGRESS`
- When you finish a task, set `status: NEEDS REVIEW` (let the user confirm completion)

## Lifecycle

- Completed tasks (`status: COMPLETE`) remain in place — they are NOT deleted or moved
- Archiving completed tasks is done explicitly and periodically by the user

## Helper Scripts

The `scripts/` directory contains helper scripts for common task operations. These are the preferred way to perform task operations — they handle timestamps, validation, and meta file updates correctly.

### Create a task
```bash
./scripts/task-create.sh .sandpiper/tasks SHR TASK HIGH "Implement feature X"
./scripts/task-create.sh .sandpiper/tasks SHR SUBTASK MEDIUM "Write unit tests" SHR-1
./scripts/task-create.sh .sandpiper/tasks SHR BUG HIGH "Fix signal channel race condition"
```

### Pick up a task (assign to AGENT, set IN PROGRESS)
```bash
./scripts/task-pick-up.sh .sandpiper/tasks/SHR/SHR-9.md
./scripts/task-pick-up.sh .sandpiper/tasks/SHR/SHR-9.md .sandpiper/tasks/SHR/SHR-9/SHR-10.md
```

### Complete a task (set NEEDS REVIEW or COMPLETE)
```bash
./scripts/task-complete.sh .sandpiper/tasks/SHR/SHR-9.md
./scripts/task-complete.sh --complete .sandpiper/tasks/SHR/SHR-9.md
```

### View status summary
```bash
./scripts/task-summary.sh .sandpiper/tasks SHR       # One project
./scripts/task-summary.sh .sandpiper/tasks            # All projects
```

> **Note:** Script paths above are relative to the skill directory. Use the full path or resolve from the skill directory when invoking.

## Manual Operations

For operations not covered by scripts, use standard CLI tools:

### List tasks for a project
```bash
ls .sandpiper/tasks/<PROJECT_KEY>/*.md
```

### List subtasks of a task
```bash
ls .sandpiper/tasks/<PROJECT_KEY>/<TASK_KEY>/*.md
```

### Find all tasks assigned to you
```bash
grep -rl "assignee: AGENT" .sandpiper/tasks/
```

### Find all blocked tasks
```bash
grep -rl "blocked_by:" .sandpiper/tasks/
```

### Query tasks by status
```bash
grep -rl "status: IN PROGRESS" .sandpiper/tasks/
```

### Get a full status summary

```bash
for status in "NOT STARTED" "IN PROGRESS" "NEEDS REVIEW" "COMPLETE"; do
  count=$(grep -rl "status: $status" .sandpiper/tasks/ 2>/dev/null | wc -l | tr -d ' ')
  echo "$status: $count"
done
```

### Bulk update task statuses

```bash
TS=$(date -Iseconds)
sed -i '' "s/status: IN PROGRESS/status: NEEDS REVIEW/" .sandpiper/tasks/PROJECT/TASK.md
sed -i '' "s/updated_at: .*/updated_at: $TS/" .sandpiper/tasks/PROJECT/TASK.md
```

## Workflow Tips

### Pick up related test tickets alongside implementation tickets
When doing TDD, pick up the relevant test subtask (e.g., "FIFO manager unit tests") at the same time as the implementation task. This keeps the test-first discipline honest and ensures tests are written before or alongside the code.

### Use `date -Iseconds` for timestamps
Always use `date -Iseconds` when generating `created_at` and `updated_at` timestamps. This produces ISO 8601 format with timezone offset.

### Batch ticket operations with shell loops
When picking up or completing multiple related tasks, use shell loops to avoid repetitive manual edits:
```bash
TS=$(date -Iseconds)
for f in .sandpiper/tasks/SHR/SHR-1/SHR-*.md; do
  sed -i '' "s/status: NOT STARTED/status: IN PROGRESS/" "$f"
  sed -i '' "s/assignee: UNASSIGNED/assignee: AGENT/" "$f"
  sed -i '' "s/updated_at: .*/updated_at: $TS/" "$f"
done
```

### Commit ticket status updates alongside code changes
When committing code that implements a task, include the ticket status update in the same commit or a follow-up commit. Reference task keys in commit messages with `Refs: SHR-1, SHR-2`.
