---
name: tasks
description: Create, update, query, and organize project work items (tasks, bugs, subtasks) as markdown files with YAML frontmatter. Use when the user asks to create a ticket, track work, check task status, assign work, or manage a backlog. Also use when reviewing tickets, filtering tasks by status (e.g., NEEDS REVIEW, IN PROGRESS), doing code reviews against task acceptance criteria, or querying the task board for sprint status. Tasks are stored in the local project's .sandpiper/tasks directory.
allowed-tools: read write bash
compatibility: Requires a local .sandpiper/tasks directory in the project. Uses ripgrep (rg) for full-text search.
---

# Task Management Skill

Manage project work items as markdown files with YAML frontmatter, stored in the local project's `.sandpiper/tasks` directory.

For the full normative specification (RFC 2119), see [references/SPEC.md](references/SPEC.md). This skill document provides operational guidance and quick reference.

## CLI Tool

The `sandpiper-tasks` CLI is the primary interface for task operations. It is bundled as a compiled binary at `skills/tasks/scripts/sandpiper-tasks` relative to the Pi Package root.

```bash
# From the project root:
./skills/tasks/scripts/sandpiper-tasks <command>

# Or with explicit directory:
./skills/tasks/scripts/sandpiper-tasks --dir /path/to/project <command>
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

Task operations SHOULD almost always go through the `sandpiper-tasks` CLI. The CLI maintains the index, enforces validation (e.g., resolution required for COMPLETE), and ensures formatting consistency.

Direct file editing is allowed (the index detects out-of-band changes) but is strongly discouraged for routine operations. Use direct editing only for exceptional cases like bulk body text edits or recovery from corruption.

## Task Hierarchy Rules

- `TASK` and `BUG` are ALWAYS top-level (directly under the project directory)
- `SUBTASK` MUST be a child of a `TASK` or `BUG` (inside the parent's subtask directory)
- `SUBTASK` CANNOT have its own subtasks (max depth is one level)
- A bug discovered while working on a task is a separate top-level `BUG`, NOT a `SUBTASK` — use `--related` or `--blocked-by` to link them

## Resolution and Completion

- Tasks MUST NOT be deleted. Use `--final --resolution WONTFIX` for tasks that are no longer valid.
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
