---
name: tasks
description: >-
  Create, update, query, and organize project work items (tasks, bugs, subtasks)
  tracked under `.sandpiper/tasks` — always go through the bundled CLI, never the
  raw contents of that directory, for lookups and status checks as much as for
  creating or editing. Use this skill whenever the user mentions tasks, tickets,
  backlog, sprints, milestones, todos, or project status; at session start when
  orienting from standup notes that reference tasks, or when `.sandpiper/tasks/`
  is present in the project; or when the user asks to create or complete tasks,
  check what's in progress, assign work, manage a backlog, review tickets, filter
  by status or priority, or query the task board.
compatibility: Requires a local .sandpiper/tasks directory in the project. Uses ripgrep (rg) for full-text search.
---

# Task Management Skill

Manage project work items as markdown files with YAML frontmatter, stored in the local project's `.sandpiper/tasks` directory.

For the full normative specification, see [references/SPEC.md](references/SPEC.md). This skill document provides operational guidance and quick reference.

## Use `trail` for Reads Too, Not Just Writes

The files being plain markdown makes a raw `cat`/`grep`/`Read` look like a harmless shortcut for a quick check — nothing's being written, so what's the risk? But "harmless" isn't something you can judge from outside the skill: `trail` may apply filtering, migration, or side effects a given command doesn't advertise, and the only way to know is to already know the CLI's internals — which is what loading this skill gives you. Treat `trail` as the interface for looking, not just changing. The write-side failure modes of skipping it (missing fields, duplicate task numbers, stale indexes) are covered under [CLI-First Operations](#cli-first-operations) below, but don't read that section as the whole reason — it documents what goes wrong on writes specifically, not why reads matter too.

This isn't just true in principle — it's true even for the narrowest possible read, "what does SHR-14 say," where you already know the exact file path. Subtasks live in a sibling directory (`SHR-14/SHR-15.md`, not inside `SHR-14.md`), so `cat SHR-14.md` silently omits them while `trail task show SHR-14` includes them. And if the task was ever moved, the original path now holds a `.moved` tombstone pointing at its new key — `cat`/`Read` on the old path gets you a redirect stub or a "file not found," while `trail task show` follows it transparently. A single known key is not a safe shortcut; it's the case where the raw file is most likely to be silently incomplete or stale.

## Session Start: Project Routing

Project routing triggers (`whenToRead` fields) are **automatically injected into the system prompt** by the sandpiper system extension at session start. You do not need to run `project list` to get routing context — it is already in your context as an `<available_projects>` block.

If you need the full project list with task counts (e.g., to assess project health or find the right key), run:

```bash
scripts/trail project list
```

Projects with no `PROJECT.md` will appear with empty `whenToRead`. If you create a new project, you MUST provide `--name`, `--description`, and `--when-to-read`.

## Typical Workflows

### Starting a new feature

1. Create a task: `task create -p SHR -t "Implement feature X" --priority HIGH --reporter USER`
2. Pick it up: `task pickup SHR-1` (or `task pickup SHR-1 --assignee "Piper"` for a named assignee)
3. Break the work into subtasks up front, before starting — don't wait to be asked. If the task
   involves 3+ distinct steps, spans multiple sessions, or has pieces that could block or fail
   independently, create subtasks now: `task create -p SHR -t "Write parser" -k SUBTASK --parent
   SHR-1 --reporter AGENT`. A parent task with only a vague one-line title and no subtask
   breakdown after you've started is usually a sign the work wasn't actually planned, not that it
   was simple. Skip this for genuinely single-step tasks — a one-line fix doesn't need a
   breakdown just to have one.
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

The `trail` CLI is the primary interface for task operations. It is bundled at `scripts/trail` relative to this skill's directory. **Resolve this path against the skill directory to get the absolute path before running commands.**

Sandpiper also bundles `scripts/sandpiper-tasks` as a compatibility entrypoint during the Trail migration. Prefer `scripts/trail` for new examples and workflows.

```bash
scripts/trail <command>

# Or with explicit directory:
scripts/trail --dir /path/to/project <command>
```

