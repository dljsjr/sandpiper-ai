---
title: "Remove 'as Task' cast in taskFromFrontmatter and verify structural completeness"
status: NOT STARTED
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-04-01T15:29:58.355Z
updated_at: 2026-04-01T15:31:06.703Z
---

# Remove 'as Task' cast in taskFromFrontmatter and verify structural completeness

The `taskFromFrontmatter` function in frontmatter.ts builds a Task object literal from parsed fields but casts it `as Task` at the end (line 25). This masks a type-safety gap: if the Task interface gains a new required field, the cast will silently pass at compile time instead of producing a type error.

## What to do

Remove the `as Task` cast and instead annotate the return type as `: Task`. TypeScript will then verify that the constructed literal satisfies all required fields. Fix any resulting type errors if the fields don't match.

## Why it matters

This is a correctness time-bomb — a silent cast means future Task interface changes will produce runtime bugs instead of compile errors. Low effort to fix.

## References

- `packages/sandpiper-tasks-cli/src/core/frontmatter.ts:25`
- `.sandpiper/docs/code-review-tcl-v1.md` — Finding 1

---

# Activity Log

## 2026-04-01T15:31:06.703Z

- **description**: added (14 lines)
