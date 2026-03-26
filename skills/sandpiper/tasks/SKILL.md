---
name: tasks
description: >-
  Create, update, query, and organize project work items (tasks, bugs, subtasks) as
  markdown files with YAML frontmatter. Use when the user asks to create a ticket or
  task, track work, check task status, assign work, manage a backlog, or organize
  project work. Also use when the user asks things like "what's left to do", "what am
  I working on", "mark this as done", "create a bug for this", "what tasks are in
  progress", "show me the backlog", or "what's the status of the project". Use for
  reviewing tickets, filtering tasks by status or priority, doing code reviews against
  task acceptance criteria, or querying the task board. Tasks are stored in the local
  project's .sandpiper/tasks directory.
compatibility: Requires a local .sandpiper/tasks directory in the project. Uses ripgrep (rg) for full-text search.
---

# Task Management Skill

Manage project work items as markdown files with YAML frontmatter, stored in the local project's `.sandpiper/tasks` directory.

For the full normative specification, see [references/SPEC.md](references/SPEC.md). This skill document provides operational guidance and quick reference.

## Typical Workflows

### Starting a new feature

1. Create a task: `task create -p SHR -t "Implement feature X" --priority HIGH --reporter USER`
2. Pick it up: `task pickup SHR-1`
3. If the work breaks down into steps, create subtasks: `task create -p SHR -t "Write parser" -k SUBTASK --parent SHR-1 --reporter AGENT`
4. Work, committing with `Refs: SHR-1` in commit messages

### Discovering a bug during implementation

Bugs found while working on a task are their own top-level work items, not subtasks — because bugs have independent lifecycle and priority, and a subtask implies "part of the parent's scope." Link them instead:

1. `task create -p SHR -t "Race condition in FIFO reader" -k BUG --priority HIGH --reporter AGENT`
2. `task update SHR-1 --blocked-by SHR-5` (if the bug blocks the original task)

### Finishing work

1. Mark as ready for review: `task complete SHR-1` (sets status to NEEDS REVIEW)
2. After the user confirms: `task complete SHR-1 --final --resolution DONE`
3. If the work is no longer needed: `task complete SHR-1 --final --resolution WONTFIX`

### Checking project status

- `task summary -p SHR` — status/priority breakdown at a glance
- `task list -s IN_PROGRESS` — what's actively being worked on
- `task list -s NOT_STARTED --priority HIGH` — high-priority backlog items

## CLI Tool

The `sandpiper-tasks` CLI is the primary interface for task operations. It is bundled as a standalone JS file at `scripts/sandpiper-tasks` relative to this skill's directory.

```bash
sandpiper-tasks <command>

# Or with explicit directory:
sandpiper-tasks --dir /path/to/project <command>
```

### Global Options

| Flag | Description |
|------|-------------|
| `-d, --dir <path>` | Path to directory containing `.sandpiper/tasks` (defaults to cwd) |
| `-f, --format <fmt>` | Output format: `raw`, `json`, `toon` |
| `--no-save` | Skip disk writes and index update; output only (implies `--format raw`) |

## Common Operations

### Create a task

```bash
sandpiper-tasks task create -p SHR -t "Implement feature X" --priority HIGH --reporter USER
sandpiper-tasks task create -p SHR -t "Fix the bug" -k BUG --priority HIGH --reporter AGENT
sandpiper-tasks task create -p SHR -t "Write tests" -k SUBTASK --parent SHR-1 --reporter AGENT
```

### Pick up a task (assign to AGENT, set IN PROGRESS)

```bash
sandpiper-tasks task pickup SHR-1
sandpiper-tasks task pickup -p SHR --filter-status NOT_STARTED    # bulk
```

### Complete a task

```bash
sandpiper-tasks task complete SHR-1                              # → NEEDS REVIEW
sandpiper-tasks task complete SHR-1 --final --resolution DONE    # → COMPLETE
sandpiper-tasks task complete SHR-1 --final --resolution WONTFIX # → COMPLETE (won't fix)
```

### Update task fields

```bash
sandpiper-tasks task update SHR-1 --status IN_PROGRESS --assignee AGENT
sandpiper-tasks task update SHR-1 --priority LOW
sandpiper-tasks task update SHR-1 -t "New title"                 # rename
sandpiper-tasks task update SHR-1 --desc "New description text"  # set description
sandpiper-tasks task update SHR-1 --depends-on SHR-2,SHR-3       # set dependencies
sandpiper-tasks task update SHR-1 --related ""                   # clear relationships
sandpiper-tasks task update SHR-1 -i                             # open in $EDITOR
sandpiper-tasks task update SHR-1 -i --status IN_PROGRESS        # pre-apply fields, then edit
sandpiper-tasks task update -p SHR --filter-status IN_PROGRESS --assignee USER  # bulk
```

### Move tasks

