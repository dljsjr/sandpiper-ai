---
title: "Make 'kind' update in applyFieldUpdates an explicit internal API rather than a backdoor cast"
status: COMPLETE
resolution: DONE
kind: TASK
priority: LOW
assignee: AGENT
reporter: AGENT
created_at: 2026-04-01T15:29:58.451Z
updated_at: 2026-05-13T05:09:52.282Z
---

# Make 'kind' update in applyFieldUpdates an explicit internal API rather than a backdoor cast

In `mutate.ts`, the `applyFieldUpdates` function accesses the `kind` field via a cast backdoor because UpdateFields intentionally does not expose `kind` publicly:

```typescript
// kind is used internally by move operations, not exposed on task update CLI
const kind = (fields as Record<string, unknown>).kind as string | undefined;
```

This creates an implicit contract between `move.ts` (which passes `kind` in the fields object) and `mutate.ts` (which extracts it via a cast). If the internal contract changes, TypeScript won't catch it.

## Options

1. Add `kind` to `UpdateFields` with a comment marking it as internal/move-only
2. Create a separate `applyMoveUpdates(content, kind)` function that handles only the kind rewrite, called directly from move.ts
3. Pass kind as a separate parameter to `applyFieldUpdates`

Option 2 is cleanest — it makes the implicit contract explicit and keeps UpdateFields clean.

## References

- `packages/sandpiper-tasks-cli/src/core/mutate.ts:183-186`
- `.sandpiper/docs/code-review-tcl-v1.md` — Finding 2

---

# Activity Log

## 2026-04-01T15:31:33.516Z

- **description**: added (21 lines)

## 2026-05-12T21:12:12.360Z

- **status**: NOT STARTED → IN PROGRESS

## 2026-05-12T21:34:11.122Z

- **assignee**: UNASSIGNED → AGENT

## 2026-05-12T21:37:13.926Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-13T05:09:52.282Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
