# Session Stand-Up

Updated: 2026-04-01T21:15:00Z
Session: c82731d3-f981-423f-98c4-521ed9862da2
Session file: /Users/doug.stephen/.sandpiper/agent/sessions/--Users-doug.stephen-git-sandpiper-ai--/2026-04-01T18-12-48-013Z_c82731d3-f981-423f-98c4-521ed9862da2.jsonl

## Accomplished

### Phase 1 — Derived index / scan-first counters (TCL-86) ✅
- **TCL-90**: `ensureIndexGitignore()` — creates/appends `.sandpiper/tasks/.gitignore` with `index.toon` on `updateIndex()` and `loadTasks()`. 3 tests. Created `.sandpiper/tasks/.gitignore` for this repo.
- **TCL-91**: `getNextTaskNumber()` rewritten — disk scan is primary, index counter is floor only. Removed legacy `.meta.yml` path. 3 tests.
- **TCL-92**: Coverage tests for no-index startup/rebuild/counter flows; `README.md` updated.

### Phase 2 — Separate-branch task storage (TCL-87) ✅
- **TCL-93**: `storage-config.ts` — `TaskStorageConfig` types, `DEFAULT_STORAGE_CONFIG`, `resolveStorageConfig()` with `.sandpiper-tasks.json` > settings.json > defaults. 7 tests.
- **TCL-94**: `vcs.ts` — `detectVcsBackend()`. `storage-backend.ts` — `addPathToGitignore()`, `initSeparateBranch()`, `initExternalRepo()`, commit/push/pull. `storage-cmd.ts` — `storage init/sync/push/pull/migrate`. Tests inc. real jj/git repos.
- **TCL-95**: `auto-commit.ts` — `autoCommitIfEnabled()` wired into `emitMutationResult()`.
- **TCL-96**: `migrate.ts` — `migrateInlineToSeparateBranch()`. `storage migrate` wired up.
- **TCL-97**: sync/push/pull no-op tests; `STORAGE.md` operator reference.

### Phase 3 — External repo storage (TCL-88) ✅
- **TCL-98**: `initExternalRepo()` integration tests + fixed `@` + `repo` = external-repo (not inline).
- **TCL-99**: Named-branch checkout test; `storage pull` integration test.
- **TCL-100**: Broken-clone repair test; collision guidance in STORAGE.md.

### Dogfooding ✅
- Created `.sandpiper-tasks.json` with `mode.branch: "tasks"`
- Ran `storage migrate` — tasks moved from inline to jj workspace at `.sandpiper/tasks/`
- Committed both sides: main branch (deletions + gitignore) and tasks branch (all files)
- Verified `task list` works correctly against the new workspace

### Bug fixes ✅
- **TCL-104**: `auto_push` now honoured — `autoCommitIfEnabled` calls `pushTaskBranch` after `commitTaskChanges` when `auto_push: true`. 1 integration test (bare remote).
- **TCL-105**: `storage migrate` data loss on interruption fixed — replaced `try/finally` (always wiped backup) with `try/catch` that preserves `tempDir` on failure and re-throws with recovery path + `cp` command. 2 unit tests in new `migrate.test.ts`.
- Also fixed: jj bookmark pointed at `root()` after `storage init` — changed `@-` → `@` in `initJjWorkspace`. Regression test added. Fixed live `tasks` bookmark in this repo.

### Code review fixes ✅
- **F1**: `addPathToGitignore` moved to `fs.ts`; `ensureIndexGitignore` rewritten as one-liner delegate; tests moved to `fs.test.ts`.
- **F2**: Fixed jj external-repo named-branch checkout (`checkoutOrCreateBranchJj` now uses `bookmark set -r branch@origin` + `jj new branch` instead of pointing at `@`). Failing test added comparing commit IDs.
- **F3**: Filed TCL-108 for `execFileSync` migration.
- **F4**: Added VCS invariant comment in `autoCommitIfEnabled` and `runSyncOperation`.
- **F5**: `withErrorHandling` now surfaces child process stderr in error messages.

