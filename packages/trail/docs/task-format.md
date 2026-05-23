# Trail task format

Trail stores tasks as Markdown files with YAML frontmatter. The files are the source of truth; the CLI maintains derived indexes and history around them.

## Directory layout

A task store lives under `.sandpiper/tasks/`:

```text
.sandpiper/tasks/
├── APP/
│   ├── PROJECT.md
│   ├── APP-1.md
│   ├── APP-2.md
│   └── APP-2/
│       └── APP-3.md
├── DOCS/
│   ├── PROJECT.md
│   └── DOCS-1.md
├── history/
│   └── APP-1/
│       └── 2026-03-24T12-00-00.000Z.diff
└── index.toon
```

Project directories are named by project key. Top-level tasks and bugs live directly inside the project directory. Subtasks live under a directory named after their parent task.

## Project metadata

Each project can have a `PROJECT.md` file:

```markdown
---
name: Application
description: User-facing application work
status: active
when_to_read: Use for application feature, bug, and release work
---
# Application
```

| Field          | Description                                             |
| -------------- | ------------------------------------------------------- |
| `name`         | Human-readable project name.                            |
| `description`  | Short project description.                              |
| `status`       | `active`, `paused`, or `archived`.                      |
| `when_to_read` | Routing hint for agent workflows that use project data. |

## Task file structure

A task file starts with YAML frontmatter, followed by a Markdown body:

```markdown
---
title: "Import progress indicator"
status: NOT STARTED
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-24T00:00:00.000Z
updated_at: 2026-03-24T00:00:00.000Z
depends_on: []
blocked_by: []
related: []
---
# Import progress indicator

Show progress while large files import.
```

## Frontmatter fields

| Field        | Required | Values or format                         | Description                         |
| ------------ | -------- | ---------------------------------------- | ----------------------------------- |
| `title`      | Yes      | Non-empty, single-line string           | Human-readable title.               |
| `status`     | Yes      | `NOT STARTED`, `IN PROGRESS`, `NEEDS REVIEW`, `COMPLETE` | Current lifecycle state. |
| `kind`       | Yes      | `TASK`, `BUG`, `SUBTASK`                 | Work item type.                     |
| `priority`   | Yes      | `LOW`, `MEDIUM`, `HIGH`                  | Relative priority.                  |
| `assignee`   | Yes      | Freeform string; `UNASSIGNED`, `USER`, and `AGENT` are conventional | Current owner.                      |
| `reporter`   | Yes      | Freeform string; `USER` and `AGENT` are conventional | Who reported or requested the work. |
| `created_at` | Yes      | ISO-8601 timestamp                       | Creation time.                      |
| `updated_at` | Yes      | ISO-8601 timestamp                       | Last update time.                   |
| `resolution` | When complete | `DONE`, `WONTFIX`                    | Completion result.                  |
| `depends_on` | No       | List of task keys                        | Work this task depends on.          |
| `blocked_by` | No       | List of task keys                        | Work blocking this task.            |
| `related`    | No       | List of task keys                        | Related work items.                 |

Trail accepts status filter names such as `NOT_STARTED` in CLI options and writes human-readable status values such as `NOT STARTED` in frontmatter.

`title`, `assignee`, and `reporter` must be non-empty, single-line strings. Conventional assignee/reporter tokens are canonicalized case-insensitively (`agent` becomes `AGENT`), while other names are preserved. Trail quotes and escapes freeform values in frontmatter when needed.

## Kinds and hierarchy

| Kind      | Location                         | Notes                                                |
| --------- | -------------------------------- | ---------------------------------------------------- |
| `TASK`    | Project directory                | Top-level planned work.                              |
| `BUG`     | Project directory                | Top-level defect; use for independently prioritized defects. |
| `SUBTASK` | Parent task directory            | One-level child of a task or bug.                    |

Subtasks do not have their own subtasks.

## Resolution and completion

Trail keeps completed tasks instead of deleting them. A completed task has:

```yaml
status: COMPLETE
resolution: DONE
```

or:

```yaml
status: COMPLETE
resolution: WONTFIX
```

Use `DONE` for completed work and `WONTFIX` for abandoned, obsolete, or intentionally skipped work.

## Activity log

Trail appends an activity log to task files when fields change:

```markdown
---

# Activity Log

## 2026-03-24T12:00:00.000Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT
```

The activity log records summarized field changes. Trail also stores full diffs separately.

## History diffs

Trail writes unified diffs for task modifications under:

```text
.sandpiper/tasks/history/<KEY>/<TIMESTAMP>.diff
```

These files preserve the full content change, including Markdown body edits.

## Moved task tombstones

When a task is moved between projects or re-keyed, Trail can leave `.moved` tombstones so future key allocation and reference updates do not accidentally reuse old keys.

## Derived index

`index.toon` is a derived cache. It exists to make listing, search, summaries, and key allocation faster, but task Markdown files remain the source of truth.

Rebuild it with:

```bash
trail index update
```

Do not treat `index.toon` as authoritative task data.