### Global Options

| Flag | Description |
|------|-------------|
| `-d, --dir <path>` | Path to directory containing `.sandpiper/tasks` (defaults to cwd) |
| `-f, --format <fmt>` | Output format: `raw`, `json`, `toon` |

Both work before or after the subcommand, and interleave freely with subcommand-specific flags —
`trail -f json task list` and `trail task list -p SHR --top-level --format json` are both valid.
They won't appear in `trail task --help` or `trail task list --help` — Commander (the CLI parsing
library) only surfaces global options at `trail --help`. Their absence from a subcommand's own
`--help` output doesn't mean they're unsupported there.

## Common Operations

### Create a task

```bash
scripts/trail task create -p SHR -t "Implement feature X" --priority HIGH --reporter USER
scripts/trail task create -p SHR -t "Fix the bug" -k BUG --priority HIGH --reporter AGENT
scripts/trail task create -p SHR -t "Write tests" -k SUBTASK --parent SHR-1 --reporter AGENT
scripts/trail task create -p SHR -t "Fix auth bug" -k BUG --priority HIGH --reporter AGENT \
  --blocked-by SHR-2 --depends-on SHR-3                          # set relationships at creation time
```

### Pick up a task (assign and set IN PROGRESS)

```bash
scripts/trail task pickup SHR-1                                # assignee defaults to AGENT
scripts/trail task pickup SHR-1 --assignee "Piper"              # named/freeform assignee
scripts/trail task pickup -p SHR --filter-status NOT_STARTED --bulk  # bulk
```

### Complete a task

```bash
scripts/trail task complete SHR-1                              # → NEEDS REVIEW
scripts/trail task complete SHR-1 --final --resolution DONE    # → COMPLETE
scripts/trail task complete SHR-1 --final --resolution WONTFIX # → COMPLETE (won't fix)
```

### Update task fields

```bash
scripts/trail task update SHR-1 --status IN_PROGRESS --assignee AGENT
scripts/trail task update SHR-1 --priority LOW
scripts/trail task update SHR-1 -t "New title"                 # rename
scripts/trail task update SHR-1 --desc "New description text"  # set description
scripts/trail task update SHR-1 --depends-on SHR-2,SHR-3       # set dependencies
scripts/trail task update SHR-1 --related ""                   # clear relationships
scripts/trail task update SHR-1 -i                             # open in $EDITOR
scripts/trail task update SHR-1 -i --status IN_PROGRESS        # pre-apply fields, then edit
scripts/trail task update -p SHR --filter-status IN_PROGRESS --assignee USER --bulk  # bulk
```

### Move tasks

```bash
scripts/trail task move SHR-1 -k BUG                           # convert TASK → BUG
scripts/trail task move SHR-3 -k TASK                           # promote SUBTASK → TASK
scripts/trail task move SHR-5 -k SUBTASK --parent SHR-1         # demote to subtask
scripts/trail task move SHR-1 -p CLI                            # move to CLI project (re-keys)
scripts/trail task move SHR-1 -p CLI -k BUG                    # move + convert in one step
```

Moving across projects re-keys the task and all its subtasks, creates `.moved` tombstone files, and updates all inbound references in other task files.

### Query tasks

`task list` filters, sorts, and full-text-searches across every task in the project — reach for
these flags before reaching for `grep`/`python`/`jq` over the raw frontmatter. The index behind
these queries already accounts for subtask sibling-directories, `.moved` tombstones, and archived
tasks (excluded by default); a hand-rolled parse of the files has to reinvent all three and will
get at least one of them wrong.

```bash
scripts/trail task list                                        # all tasks
scripts/trail task list -p SHR --top-level                     # top-level SHR tasks
scripts/trail task list -s NOT_STARTED --priority HIGH         # high priority not started
scripts/trail task list -a "Piper"                              # filter by assignee
scripts/trail task list -k BUG -p SHR                            # only bugs in SHR
scripts/trail task list --parent SHR-1                          # subtasks of SHR-1
scripts/trail task list --subtasks-only                         # every subtask, any parent
```

