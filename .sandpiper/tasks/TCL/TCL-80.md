---
title: "Fix search catch-all to distinguish rg exit code 1 (no matches) from real errors"
status: NOT STARTED
kind: BUG
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-04-01T15:29:58.419Z
updated_at: 2026-04-01T15:31:23.312Z
---

# Fix search catch-all to distinguish rg exit code 1 (no matches) from real errors

In `search.ts`, the `searchTasks` function calls `execSync('rg ...')` and catches all exceptions, returning an empty array. The comment says 'rg exits with code 1 when no matches found — not an error.'

This is correct for exit code 1 (no matches), but rg exits with code 2 for actual errors (rg not found, permission denied, invalid pattern, etc.). The current catch-all swallows these real errors and returns an empty result, making it impossible to distinguish 'no tasks match' from 'rg is broken or not installed'.

## What to do

```typescript
} catch (error: unknown) {
  const execError = error as { status?: number };
  if (execError.status === 1) return []; // rg found no matches
  throw error;               // real error — surface it
}
```

Add a test that verifies a real error (e.g., passing a bad flag) propagates instead of silently returning [].

## References

- `packages/sandpiper-tasks-cli/src/core/search.ts:34`
- `.sandpiper/docs/code-review-tcl-v1.md` — Finding 4

---

# Activity Log

## 2026-04-01T15:31:23.313Z

- **description**: added (20 lines)