### Self-reflection pass ✅
- jj skill: added `jj workspace add` parent-directory gotcha; added `jj edit` fails on immutable commits gotcha (this session)
- tasks skill: added "Task Storage Modes" section with storage command reference
- tasks SPEC.md: updated §2.4 (scan-primary counter model) and §3.3 (counter operations); added §9 (Storage Configuration); fixed project key soft guidance (3–5 letters, not 2–4)
- tasks references/storage.md: new file (operator guide, copy of STORAGE.md)
- refactoring TypeScript ref: added Biome gotchas (import sort order, line length)
- AGENTS.md: updated task storage routing row with STORAGE.md and new commands
- task-storage-implementation-plan.md: updated status to reflect Phases 1–3 done
- Filed bugs: TCL-104 (auto_push ignored), TCL-105 (migrate interruption risk), TCL-107 (jj named-branch checkout)
- Filed tasks: TCL-106 (storage status command), TCL-108 (execFileSync migration), TCL-109 (storage.md sync drift risk)

### Test count
- Start of session: 267 tests
- End of session: **311 tests** (+44)
- All 27 test files passing, lint clean

### Commits on main..@-
```
TCL-86/90-92: index.toon as derived state, scan-primary counters, gitignore
TCL-93: task storage config resolution and precedence
TCL-94: storage init for current-repo jj/git backends
TCL-95: auto-commit on task mutation and storage sync commands
TCL-96: inline-to-separate-branch migration
TCL-97: integration tests and operator docs for current-repo storage modes
TCL-98: external repo bootstrap with jj/git clone semantics
TCL-99: branch selection/tracking and sync for external repo mode
TCL-100: external repo integration tests and conflict/repair docs
Move tasks to separate 'tasks' branch
[tasks workspace] Migrate existing tasks from inline storage
Self-reflection: update skills, docs, and file loose-end tasks
Fix jj bookmark pointing at root() after storage init
TCL-104: honour auto_push in autoCommitIfEnabled
TCL-105: preserve task files on migrate failure instead of wiping them
F1: deduplicate gitignore logic — addPathToGitignore moves to fs.ts
F2: fix jj external-repo named-branch checkout for pre-existing remote branches
F3/F4/F5: file shell-interpolation ticket, document VCS invariant, surface stderr
Document task storage modes in skill, spec, and references
Fix project key length guidance in SPEC.md
[self-reflection] SPEC.md §3.3 + jj immutable commits gotcha + TCL-109
```

## In Progress
- None.

## Next Session

- **Code review** — ready for external review now that all F1–F5 findings are addressed
- **Phase 4 (TCL-89)** after review: extract reusable storage bootstrap primitives
  - TCL-101, TCL-102, TCL-103
- **Open backlog (LOW):**
  - TCL-108: Replace shell-interpolated `run()` with `execFileSync`
  - TCL-109: Keep `skills/sandpiper/tasks/references/storage.md` in sync with `packages/sandpiper-tasks-cli/STORAGE.md`
  - TCL-106: `storage status` diagnostic command
- **Other HIGH backlog:**
  - TCL-71: Require key or explicit filter on mutating commands

## Blockers
- None.

## Context

### Current working tree state
- **Main workspace** (`@`): 2 uncommitted skill/doc changes (§3.3 fix + jj immutable commits gotcha) — commit before next code work
- **Tasks workspace** (`.sandpiper/tasks/`): empty working copy; tasks branch has all task files
- `main` bookmark is behind `main@origin` by all commits this session (user pushes manually)

### New files this session
- `packages/sandpiper-tasks-cli/src/core/storage-config.ts` + test
- `packages/sandpiper-tasks-cli/src/core/vcs.ts` + test
- `packages/sandpiper-tasks-cli/src/core/storage-backend.ts` + test
- `packages/sandpiper-tasks-cli/src/core/auto-commit.ts` + test
- `packages/sandpiper-tasks-cli/src/core/migrate.ts` + test
- `packages/sandpiper-tasks-cli/src/commands/storage-cmd.ts` + test
- `packages/sandpiper-tasks-cli/STORAGE.md`
- `skills/sandpiper/tasks/references/storage.md` (copy of STORAGE.md for skill discoverability)
- `.sandpiper/tasks/.gitignore`
- `.sandpiper-tasks.json` (repo config, mode=tasks branch)

### Key gotchas discovered
- `jj workspace add` does NOT create parent directories — must `mkdir -p` first
- `jj edit` fails on immutable commits — remote-tracking refs are immutable; use `jj new <branch>` instead
- `git branch` doesn't show an orphan branch until it has a commit — use `git worktree list` to verify
- Node's `rmSync` can fail on jj workspace directories on macOS — use `execSync('rm -rf ...')` in tests
- `branch: "@"` means inline ONLY when no `repo` URL is set; `@` + `repo` URL = external-repo mode
- Biome `assist/source/organizeImports` enforces strict alphabetical import order
- `skills/` and `dist/skills/` are both source — always sync both after editing either one