Filters compose: `task list -p SHR -s IN_PROGRESS --priority HIGH -k BUG` is one query, not four.

#### Full-text search

```bash
scripts/trail task list -q "FIFO"                                # BM25 relevance search (default)
scripts/trail task list -q "FIFO" -p SHR                          # scoped to one project
scripts/trail task list -q "race.*condition" --regex             # JS regex search
scripts/trail task list -q 'TODO\(.*\)' --ripgrep                 # ripgrep-backed regex search
scripts/trail task list -q "FIFO" --sort updatedAt --desc         # override the default relevance sort
scripts/trail task list -q "FIFO" --limit 5                       # cap result count
```

Plain `-q` ranks by BM25 relevance, not file order — the closest match comes first. Reach for
`--regex`/`--ripgrep` only when the search itself is a pattern (finding a `TODO(...)` shape, say),
not as a substitute for filtering — `-p`/`-s`/`-k`/`--priority`/`-a`/`--parent` are the filters,
and they combine with `-q` rather than replace it.

Valid `--sort` values: `relevance` (implied by `-q`, invalid without it), `key`, `priority`,
`status`, `createdAt`, `updatedAt`. Default sort is `priority` unless `-q` is present.

#### Inspect one task

```bash
scripts/trail task show SHR-1                                  # full detail + subtasks
scripts/trail task show SHR-1 --metadata-only                  # frontmatter fields only, no body or subtasks
scripts/trail --format toon task show SHR-1 --metadata-only    # structured metadata (minimal context cost)
scripts/trail task summary                                     # status/priority breakdown
scripts/trail task summary -p SHR                              # project-scoped summary
scripts/trail task summary -q "auth"                            # summary of a search's matches
```

