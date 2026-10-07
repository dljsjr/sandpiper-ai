# Legacy Trail documentation

These local pages describe the executable currently built by Sandpiper's Trail package. It stores task files under `.sandpiper/tasks/`. The pages remain with that executable until consumer cutover.

Current product documentation is authored in the standalone Trail repository under `docs/`. Its configuration and initialization differ from this legacy bundle. Sandpiper's assembly contract requires documentation that matches the executable's revision.

## Start here

- [Getting started](getting-started.md) — create a small task project and move one task through the normal lifecycle.
- [Workflows](workflows.md) — practical guides for common task, project, and archive operations.
- [Storage](storage.md) — keep task files inline, on a dedicated branch, or in a separate repository.
- [Commands](commands.md) — command and option reference.
- [Task format](task-format.md) — task file layout, frontmatter fields, activity logs, and derived index files.

## Related Sandpiper docs

Trail can be used on its own. Sandpiper also builds workflow conventions around Trail for coding-agent sessions. Those integration docs live in the repository-level Sandpiper docs:

- [Sandpiper task management](https://github.com/dljsjr/sandpiper-ai/blob/main/docs/features/tasks/README.md)
- [Sandpiper task storage guide](https://github.com/dljsjr/sandpiper-ai/blob/main/docs/features/tasks/storage-guide.md)