```bash
sandpiper-tasks task move SHR-1 -k BUG                           # convert TASK → BUG
sandpiper-tasks task move SHR-3 -k TASK                           # promote SUBTASK → TASK
sandpiper-tasks task move SHR-5 -k SUBTASK --parent SHR-1         # demote to subtask
sandpiper-tasks task move SHR-1 -p CLI                            # move to CLI project (re-keys)
sandpiper-tasks task move SHR-1 -p CLI -k BUG                    # move + convert in one step
```

Moving across projects re-keys the task and all its subtasks, creates `.moved` tombstone files, and updates all inbound references in other task files.

### Query tasks

```bash
sandpiper-tasks task list                                        # all tasks
sandpiper-tasks task list -p SHR --top-level                     # top-level SHR tasks
sandpiper-tasks task list -s NOT_STARTED --priority HIGH         # high priority not started
sandpiper-tasks task list -q "FIFO"                              # full-text search
sandpiper-tasks task show SHR-1                                  # full detail + subtasks
sandpiper-tasks task summary                                     # status/priority breakdown
sandpiper-tasks task summary -p SHR                              # project-scoped summary
```

### Projects

```bash
sandpiper-tasks project list                                     # list all projects
sandpiper-tasks project create SHR                               # create new project
```

### Archive completed tasks

```bash
sandpiper-tasks task archive                                     # archive all completed tasks
sandpiper-tasks task archive -p SHR                              # archive only SHR completed tasks
sandpiper-tasks task archive --list                              # list already-archived tasks
sandpiper-tasks --no-save task archive                           # dry run (show what would be archived)
```

Archiving moves completed task files (and their subtask directories) to an `archive/` subdirectory within each project. Archived tasks are excluded from normal queries but preserved in full. Use `--list` to see what's been archived.

### Index management

```bash
sandpiper-tasks index update                                     # rebuild index
```

### Structured output

```bash
sandpiper-tasks -f json task list -p SHR --top-level             # JSON array
sandpiper-tasks -f toon task show SHR-1                          # TOON format
sandpiper-tasks -f raw task show SHR-1                           # raw markdown
sandpiper-tasks --no-save task create -p SHR -t "Preview"        # dry run
```

## CLI-First Operations

Use the `sandpiper-tasks` CLI for all task operations rather than editing files directly. The CLI maintains the index (which powers fast queries and counter management), enforces validation rules (like requiring a resolution when completing), and keeps formatting consistent. Without the CLI, it's easy to create tasks with missing fields, duplicate numbers, or stale indexes.

Direct file editing is allowed — the index detects out-of-band changes — but save it for exceptional cases like bulk description edits or corruption recovery.

## Task Hierarchy Rules

- `TASK` and `BUG` are always top-level (directly under the project directory)
- `SUBTASK` is a child of a `TASK` or `BUG` (inside the parent's subtask directory)
- `SUBTASK` cannot have its own subtasks (max depth is one level)
- Bugs are always top-level, never subtasks — see "Discovering a bug during implementation" above for the reasoning

## Resolution and Completion

Tasks are never deleted — they're completed with a resolution. This preserves the audit trail so you can always understand what was planned, what was done, and what was abandoned.

- `DONE` — work completed successfully
- `WONTFIX` — task is no longer valid or will not be addressed
- Resolution is required when completing a task (`--final` flag)

## Assignee Conventions

- `UNASSIGNED` — no one is working on this
- `USER` — the user is working on this
- `AGENT` — the agent is working on this
- When the user asks you to create a task, set `--reporter USER`
- When you surface a work item yourself, set `--reporter AGENT`
- When you pick up a task: `task pickup <key>`
- When you finish a task: `task complete <key>` (for review) or `task complete <key> --final --resolution DONE`

## Activity Log

Every modification to a task (excluding creation) automatically appends an entry to the task's activity log — a structured footer at the end of the task file. Each entry records the timestamp and what changed:

```markdown
---

# Activity Log

## 2026-03-21T09:00:00.000Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-21T10:00:00.000Z

- **description**: added (3 lines)
```

The activity log is maintained automatically by the CLI. No manual action is required.

## History Diffs

Full content diffs for every task modification are stored in:

```
.sandpiper/tasks/history/<KEY>/<TIMESTAMP>.diff
```

These are standard unified diffs — readable by any diff tool and useful for auditing the full evolution of a task's content, including description changes that the activity log only summarizes.

```bash
# View a task's history
ls .sandpiper/tasks/history/SHR-1/

# Read a specific diff
cat .sandpiper/tasks/history/SHR-1/2026-03-21T09-00-00.000Z.diff
```

## Workflow Tips

### Use `date -Iseconds` for manual timestamp edits
If editing task files directly, use `date -Iseconds` for `updated_at`.

### Commit ticket references in version control
Reference task keys in commit messages: `Refs: SHR-1, SHR-2`

### Use structured output for scripting
Pipe `--format json` to `jq` for scripting:
```bash
sandpiper-tasks -f json task list -s IN_PROGRESS | jq '.[].key'
```
