# Code Review: sandpiper-tasks-cli (TCL v1)

**Reviewer:** Agent (fresh-eyes review from a different session branch)
**Date:** 2026-03-23
**Scope:** All 35 NEEDS REVIEW TCL tickets, full codebase + test suite
**Verdict:** **Approve with minor findings** — the codebase is well-structured, thoroughly tested, and spec-compliant. Findings below are improvements, not blockers.

## Summary

- **178 tests** across 15 test files, all passing
- **Zero lint warnings** (`bun check` clean)
- **2,894 lines** of source, **3,270 lines** of tests (1.13:1 test:source ratio — excellent)
- Architecture cleanly separates core logic from CLI wiring (Commander)
- Spec compliance is thorough — all §2-§8 requirements are covered

## Architecture Review

### Strengths

1. **Clean separation of concerns.** Core logic in `src/core/` has zero Commander imports. CLI layer in `src/commands/` is a thin wiring layer. This matches the AGENTS.md guideline of framework-independent core.

2. **Single canonical `taskFromFrontmatter` function.** All frontmatter → Task conversions go through one place. Eliminates the category of bugs where different code paths produce different Task shapes.

3. **Shared patterns module (`patterns.ts`).** Regex patterns, key parsing, file resolution, and counter scanning are centralized. No duplication across consumers.

4. **Index design.** Flat `Record<string, IndexedTask>` with counters in the index (not separate files) is a good trade-off. The mtime-based skip optimization avoids unnecessary re-parsing.

5. **Schema versioning from day one.** Even though only v1 exists, the migration chain pattern is in place. Future schema changes won't require retroactive migration infrastructure.

6. **Activity log + history diffs.** Complementary system — in-file summaries for quick glance, external diffs for full audit. Well-designed per §7.7 and §8.

### Minor Concerns

