# Trail CLI

Trail is a plaintext task tracker built on Markdown files with YAML frontmatter. It stores work items in `.sandpiper/tasks/` so humans, agents, and normal filesystem tools can inspect the project backlog without a database service.

Trail is distributed as `@sandpiper-ai/trail` and installs a `trail` executable. Sandpiper may also ship a `sandpiper-tasks` compatibility command during the migration, but `trail` is the standalone package interface.

## Install

```bash
npm install -g @sandpiper-ai/trail
trail --help
```

For one-off use without a global install:

```bash
npx @sandpiper-ai/trail --help
```

## Quick start

Create a task store, then create a task:

```bash
mkdir -p .sandpiper/tasks
trail task create -p APP -t "Implement feature X" --priority HIGH --reporter USER
```

Pick it up, mark it ready for review, then finalize it:

```bash
trail task pickup APP-1
trail task complete APP-1
trail task complete APP-1 --final --resolution DONE
```

Use `WONTFIX` instead of `DONE` when the work is no longer needed.

## Documentation

- [Getting started](docs/getting-started.md) — create a project and walk one task through the lifecycle.
- [Workflows](docs/workflows.md) — common task, project, archive, and query workflows.
- [Storage](docs/storage.md) — inline, separate-branch, and external-repository task storage.
- [Commands](docs/commands.md) — command and option reference.
- [Task format](docs/task-format.md) — Markdown files, frontmatter fields, activity logs, and indexes.

## Common commands

```bash
trail task list
trail task list -p APP --top-level
trail task show APP-1
trail task summary

trail task update APP-1 --priority MEDIUM
trail task move APP-1 -k BUG
trail task archive -p APP

trail project list
trail index update
```

Use structured output for scripts and agent tooling:

```bash
trail -f json task list -s IN_PROGRESS
trail -f toon task show APP-1 --metadata-only
```

## Storage modes

By default, task files live inline on the current branch. For busy repositories, Trail can keep tasks on a separate branch or in an external repository. See [Storage](docs/storage.md) for configuration and migration steps.

## Development

```bash
bun run build    # tsc + bun build -> dist/trail
bun run test     # package Vitest suite
```

Core logic is framework-independent. The CLI layer is a thin Commander wrapper around the task, project, storage, indexing, and formatting modules.
