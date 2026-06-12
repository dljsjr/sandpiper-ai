# Trail command reference

This reference describes the `trail` command surface.

## Global syntax

```text
trail [options] [command]
```

## Global options

| Option                 | Description                                                                  |
| ---------------------- | ---------------------------------------------------------------------------- |
| `-V, --version`        | Print the Trail version.                                                     |
| `-d, --dir <path>`     | Directory containing `.sandpiper/tasks`; defaults to the current directory.  |
| `-f, --format <format>` | Output format: `raw`, `json`, or `toon`.                                     |
| `-h, --help`           | Show help.                                                                   |

## Output formats

| Format | Use for                                      |
| ------ | -------------------------------------------- |
| `raw`  | Human-readable command output and Markdown.  |
| `json` | Scripts and tools that consume JSON.         |
| `toon` | Token-efficient structured output for agents. |

## `trail task`

Task commands create, query, mutate, move, complete, and archive work items.

```text
trail task [command]
```

### `trail task create`

Creates a task, bug, or subtask.

```text
trail task create [options]
```

| Option                  | Description                                      |
| ----------------------- | ------------------------------------------------ |
| `-p, --project <key>`   | Project key, such as `APP`.                      |
| `-t, --title <title>`   | Non-empty, single-line task title.               |
| `-k, --kind <kind>`     | `TASK`, `BUG`, or `SUBTASK`; default is `TASK`.  |
| `--priority <priority>` | `LOW`, `MEDIUM`, or `HIGH`; default is `MEDIUM`. |
| `--reporter <reporter>` | Freeform reporter string; default is `USER`.     |
| `--parent <key>`        | Parent task key; required for `SUBTASK`.         |
| `--depends-on <keys>`   | Comma-separated dependency keys.                 |
| `--blocked-by <keys>`   | Comma-separated blocking task keys.              |
| `--related <keys>`      | Comma-separated related task keys.               |
| `--desc <text>`         | Task body text.                                  |

### `trail task list`

Lists tasks with optional filters.

```text
trail task list [options]
```

| Option                      | Description                                           |
| --------------------------- | ----------------------------------------------------- |
| `-p, --project <key>`       | Filter by project key.                                |
| `-s, --status <status>`     | Filter by status.                                     |
| `-k, --kind <kind>`         | Filter by kind.                                       |
| `--priority <priority>`     | Filter by priority.                                   |
| `-a, --assignee <assignee>` | Filter by assignee.                                   |
| `--parent <key>`            | Filter subtasks of a parent.                          |
| `--top-level`               | Show only top-level tasks.                            |
| `--subtasks-only`           | Show only subtasks.                                   |
| `--sort <field>`            | Sort by `relevance`, `key`, `priority`, `status`, `createdAt`, or `updatedAt`. |
| `--desc`                    | Sort descending.                                      |
| `--limit <n>`               | Limit results.                                        |
| `-q, --search <text>`       | Full-text search in task files.                       |
| `--regex`                   | Treat the search as a JavaScript regex, or ripgrep regex with `--ripgrep`. |
| `--ripgrep`                 | Use ripgrep instead of the built-in search backend.   |

### `trail task show`

Shows one task.

```text
trail task show [options] <key>
```

Common option:

| Option            | Description                                      |
| ----------------- | ------------------------------------------------ |
| `--metadata-only` | Show metadata without the full task body and subtasks. |

### `trail task summary`

Shows a status and priority breakdown.

```text
trail task summary [options]
```

| Option                | Description                   |
| --------------------- | ----------------------------- |
| `-p, --project <key>` | Limit summary to a project.   |
| `-q, --search <text>` | Limit summary by text search. |

### `trail task update`

Updates fields on one task or a filtered set.

```text
trail task update [options] [key]
```

| Option                      | Description                                      |
| --------------------------- | ------------------------------------------------ |
| `-s, --status <status>`     | Set status.                                      |
| `-a, --assignee <assignee>` | Set assignee to a freeform string.               |
| `--priority <priority>`     | Set priority.                                    |
| `--resolution <resolution>` | Set `DONE` or `WONTFIX`.                         |
| `-t, --title <title>`       | Set non-empty, single-line title.                |
| `--reporter <reporter>`     | Set reporter to a freeform string.               |
| `--depends-on <keys>`       | Set dependencies; pass an empty string to clear. |
| `--blocked-by <keys>`       | Set blockers; pass an empty string to clear.     |
| `--related <keys>`          | Set related keys; pass an empty string to clear. |
| `--desc <text>`             | Set task body text.                              |
| `-i, --interactive`         | Open the task in `$EDITOR`.                      |
| `-p, --project <key>`       | Bulk filter by project.                          |
| `--filter-status <status>`  | Bulk filter by current status.                   |
| `-q, --search <text>`       | Bulk full-text search filter.                    |
| `--regex`                   | Use regex search.                                |
| `--ripgrep`                 | Use ripgrep search.                              |
| `--bulk`                    | Confirm intent for keyless bulk mutation.        |