7. **`helpers.ts` has `any` type annotations.** The `biome-ignore lint/suspicious/noExplicitAny` comments are justified (Commander's generic params), but there are 10 of them. Consider creating a type alias: `type AnyCommand = Command<any, any, any>` to centralize the suppression to one place.

8. **`frontmatter.ts` `taskFromFrontmatter` uses `as Task` cast.** The function constructs the object literally with correct types, but the final `as Task` obscures whether all fields are actually present. The cast could mask missing fields if the interface changes. Consider removing the cast and letting TypeScript verify the literal object shape directly.

9. **`mutate.ts` `applyFieldUpdates` uses regex replacement on raw file content.** This works for the current frontmatter format but is fragile if the format evolves (e.g., if a value contains text that looks like a frontmatter key). A parse-modify-serialize approach would be more robust, but the current approach is pragmatic for the YAML subset we support.

10. **`history.ts` custom diff implementation.** The `findChanges` function uses a simple lookahead-based diff algorithm. For small files (task markdown) this is fine, but for very large descriptions the O(n*k) lookahead (k=20) could miss optimal alignments. Not a practical concern at current scale.

## Spec Compliance

### §2 Projects ✅
- Project keys validated as `[A-Z]{3}` (tested in `createProject`)
- Project directories auto-created on first task
- Counter state in index with scan fallback (§2.3)

### §3 Task Keys ✅
- `<PROJECT>-<N>` format enforced
- Monotonic incrementing (tested with sequential creates)
- Per-project scoping (tested with multiple projects)
- Counter shared across TASK/BUG/SUBTASK (tested)

### §4 Task Files ✅
- File naming: `KEY.md`
- Location: top-level for TASK/BUG, nested for SUBTASK
- Subtask directories created automatically
- File structure: frontmatter + body + activity log (§4.4)
- Tombstone files (§4.5) created on cross-project moves

### §5 Frontmatter ✅
- All required fields present on creation
- `resolution` conditionally required for COMPLETE (§5.1.1)
- Optional relationship fields (depends_on, blocked_by, related) supported
- All enum values validated

### §6 Task Hierarchy ✅
- TASK and BUG always top-level
- SUBTASK requires parent, max depth 1
- Bugs are always top-level (enforced by kind validation)

### §7 Lifecycle ✅
- Creation sets all required fields (§7.1)
- Status transitions unconstrained (§7.2)
- Resolution required for COMPLETE (§7.3)
- `updated_at` maintained, `created_at` immutable (§7.4)
- CLI-first operations (§7.5)
- No-deletion policy: WONTFIX resolution instead (§7.6)
- Activity log entries on every modification (§7.7)
- Move operations with re-keying, tombstones, reference updates (§7.8)

### §8 History ✅
- Diffs written on every modification
- Directory structure: `history/<KEY>/<TIMESTAMP>.diff`
- Timestamp collision handling with numeric suffix
- No diff on creation (baseline)

## Test Coverage Review

### Well-covered areas
- **Query API (45 tests):** Comprehensive — every filter field, combined filters, all sort fields, pagination, lookup functions. Good use of fixture data.
- **Mutations (24 tests):** Create, update, pickup, complete. Field immutability (created_at). Relationship fields. Auto-project-creation.
- **Move operations (14 tests):** Cross-project, kind changes, subtask reparenting, tombstones, reference updates.
- **Activity log (12 tests):** Extraction, formatting, appending, multiple entries.
- **Index update (12 tests):** Scanning, mtime skip, subtask discovery, counter rebuild.
- **Resolution (7 tests):** COMPLETE requires resolution, resolution only valid on COMPLETE.

### Areas with lighter coverage
- **Description editing:** `description.ts` has `extractDescription` and `replaceDescription` but no dedicated test file. These are tested indirectly through `mutate.test.ts` but would benefit from explicit edge case tests (empty body, body with activity log, body with special characters).
- **Interactive editor mode:** `interactive.test.ts` has 6 tests — adequate for the tmpfile-based flow, but doesn't test the `--interactive` flag with pre-applied field changes.
- **Error messages:** Tests validate that errors are thrown but don't always assert the specific error message content. This is acceptable for a CLI tool but could lead to unhelpful error messages going unnoticed.

## Specific Findings

### Finding 1: `taskFromFrontmatter` `as Task` cast (Low)
**File:** `src/core/frontmatter.ts:10-24`
**Issue:** The function builds a `Task` literal but casts it `as Task` at the end. If the `Task` interface gains a new required field, this cast will silently pass instead of showing a compile error.
**Recommendation:** Remove the `as Task` and let the return type be inferred or annotated as `: Task`.

### Finding 2: `applyFieldUpdates` kind backdoor (Low)
**File:** `src/core/mutate.ts:161-164`
```typescript
const kind = (fields as Record<string, unknown>).kind as string | undefined;
```
**Issue:** The `kind` field is accessed via a cast backdoor (casting `fields` to `Record<string, unknown>`) because `UpdateFields` intentionally doesn't expose `kind`. This is used by move operations. It works but is an implicit contract between `move.ts` and `mutate.ts`.
**Recommendation:** Either add `kind` to `UpdateFields` with a comment that it's for internal use, or create a separate `applyMoveUpdates` function.

### Finding 3: `updateAllReferences` scans all files (Low)
**File:** `src/core/move.ts:265-282`
**Issue:** On a cross-project move, `updateAllReferences` scans every `.md` file in every project directory. For a small task system this is fine, but it scales linearly with total file count. The index could be used to narrow the search to files that actually reference the moved keys.
**Recommendation:** Use the index's `dependsOn`/`blockedBy`/`related` fields to find only files that reference the re-keyed tasks, then only scan those files.

### Finding 4: Search catch-all suppresses real errors (Low)
**File:** `src/core/search.ts:33`
```typescript
} catch {
  // rg exits with code 1 when no matches found — not an error
  return [];
}
```
**Issue:** This catches ALL errors from `execSync`, including actual failures (rg not installed, permission errors, timeout). These real errors return an empty result set instead of surfacing the problem.
**Recommendation:** Check the exit code — rg returns 1 for no matches and 2 for errors:
```typescript
} catch (error: unknown) {
  const execError = error as { status?: number };
  if (execError.status === 1) return []; // no matches
  throw error; // real error
}
```

### Finding 5: `getNextTaskNumber` index read is duplicated with `getBaseCounter` (Low)
**File:** `src/core/mutate.ts:113-136` and `src/core/move.ts:183-200`
**Issue:** Both functions read the index file, decode it, and extract counter values with very similar logic. The fallback chain (index → meta.yml → scan) is duplicated.
**Recommendation:** Extract a shared `getNextTaskNumber(tasksDir, projectKey)` function in `patterns.ts` or a new `counter.ts` module.

### Finding 6: Error message in index-cmd.test.ts bleeds to console (Cosmetic)
**Test output:** `Error: Tasks directory not found: /var/folders/.../tasks`
**Issue:** The CLI E2E test exercises the error path, which prints to stderr. The test captures and validates this, but the error message also appears in the vitest output, which is slightly noisy.
**Recommendation:** No action needed — this is expected behavior for E2E tests that exercise error paths. Mentioning only for completeness.

## Ticket Disposition

All 35 NEEDS REVIEW TCL tickets should be moved to **COMPLETE** with resolution **DONE**. The findings above are minor improvements, not blockers. They can be tracked as follow-up tasks if desired.

| Ticket Range | Description | Verdict |
|-------------|-------------|---------|
| TCL-1 through TCL-7 | Index update command + subtasks | ✅ APPROVE |
| TCL-8 through TCL-12 | Query API | ✅ APPROVE |
| TCL-13 through TCL-17 | Read-only CLI commands | ✅ APPROVE |
| TCL-18 through TCL-21 | Full-text search | ✅ APPROVE |
| TCL-22 through TCL-29 | Mutating CLI commands | ✅ APPROVE |
| TCL-31 | Consistency tests | ✅ APPROVE |
| TCL-32 | Schema versioning | ✅ APPROVE |
| TCL-33 | Format/no-save flags | ✅ APPROVE |
| TCL-36, TCL-37 | Counter migration | ✅ APPROVE |
| TCL-40 | Resolution field | ✅ APPROVE |
