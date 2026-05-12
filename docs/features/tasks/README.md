# How to track work with Sandpiper tasks

Trail stores project work items as markdown files with YAML frontmatter. The files are easy to inspect directly, but the CLI is the normal way to create, update, move, complete, and archive tasks.

Sandpiper currently keeps `sandpiper-tasks` as a compatibility command, but new docs and examples use `trail`.

## Create a project task

```bash
trail task create -p AGENT -t "Implement feature X" --priority HIGH --reporter USER
```

The CLI allocates the next task key, writes the task file, and updates the index.

## Pick up work

```bash
trail task pickup AGENT-123
```

Picking up a task sets it to `IN_PROGRESS` and assigns it to `AGENT`.

## List and inspect tasks

```bash
trail task list
trail task list -p AGENT --top-level
trail task list -s NOT_STARTED --priority HIGH
trail task show AGENT-123
trail task summary
```

Use structured output when scripting:

```bash
trail -f json task list -s IN_PROGRESS
trail -f toon task show AGENT-123 --metadata-only
```

## Update a task

```bash
trail task update AGENT-123 --status IN_PROGRESS
trail task update AGENT-123 --priority MEDIUM
trail task update AGENT-123 --depends-on AGENT-122
```

For larger description edits, use the interactive editor mode:

```bash
trail task update AGENT-123 -i
```

## Complete a task

Completion is a two-step workflow. First mark the task ready for review:

```bash
trail task complete AGENT-123
```

After review, finalize it with a resolution:

```bash
trail task complete AGENT-123 --final --resolution DONE
```

Use `WONTFIX` when the work is no longer needed.

## Archive completed tasks

```bash
trail task archive
trail task archive -p AGENT
trail task archive --list
```

Archiving moves completed task files to an archive directory while preserving their history.

## Storage modes

By default, task files live inline on the current branch. For active projects, this can create VCS noise. Sandpiper can also store tasks on a separate branch or in an external repository.

See [Task storage modes](storage-guide.md) for setup and migration commands.

## File format and architecture

Tasks are markdown files with structured frontmatter and an append-only activity log. The index is derived state; task files on disk are the source of truth.

See [Task storage architecture](architecture.md) for the design rationale and [the Trail package README](../../../packages/trail/README.md) for standalone CLI usage.
