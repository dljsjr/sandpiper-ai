# Code Review: Task Storage Phases 1–3

**Reviewer:** sandpiper (automated)
**Date:** 2026-04-01
**Scope:** `main..@-` (15 commits)
**Mode:** Diff Review (Mode A)

---

## Health Summary

| Metric | Value |
|--------|-------|
| New source files | 6 (`storage-config.ts`, `vcs.ts`, `storage-backend.ts`, `auto-commit.ts`, `migrate.ts`, `storage-cmd.ts`) |
| New test files | 6 (matching test files + `migrate.test.ts`) |
| Modified source files | 3 (`index-update.ts`, `mutate.ts`, `helpers.ts`) |
| Modified test files | 2 (`index-update.test.ts`, `mutate.test.ts`) |
| New docs | 2 (`STORAGE.md`, `.sandpiper-tasks.json`) |
| Total new LOC (source) | ~587 |
| Total new LOC (tests) | ~872 |
| Test count delta | +43 (267 → 310) |
| Complexity | All new functions CC ≤ 10; no new functions above CC 15 |
| Max function length | 51 lines (`migrateInlineToSeparateBranch`) |
| Max nesting depth | 3 (well within threshold) |
| Lint warnings | 0 |
| Type safety escapes | 0 new `any`/`@ts-ignore`/`@ts-expect-error` |
| Test pass rate | 310/310 (100%) |

**Overall: 2 major, 2 minor, 1 nit, 7 positive**

---

## Findings

### F1 — Gitignore logic duplication (major)

**Location:** `index-update.ts:29–47` (`ensureIndexGitignore`) and `storage-backend.ts:19–33` (`addPathToGitignore`)

**What:** These two functions are near-identical implementations of "ensure entry exists in a `.gitignore` file." `addPathToGitignore` is the generalized version (takes a directory and an entry), while `ensureIndexGitignore` is a specialization with a hardcoded entry (`index.toon`) and target directory (`tasksDir`).

**Why:** Copy-paste duplication is the strongest predictor of inconsistent-clone bugs. If one path gets a fix (e.g., handling of BOM, handling of trailing whitespace edge cases), the other won't. The two functions already have a minor style divergence — `ensureIndexGitignore` uses a named constant for the entry while `addPathToGitignore` takes a parameter.

**Suggestion:** Extract the shared logic. The cleanest approach:

1. Move `addPathToGitignore` to `fs.ts` (it's a generic file operation, like `writeFileAtomic`).
2. Rewrite `ensureIndexGitignore` as a one-liner:

```typescript
export function ensureIndexGitignore(tasksDir: string): void {
  addPathToGitignore(tasksDir, INDEX_GITIGNORE_ENTRY);
}
```

This avoids creating a dependency from `index-update.ts` → `storage-backend.ts` (which would be an inappropriate coupling direction).

---

### F2 — jj external-repo branch checkout doesn't track existing remote branches (major)

**Location:** `storage-backend.ts:131–136` (`checkoutOrCreateBranchJj`)

**What:** After `jj git clone --colocate`, if the user specifies a named branch that already exists on the remote (e.g., `branch: "tasks"` and the remote has a `tasks` branch), the function does:

```typescript
jj bookmark set "tasks" -r @
```

This creates a **local** `tasks` bookmark pointing at `@` (which is on the default branch post-clone, typically `main`). It does **not** check out or track the remote's existing `tasks` branch (`tasks@origin`).

The git equivalent (`checkoutOrCreateBranchGit`) is correct — `git checkout tasks` automatically sets up tracking from `origin/tasks`.

**Why:** This means external-repo mode with a **pre-existing** named branch on the remote will silently land on the wrong commit when using the jj backend. The user would start writing tasks on a bookmark that points at `main`'s history instead of the remote's `tasks` branch history. The test for named-branch checkout (from TCL-99) only covers the git backend, which is why this wasn't caught.

**Suggestion:** Rewrite `checkoutOrCreateBranchJj` to handle both cases:

```typescript
function checkoutOrCreateBranchJj(repoPath: string, branch: string): void {
  // Check if the branch exists on the remote
  try {
    // Try to create/move to the remote-tracking bookmark
    run(`jj new "${branch}@origin"`, repoPath);
    run(`jj bookmark set "${branch}" -r @`, repoPath);
  } catch {
    // Remote branch doesn't exist — create a new local bookmark
    run(`jj bookmark create "${branch}" -r @`, repoPath);
  }
}
```

Add a jj integration test mirroring the existing git named-branch checkout test.

---

### F3 — Shell argument interpolation in `run()` (minor)

**Location:** `storage-backend.ts` — all calls to `run()`

**What:** The `run()` helper passes shell command strings built via template literal interpolation to `execSync()`. Values that flow into these strings include branch names (from config), repo URLs (from config), workspace paths, and commit messages (which may contain task titles). None of these are escaped for shell metacharacters.

Example:
```typescript
run(`jj commit -m "${message}"`, workspacePath);
```

A task title like `Fix the "login" flow (part 1/2)` would produce:
```
jj commit -m "Fix the "login" flow (part 1/2)"
```
— broken quoting that may cause a shell error or unexpected behavior.

**Why:** The attack surface is self-inflicted (config and task titles are controlled by the same user running the CLI), so this is not a security vulnerability in the traditional sense. But it IS a correctness bug for legitimate task titles containing quotes, backticks, `$`, parentheses, or other shell metacharacters.

**Suggestion:** Use `execFileSync` instead of `execSync` to avoid shell interpretation entirely:

```typescript
import { execFileSync } from 'node:child_process';

function run(args: readonly string[], cwd: string): void {
  execFileSync(args[0]!, args.slice(1), { cwd, stdio: 'pipe' });
}
```

Then call sites become:
```typescript
run(['jj', 'commit', '-m', message], workspacePath);
run(['git', 'clone', opts.repoUrl, opts.clonePath], opts.rootDir);
```

This is a larger refactor that touches every `run()` call site. It could be done as a follow-up ticket rather than blocking this PR.

---

### F4 — VCS detection in `autoCommitIfEnabled` uses rootDir, not workspacePath (minor)

**Location:** `auto-commit.ts:20`

**What:** `autoCommitIfEnabled` detects the VCS backend from the **project root** (`detectVcsBackend(rootDir)`) but then runs commit/push commands against the **workspace** at `.sandpiper/tasks/`. This works because the design contract guarantees that the workspace's VCS matches the root's VCS (jj root → jj workspace; git root → git worktree; jj root + external repo → `jj git clone --colocate`).

**Why:** This is correct today but encodes an implicit invariant that isn't documented or enforced programmatically. If a future code path broke this invariant (e.g., allowing `git clone` from a jj project for some reason), the commit/push commands would use the wrong VCS tool. The same pattern appears in `storage-cmd.ts:runSyncOperation`.

**Suggestion:** No code change required now, but add a comment documenting the invariant:

```typescript
// Detect VCS from the project root. The workspace at .sandpiper/tasks/
// always uses the same VCS as the root (jj → jj workspace or jj clone;
// git → git worktree or git clone). See task-storage-strategy.md §Backend selection.
const backend = detectVcsBackend(rootDir);
```

Alternatively, detect from the workspace path directly — `detectVcsBackend(workspacePath)` would work for all current modes and removes the invariant dependency.

---

### F5 — VCS error messages swallowed on `storage` command failures (nit)

**Location:** `storage-backend.ts:188` (`run()`), `storage-cmd.ts:155` (`withErrorHandling`)

**What:** The `run()` helper uses `stdio: 'pipe'`, which captures stdout/stderr. When a VCS command fails, `execSync` throws an error whose `.message` is the Node-level message (e.g., `"Command failed: jj workspace add ..."`), but the actual VCS error output (from stderr) is only available on the error object's `.stderr` property. `withErrorHandling` prints `error.message`, not `error.stderr`, so diagnostic output from jj/git is lost.

**Why:** When `storage init` fails, the user sees _"Error: Command failed: git worktree add ..."_ but not the git error explaining **why** it failed (e.g., "fatal: 'sandpiper-tasks' is already checked out"). This makes debugging harder than it needs to be.

**Suggestion:** In `withErrorHandling`, check for and include stderr:

```typescript
export function withErrorHandling(fn: () => void): void {
  try {
    fn();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const stderr = (error as { stderr?: Buffer | string })?.stderr;
    const detail = stderr ? `\n${String(stderr).trim()}` : '';
    console.error(`Error: ${msg}${detail}`);
    process.exitCode = 1;
  }
}
```

---

### F6 — Clean module architecture (positive)

**What:** The new code follows the project's established pattern of framework-independent core modules with thin CLI wrappers. Each concern has its own module:
- `vcs.ts` — VCS detection (3 lines of logic)
- `storage-config.ts` — config resolution with clean defaults-merge pattern
- `storage-backend.ts` — VCS bootstrap operations
- `auto-commit.ts` — auto-commit orchestration
- `migrate.ts` — migration logic
- `storage-cmd.ts` — Commander command wiring

No core module imports from the commands layer. The dependency flow is correct and unidirectional.

---

### F7 — Config resolution with merge-with-defaults pattern (positive)

**What:** `resolveStorageConfig` implements a clean precedence chain (standalone file → settings.json → defaults) with partial-config merging. The `mergeWithDefaults` function handles missing/partial configs gracefully using type-safe helper functions (`boolOr`, `stringOr`, `isRecord`) instead of `Object.assign` or spread operators that could introduce prototype pollution or type confusion.

The 7-test suite for config resolution is well-designed — it covers each precedence level, the override behavior, partial merges, and the repo URL optional field.

---

### F8 — Strong integration test coverage (positive)

**What:** The test suite includes real VCS integration tests that spin up actual git and jj repos in temp directories. Tests cover:
- Both backends (git worktree AND jj workspace) for `storage init`
- External repo clone for both backends
- Auto-commit with a real git worktree
- Auto-push to a bare remote
- Broken-clone repair (delete and re-init)
- Named branch checkout
- Bookmark-not-at-root regression test (the jj fix)
- Migration with real git worktree bootstrap
- Inline mode no-op behavior for sync/push/pull

The test teardown correctly uses `execSync('rm -rf ...')` for jj directories (working around the macOS `rmSync` issue documented in the standup).

---

### F9 — Migration error handling with recovery path (positive)

**What:** `migrateInlineToSeparateBranch` (TCL-105 fix) correctly preserves the temp backup on failure and includes the recovery path in the error message:

```
Migration failed. Your task files are preserved at: /tmp/sandpiper-migrate-XXXX
To recover: cp -r "/tmp/sandpiper-migrate-XXXX/." "/path/to/.sandpiper/tasks/"
```

This is a significant improvement over the original `try/finally` pattern that would have wiped the backup. The two unit tests (`throws when config is inline mode` and `preserves task files in a recoverable temp dir when bootstrap fails`) verify both the guard clause and the recovery behavior.

---

### F10 — Scan-primary counter allocation (positive)

**What:** The `getNextTaskNumber` function correctly implements the design's requirement that disk scan is primary and the index counter acts as a floor:

```typescript
const fromDisk = scanHighestNumber(tasksDir, projectKey) + 1;
const fromIndex = readProjectCounter(tasksDir, projectKey);
return fromIndex !== undefined && fromIndex > fromDisk ? fromIndex : fromDisk;
```

The three new counter allocation tests are precisely targeted:
1. Stale index with lower counter (disk wins → FOO-6)
2. `.moved` tombstone prevents reuse (FOO-3, not FOO-2)
3. Deleted file with higher index counter (index floor wins → FOO-4)

---

### F11 — STORAGE.md operator documentation (positive)

**What:** The `STORAGE.md` document is well-structured operator reference documentation. It covers configuration, all three storage modes, repair guidance for common failure scenarios (missing workspace, wrong remote, diverged history, counter collision), and the auto-commit/auto-push behavior. This directly satisfies the TCL-97 and TCL-100 acceptance criteria for operator docs.

---

### F12 — Design doc alignment (positive)

**What:** The implementation closely follows the approved design in `task-storage-strategy.md`:
- Config resolution precedence matches the design spec exactly
- Backend selection rules (jj → workspace, git → worktree, external → clone) match
- The `@` sentinel behavior matches
- Bootstrap is explicit (not silent) as specified
- `index.toon` is treated as derived state
- History files are preserved (not eliminated)

The implementation plan was updated post-session to reflect completed phases, and the strategy doc has an updated status header.

---

## Ticket Alignment

All tickets referenced in commit messages were verified against their descriptions and acceptance criteria.

### Phase 1 — TCL-86 (TCL-90, TCL-91, TCL-92) ✅

| Criterion | Status |
|-----------|--------|
| `index.toon` is gitignored in all storage modes | ✅ `ensureIndexGitignore` creates/maintains `.gitignore` |
| CLI commands work when index doesn't exist | ✅ `loadTasks` auto-rebuilds; tested |
| CLI commands rebuild stale index | ✅ `isIndexConsistent` check in `loadTasks` |
| Counter allocation is monotonic with tombstone respect | ✅ 3 dedicated counter tests |
| Existing tests updated | ✅ `index-update.test.ts` and `mutate.test.ts` updated |

**Verdict:** All subtasks correctly implemented and tested. Phase 1 is complete.

### Phase 2 — TCL-87 (TCL-93, TCL-94, TCL-95, TCL-96, TCL-97) ✅

| Criterion | Status |
|-----------|--------|
| Config resolution precedence correct | ✅ 7 tests covering all precedence levels |
| jj workspace bootstrap at root() | ✅ Tested, bookmark regression fixed |
| git worktree orphan branch bootstrap | ✅ Tested |
| Bootstrap is idempotent | ✅ Tested for both backends |
| Bootstrap is explicit (not silent) | ✅ Inline mode prints informational message, no auto-bootstrap |
| auto_commit works | ✅ Integration test with real git worktree |
| auto_push works | ✅ Integration test with bare remote (TCL-104 fix) |
| sync/push/pull commands work | ✅ Tested, inline no-op tested |
| Migration works | ✅ Integration test, failure-recovery tested (TCL-105) |
| Operator docs | ✅ STORAGE.md covers all modes |

**Verdict:** All subtasks correctly implemented and tested. Phase 2 is complete.

### Phase 3 — TCL-88 (TCL-98, TCL-99, TCL-100) ✅ (with one gap)

| Criterion | Status |
|-----------|--------|
| External repo clone with correct VCS | ✅ git clone tested |
| `branch: "@"` uses remote default | ✅ Correct (skips checkout step) |
| Named-branch checkout | ⚠️ git: ✅; jj: **buggy** (see F2) |
| Idempotent init | ✅ Tested |
| Repair guidance | ✅ STORAGE.md covers broken clone, wrong remote, divergence |
| Conflict/collision guidance | ✅ STORAGE.md covers counter collision resolution |

**Verdict:** Phase 3 is functionally complete for the git backend. The jj backend has a bug in named-branch checkout for external repos with pre-existing branches (F2). This is an edge case that may not block closure depending on whether the user has jj external-repo use cases today, but it should be tracked as a known issue or bug ticket.

### Bug fixes — TCL-104, TCL-105 ✅

Both bugs are correctly identified, reproduced with failing tests, and fixed:
- **TCL-104:** `auto_push` is now honored in `autoCommitIfEnabled`. Integration test with a bare remote verifies push occurs.
- **TCL-105:** `migrate` preserves temp backup on failure with recovery instructions. Two unit tests verify the behavior.

### Ticket closure assessment

All tickets in this stack (TCL-86–88, TCL-90–100, TCL-104, TCL-105) are already marked COMPLETE/DONE. Based on this review:

- **TCL-86, TCL-90, TCL-91, TCL-92:** ✅ Can remain closed. Work is correct.
- **TCL-87, TCL-93, TCL-94, TCL-95, TCL-96, TCL-97:** ✅ Can remain closed. Work is correct.
- **TCL-88, TCL-98, TCL-100:** ✅ Can remain closed. Work is correct for the tested backends.
- **TCL-99:** ⚠️ The jj external-repo named-branch checkout case (F2) means this ticket's acceptance criterion ("Named-branch mode creates or checks out the correct branch") is only met for the git backend. Consider filing a follow-up bug for the jj case rather than re-opening this ticket — the git path is correct and the jj edge case is narrow.
- **TCL-104:** ✅ Can remain closed.
- **TCL-105:** ✅ Can remain closed.

---

## Recommended Actions (priority order)

1. **File a bug ticket** for F2 (jj external-repo named-branch checkout). This is a correctness issue that should be tracked even if not immediately blocking.
2. **Fix F1** (gitignore duplication). Extract `addPathToGitignore` to `fs.ts` and rewrite `ensureIndexGitignore` as a one-liner delegate. Small, safe refactor.
3. **File a ticket** for F3 (shell interpolation in `run()`). The fix (switch to `execFileSync`) is mechanical but touches every call site — better as a dedicated commit.
4. **Add the invariant comment** from F4. One line, zero risk.
5. **Optionally improve** F5 (stderr in error messages). Nice-to-have UX improvement.

None of these block merging the current stack. F2 is the only correctness issue and it only affects an edge case (jj backend + external repo + pre-existing named branch on remote).
