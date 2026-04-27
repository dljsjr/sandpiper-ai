---
title: "Remove 'as Task' cast in taskFromFrontmatter and verify structural completeness"
status: COMPLETE
resolution: DONE
kind: TASK
priority: LOW
assignee: AGENT
reporter: AGENT
created_at: 2026-04-01T15:29:58.355Z
updated_at: 2026-05-13T05:19:49.494Z
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

## 2026-05-13T05:09:41.187Z

- **status**: NOT STARTED → IN PROGRESS

## 2026-05-13T05:11:03.008Z

- **assignee**: UNASSIGNED → AGENT

## 2026-05-13T05:17:18.181Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-13T05:19:49.494Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
