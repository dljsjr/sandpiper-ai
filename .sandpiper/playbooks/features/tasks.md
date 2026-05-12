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
- Keep `packages/resources/skills/sandpiper/tasks/references/storage.md` in sync with public storage docs when storage behavior changes.
- Keep Trail package docs package-local: `packages/trail/README.md` is the standalone npm package entrypoint. Root `docs/features/tasks/**` covers Sandpiper integration and should link to package docs rather than being extracted into the npm package.

## References

- Public feature overview: `docs/features/tasks/README.md`
- Storage guide: `docs/features/tasks/storage-guide.md`
- Architecture: `docs/features/tasks/architecture.md`
- Trail CLI package: `packages/trail/README.md`
- Skill spec: `packages/resources/skills/sandpiper/tasks/references/SPEC.md`
