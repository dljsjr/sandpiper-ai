# Getting started with Trail

This tutorial walks through a small Trail project from setup to completion. You will create a project, create a task, inspect it, pick it up, and complete it.

## Before you begin

Install Trail or use it through `npx`:

```bash
npm install -g @sandpiper-ai/trail
trail --help
```

If you do not want a global install, replace `trail` in the examples with `npx @sandpiper-ai/trail`.

## 1. Create a sandbox repository

Use a temporary directory so the tutorial does not touch an existing project:

```bash
mkdir trail-demo
cd trail-demo
git init
mkdir -p .sandpiper/tasks
```

Trail stores task files under `.sandpiper/tasks/`. Create that directory before running task or project commands in a new repository.

## 2. Create a project

Trail groups tasks by project key. Create a `DEMO` project:

```bash
trail project create DEMO \
  --name "Demo Project" \
  --description "A small Trail tutorial project" \
  --when-to-read "Use for Trail tutorial examples"
```

You should now have project metadata at `.sandpiper/tasks/DEMO/PROJECT.md`.

Check the project list:

```bash
trail project list
```

## 3. Create your first task

Create a task in the `DEMO` project:

```bash
trail task create -p DEMO \
  -t "Try the Trail task lifecycle" \
  --priority MEDIUM \
  --reporter USER \
  --desc "Create, pick up, and complete one tutorial task."
```

Trail prints the new task key, such as `DEMO-1`, and the path to the Markdown file it wrote.

## 4. Inspect the task

List tasks in the project:

```bash
trail task list -p DEMO
```

Show the full task detail:

```bash
trail task show DEMO-1
```

The task starts as `NOT STARTED` and is assigned to `UNASSIGNED`.

## 5. Pick up the task

Picking up a task marks it as in progress and assigns it to `AGENT`:

```bash
trail task pickup DEMO-1
```

Check the result:

```bash
trail task show DEMO-1 --metadata-only
```

## 6. Mark it ready for review

Trail uses a two-step completion flow. First mark the work ready for review:

```bash
trail task complete DEMO-1
```

The task status becomes `NEEDS REVIEW`.

## 7. Finalize it

After review, finalize the task with a resolution:

```bash
trail task complete DEMO-1 --final --resolution DONE
```

Use `WONTFIX` instead of `DONE` when the work is intentionally abandoned.

## 8. Archive completed work

Archive completed tasks to keep the active list focused:

```bash
trail task archive -p DEMO
```

Archived tasks move under the project archive directory and no longer appear in normal task lists.

You can list archived tasks with:

```bash
trail task archive --list
```

## What you created

The tutorial created a `.sandpiper/tasks/` tree containing:

- project metadata in `DEMO/PROJECT.md`
- a task Markdown file for `DEMO-1`
- history and activity-log data for task changes
- a derived `index.toon` cache that Trail can rebuild

Next, read [Workflows](workflows.md) for common day-to-day operations or [Storage](storage.md) if you want tasks to live on a dedicated branch or external repository.