Use `task show`/`task list` even when you already know the exact key and could `cat`/`Read` the file directly — see [Use `trail` for Reads Too](#use-trail-for-reads-too-not-just-writes) above for why a single known task is exactly where a raw file read goes silently wrong.

### Bulk operations

`update`, `pickup`, and `complete` accept a filter instead of a single key: `-p/--project`,
`--filter-status`, and `-q/--search` (with `--regex`/`--ripgrep`), combined with `--bulk` to
confirm intent. Omit `--bulk` and the filter runs as a dry run — the CLI reports the match count
and refuses to write, e.g. `Task pickup matched 4 tasks and requires --bulk to modify them.`

```bash
# Preview the match set first (task list uses -s, not --filter-status — see below)
scripts/trail task list -p SHR -s NOT_STARTED

# Then mutate the same set
scripts/trail task pickup -p SHR --filter-status NOT_STARTED --bulk           # pick up everything
scripts/trail task update -p SHR --filter-status IN_PROGRESS --assignee USER --bulk  # reassign a batch
scripts/trail task update -q "auth" --priority HIGH --bulk                    # search-targeted bulk edit
scripts/trail task complete --final --resolution DONE --filter-status NEEDS_REVIEW --bulk  # bulk-complete
```

A batch edit driven by a text search ("bump priority on everything mentioning auth") doesn't need
a script looping over `task list` output — pass the same `-q` straight to `update`/`pickup`/`complete`
with `--bulk`. See [Status filter flag gotcha](#status-filter-flag-gotcha) for the `-s` vs
`--filter-status` naming mismatch between querying and bulk-mutating commands.

### Projects

```bash
scripts/trail project list                                     # list all projects with task counts + metadata
scripts/trail --format toon project list                       # structured output with whenToRead + task counts
scripts/trail project create SHR \
  --name "Shell Relay" \
  --description "Zellij-based shared terminal" \
  --when-to-read "Use for relay extension work"                  # create project (all three flags required)
scripts/trail project show SHR                                 # show PROJECT.md for a project
scripts/trail project update SHR --when-to-read "New trigger"  # update metadata field(s)
scripts/trail project update SHR --status paused                # active, archived, or paused
scripts/trail project update SHR -i                            # open PROJECT.md in $EDITOR
```

### Archive completed tasks

```bash
scripts/trail task archive                                     # archive all completed tasks
scripts/trail task archive -p SHR                              # archive only SHR completed tasks
scripts/trail task archive --list                              # list already-archived tasks
```

Archiving moves completed task files (and their subtask directories) to an `archive/` subdirectory within each project. Archived tasks are excluded from normal queries but preserved in full. Use `--list` to see what's been archived.

### Index management

```bash
scripts/trail index update                                     # rebuild index
```

### Structured output

```bash
scripts/trail -f json task list -p SHR --top-level             # JSON array
scripts/trail -f toon task show SHR-1                          # TOON format
scripts/trail -f raw task show SHR-1                           # raw markdown
scripts/trail task list -p SHR --top-level --format json       # same as the first line — flag order doesn't matter
scripts/trail task show SHR-1 --metadata-only --dir /path/to/project --format toon  # --dir + --format, interleaved with a subcommand flag
```

## CLI-First Operations

Use the `trail` CLI for all task operations rather than editing files directly. The CLI maintains the index (which powers fast queries and counter management), enforces validation rules (like requiring a resolution when completing), and keeps formatting consistent. Without the CLI, it's easy to create tasks with missing fields, duplicate numbers, or stale indexes.

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

## Assignee and Reporter Conventions

Task titles, assignees, and reporters are non-empty, single-line strings. `assignee` and `reporter` are freeform; Trail canonicalizes the conventional tokens `UNASSIGNED`, `USER`, and `AGENT` case-insensitively while preserving other names verbatim.

- `UNASSIGNED` — no one is working on this (assignee only)
- `USER` — the user is working on or reported this
- `AGENT` — an agent is working on or reported this
- Use named assignees/reporters when useful for multi-agent work, e.g. `--assignee "Piper"` or `--reporter "Huginn"`.
- When the user asks you to create a task, set `--reporter USER` unless they request a specific reporter.
- When you surface a work item yourself, set `--reporter AGENT` or your agent name.
- When you pick up a task: `task pickup <key>` or `task pickup <key> --assignee "<name>"`.
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
scripts/trail -f json task list -s IN_PROGRESS | jq '.[].key'
```

### Status filter flag gotcha
`task list` uses `-s/--status`, while bulk mutating commands (like `task complete` / `task update`) use `--filter-status`.

```bash
# Querying
scripts/trail task list -s NEEDS_REVIEW

# Bulk mutation
scripts/trail task complete --final --resolution DONE --filter-status NEEDS_REVIEW --bulk
```

## Task Storage Modes

By default, task files are tracked inline on the current VCS branch alongside code.
Every task operation (create, update, pickup, complete) produces file changes that
appear in `git status` / `jj st`. For active projects this creates significant churn.

To keep task history separate from code history, configure a **separate branch** or
**external repo** in a config file at the project root:

```json
// .sandpiper-tasks.json
{ "version_control": { "mode": { "branch": "tasks" } } }
```

Key fields:

| Field | Default | What it does |
|---|---|---|
| `mode.branch` | `"@"` | `"@"` = inline; any other value = branch name |
| `mode.repo` | omit | External repo URL (cloned to `.sandpiper/tasks/`) |
| `auto_commit` | `false` | Commit to task branch after every mutation |
| `auto_push` | `false` | Push after every auto-commit |

Once configured, bootstrap with:

```bash
# Fresh project — initialise the separate workspace/worktree
scripts/trail --dir /path/to/project storage init

# Existing project — migrate inline tasks onto the separate branch
scripts/trail --dir /path/to/project storage migrate

# Sync with remote
scripts/trail --dir /path/to/project storage sync   # pull then push
scripts/trail --dir /path/to/project storage push
scripts/trail --dir /path/to/project storage pull
```

After `storage init` or `storage migrate`, commit both sides:
- **Main branch:** the file deletions + updated `.gitignore`
- **Task workspace:** the task files

For complete configuration options, backend selection rules (jj workspace vs git
worktree), repair guidance, and auto-commit semantics, read
`references/storage.md`.
