# How to track work with Sandpiper tasks

`sandpiper-tasks` stores project work items as markdown files with YAML frontmatter. The files are easy to inspect directly, but the CLI is the normal way to create, update, move, complete, and archive tasks.

## Create a project task

```bash
sandpiper-tasks task create -p AGENT -t "Implement feature X" --priority HIGH --reporter USER
```

The CLI allocates the next task key, writes the task file, and updates the index.

## Pick up work

```bash
sandpiper-tasks task pickup AGENT-123
```

Picking up a task sets it to `IN_PROGRESS` and assigns it to `AGENT`.

## List and inspect tasks

```bash
sandpiper-tasks task list
sandpiper-tasks task list -p AGENT --top-level
sandpiper-tasks task list -s NOT_STARTED --priority HIGH
sandpiper-tasks task show AGENT-123
sandpiper-tasks task summary
```

Use structured output when scripting:

```bash
sandpiper-tasks -f json task list -s IN_PROGRESS
sandpiper-tasks -f toon task show AGENT-123 --metadata-only
```

## Update a task

```bash
sandpiper-tasks task update AGENT-123 --status BLOCKED
sandpiper-tasks task update AGENT-123 --priority MEDIUM
sandpiper-tasks task update AGENT-123 --depends-on AGENT-122
```

For larger description edits, use the interactive editor mode:

```bash
sandpiper-tasks task update AGENT-123 -i
```

## Complete a task

Completion is a two-step workflow. First mark the task ready for review:

```bash
sandpiper-tasks task complete AGENT-123
```

After review, finalize it with a resolution:

```bash
sandpiper-tasks task complete AGENT-123 --final --resolution DONE
```

Use `WONTFIX` when the work is no longer needed.

## Archive completed tasks

```bash
sandpiper-tasks task archive
sandpiper-tasks task archive -p AGENT
sandpiper-tasks task archive --list
```

Archiving moves completed task files to an archive directory while preserving their history.

## Storage modes

By default, task files live inline on the current branch. For active projects, this can create VCS noise. Sandpiper can also store tasks on a separate branch or in an external repository.

See [Task storage modes](storage-guide.md) for setup and migration commands.

## File format and architecture

Tasks are markdown files with structured frontmatter and an append-only activity log. The index is derived state; task files on disk are the source of truth.

See [Task storage architecture](architecture.md) for the design rationale and [the task CLI package README](../../../packages/sandpiper-tasks-cli/README.md) for implementation details.
