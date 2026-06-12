# Trail workflows

This guide shows common ways to use Trail during real project work.

## Choose the target directory

Trail looks for `.sandpiper/tasks/` in the current working directory by default. Create that directory before running task or project commands in a new repository:

```bash
mkdir -p .sandpiper/tasks
```

Use `--dir` when running Trail from somewhere else:

```bash
trail --dir /path/to/project task list
trail --dir /path/to/project task create -p APP -t "Fix startup bug"
```

## Create a project

Projects group tasks by key. Project keys are uppercase identifiers such as `APP`, `DOCS`, or `TOOLS`.

```bash
trail project create APP \
  --name "Application" \
  --description "User-facing application work" \
  --when-to-read "Use for application feature, bug, and release work"
```

Inspect projects with:

```bash
trail project list
trail project show APP
```

Update project metadata with:

```bash
trail project update APP --status paused
trail project update APP --description "Current app and release work"
trail project update APP -i
```

## Create tasks, bugs, and subtasks

Create a normal task:

```bash
trail task create -p APP -t "Add import progress indicator" --priority MEDIUM --reporter USER
```

Create a bug:

```bash
trail task create -p APP -k BUG -t "Import crashes on empty files" --priority HIGH --reporter USER
```

Create a subtask under an existing task or bug:

```bash
trail task create -p APP -k SUBTASK --parent APP-12 -t "Add importer tests" --reporter AGENT
```

Use bugs for defects with independent priority and lifecycle. Use subtasks for planned breakdown inside a parent task.

## Add task relationships

Relationships are comma-separated task keys:

```bash
trail task create -p APP -t "Ship importer" --depends-on APP-12,APP-13
trail task update APP-20 --blocked-by APP-18
trail task update APP-20 --related APP-7,APP-8
```

Clear a relationship field by passing an empty string:

```bash
trail task update APP-20 --blocked-by ""
```

## Find work

List all tasks:

```bash
trail task list
```

Filter by project, status, kind, priority, or assignee:

```bash
trail task list -p APP --top-level
trail task list -s NOT_STARTED --priority HIGH
trail task list -k BUG -s NEEDS_REVIEW
trail task list -a AGENT
```

Search task files:

```bash
trail task list -q "importer"
trail task list -q "timeout|race" --regex
trail task list -q "frontmatter" --ripgrep
```

Show a task:

```bash
trail task show APP-12
trail task show APP-12 --metadata-only
```

Summarize task state:

```bash
trail task summary
trail task summary -p APP
```

## Use structured output

Use JSON or TOON when scripting:

```bash
trail -f json task list -s IN_PROGRESS
trail -f toon task show APP-12 --metadata-only
trail -f json project list
```

Use `--format json` or `--format toon` on read commands when scripts need structured task data:

```bash
trail -f json task list -p APP --top-level
```

## Pick up and complete work

Pick up one task:

```bash
trail task pickup APP-12
```

Pick up a filtered set:

```bash
trail task pickup -p APP --filter-status NOT_STARTED --bulk
```

Mark work ready for review:

```bash
trail task complete APP-12
```

Finalize reviewed work:

```bash
trail task complete APP-12 --final --resolution DONE
```

Complete abandoned or obsolete work with `WONTFIX`:

```bash
trail task complete APP-12 --final --resolution WONTFIX
```

Bulk completion requires filters:

```bash
trail task complete -p APP --filter-status NEEDS_REVIEW --final --resolution DONE --bulk
```

## Edit task details

Set scalar fields:

```bash
trail task update APP-12 --status IN_PROGRESS
trail task update APP-12 --assignee "Doug Stephen"
trail task update APP-12 --priority LOW
trail task update APP-12 -t "Import progress UI"
```

Set the description body directly:

```bash
trail task update APP-12 --desc "Show progress while large files import."
```

Open a task in your editor for larger edits:

```bash
trail task update APP-12 -i
```

You can pre-apply field changes before opening the editor:

```bash
trail task update APP-12 -i --status IN_PROGRESS
```

## Move or reclassify tasks

Convert a task into a bug:

```bash
trail task move APP-12 -k BUG
```

Move a task to another project. Trail re-keys the task and updates references:

```bash
trail task move APP-12 -p DOCS
```

Demote a task to a subtask:

```bash
trail task move APP-12 -k SUBTASK --parent APP-10
```

Promote a subtask to a top-level task:

```bash
trail task move APP-13 -k TASK
```

## Archive completed tasks

Archive all completed tasks:

```bash
trail task archive
```

Archive one project:

```bash
trail task archive -p APP
```

List archived tasks:

```bash
trail task archive --list
```

## Rebuild the index

The index is derived state. Rebuild it if you changed task files outside Trail or suspect the cache is stale:

```bash
trail index update
```
