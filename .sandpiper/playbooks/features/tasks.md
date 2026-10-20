---
name: Task Management
read_when: Trail, trail CLI, sandpiper-tasks compatibility, task CLI, tasks skill, .sandpiper/tasks, task storage, task index, index.toon, storage init, storage migrate, storage sync, task create, task complete
---

# Task Management

Read this before changing the task CLI, task storage, task skills, or task docs.

## Key Rules

- Use the `trail` CLI for task data; do not edit `.sandpiper/tasks/**` directly except for exceptional repair work.
- Bugs are top-level tasks, not subtasks.
- `index.toon` is derived state. Task files on disk are the source of truth.
- Storage behavior must support inline, separate-branch, and external-repo modes.
- Tests must not touch real user state or production task stores.
- Author current Trail product documentation in the standalone Trail repository. Keep `docs/features/tasks/**` focused on Sandpiper integration, not another product manual.
- The tasks skill runs the helper at `packages/resources/skills/sandpiper/tasks/scripts/trail`.
- `bun run build` rebuilds `packages/trail/dist/trail` and refreshes the skill helper copy.
- Keep the task skill's local references aligned with the bundled helper behavior.

## References

- Public feature overview: `docs/features/tasks/README.md`
- Storage guide: `docs/features/tasks/storage-guide.md`
- Documentation ownership: `docs/features/tasks/architecture.md`
- Board adoption: `.sandpiper/docs/specs/trail-board-adoption.md`
- Legacy Trail CLI package: `packages/trail/README.md`
- Skill spec: `packages/resources/skills/sandpiper/tasks/references/SPEC.md`