### `trail task pickup`

Sets task status to `IN PROGRESS` and assigns the task. The assignee defaults to `AGENT`.

```text
trail task pickup [options] [key]
```

| Option                      | Description                                  |
| --------------------------- | -------------------------------------------- |
| `-a, --assignee <assignee>` | Freeform assignee string; default is `AGENT`. |

Also supports the same bulk filters as `task update`: `--project`, `--filter-status`, `--search`, `--regex`, and `--ripgrep`. Keyless bulk pickup requires `--bulk`.

### `trail task complete`

Moves tasks through the completion flow.

```text
trail task complete [options] [key]
```

| Option                     | Description                                                 |
| -------------------------- | ----------------------------------------------------------- |
| `--final`                  | Set status to `COMPLETE` instead of `NEEDS REVIEW`.         |
| `--resolution <resolution>` | `DONE` or `WONTFIX`; required with `--final`.              |
| `-p, --project <key>`      | Bulk filter by project.                                     |
| `--filter-status <status>` | Bulk filter by current status.                              |
| `-q, --search <text>`      | Bulk full-text search filter.                               |
| `--regex`                  | Use regex search.                                           |
| `--ripgrep`                | Use ripgrep search.                                         |
| `--bulk`                   | Confirm intent for keyless bulk mutation.                   |

### `trail task move`

Moves a task between projects, changes its kind, or reparents it.

```text
trail task move [options] <key>
```

| Option                | Description                                |
| --------------------- | ------------------------------------------ |
| `-p, --project <key>` | Target project; causes a re-key.           |
| `-k, --kind <kind>`   | New kind: `TASK`, `BUG`, or `SUBTASK`.     |
| `--parent <key>`      | New parent; required when kind is `SUBTASK`. |

### `trail task archive`

Moves completed tasks to an archive directory.

```text
trail task archive [options]
```

| Option                | Description                         |
| --------------------- | ----------------------------------- |
| `-p, --project <key>` | Archive completed tasks in one project. |
| `--list`              | List archived tasks instead of archiving. |

## `trail project`

Project commands manage project metadata under `.sandpiper/tasks/<PROJECT>/PROJECT.md`.

| Command                    | Description                                      |
| -------------------------- | ------------------------------------------------ |
| `trail project list`       | List projects with task counts and metadata.     |
| `trail project show <key>` | Show one project's metadata.                     |
| `trail project create <key>` | Create project metadata.                       |
| `trail project update <key>` | Update project metadata.                       |

### `trail project create`

```text
trail project create [options] <key>
```

| Option                         | Description                              |
| ------------------------------ | ---------------------------------------- |
| `--name <name>`                | Human-readable project name.             |
| `--description <description>`  | One-line project description.            |
| `--when-to-read <text>`        | Routing hint used by agent workflows.    |

### `trail project update`

```text
trail project update [options] <key>
```

| Option                         | Description                              |
| ------------------------------ | ---------------------------------------- |
| `--name <name>`                | Set human-readable project name.         |
| `--description <description>`  | Set one-line project description.        |
| `--when-to-read <text>`        | Set routing hint used by agent workflows. |
| `--status <status>`            | Set project status: `active`, `archived`, or `paused`. |
| `-i, --interactive`            | Open `PROJECT.md` in `$EDITOR`.          |

## `trail storage`

Storage commands initialize, migrate, and sync non-inline task stores.

| Command                 | Description                                               |
| ----------------------- | --------------------------------------------------------- |
| `trail storage init`    | Initialize task storage for the configured mode.          |
| `trail storage migrate` | Move inline tasks to separate-branch or external storage. |
| `trail storage sync`    | Pull remote task changes, then push local changes.        |
| `trail storage pull`    | Pull remote task branch changes.                          |
| `trail storage push`    | Push local task branch changes.                           |

## `trail index`

Index commands operate on the derived task index.

| Command              | Description                              |
| -------------------- | ---------------------------------------- |
| `trail index update` | Scan task files and rebuild the index.   |
