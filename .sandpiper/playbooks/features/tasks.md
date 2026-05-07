---
name: Task Management
read_when: sandpiper-tasks, task CLI, tasks skill, .sandpiper/tasks, task storage, task index, index.toon, storage init, storage migrate, storage sync, task create, task complete
---

# Task Management

Read this before changing the task CLI, task storage, task skills, or task docs.

## Key Rules

- Use the `sandpiper-tasks` CLI for task data; do not edit `.sandpiper/tasks/**` directly except for exceptional repair work.
- Bugs are top-level tasks, not subtasks.
- `index.toon` is derived state. Task files on disk are the source of truth.
- Storage behavior must support inline, separate-branch, and external-repo modes.
- Tests must not touch real user state or production task stores.
- Keep `packages/resources/skills/sandpiper/tasks/references/storage.md` in sync with public storage docs when storage behavior changes.

## References

- Public feature overview: `docs/features/tasks/README.md`
- Storage guide: `docs/features/tasks/storage-guide.md`
- Architecture: `docs/features/tasks/architecture.md`
- CLI package: `packages/sandpiper-tasks-cli/README.md`
- Skill spec: `packages/resources/skills/sandpiper/tasks/references/SPEC.md`
