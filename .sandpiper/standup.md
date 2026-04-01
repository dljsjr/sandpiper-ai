# Session Stand-Up

Updated: 2026-04-01T14:00:00Z
Session: c82731d3-f981-423f-98c4-521ed9862da2
Session file: /Users/doug.stephen/.sandpiper/agent/sessions/--Users-doug.stephen-git-sandpiper-ai--/2026-04-01T18-12-48-013Z_c82731d3-f981-423f-98c4-521ed9862da2.jsonl

## Accomplished

### Phase 1 — Derived index / scan-first counters (TCL-86) ✅

- **TCL-90**: `ensureIndexGitignore()` in `index-update.ts` — creates/appends `.sandpiper/tasks/.gitignore` with `index.toon` entry on every `updateIndex()` and `loadTasks()` call. 3 tests. Created `.sandpiper/tasks/.gitignore` for this repo immediately.
- **TCL-91**: `getNextTaskNumber()` in `mutate.ts` rewritten — disk scan is now primary (always finds highest `.md`/`.moved`), index counter is floor only. Removed legacy `.meta.yml` path. 3 tests.
- **TCL-92**: Coverage tests for no-index startup/rebuild/counter flows; `README.md` documents `index.toon` as derived state and scan-primary model.

### Phase 2 — Separate-branch task storage (TCL-87) ✅

- **TCL-93**: New `storage-config.ts` — `TaskStorageConfig` types, `DEFAULT_STORAGE_CONFIG`, `resolveStorageConfig()` with `.sandpiper-tasks.json` > `.sandpiper/settings.json → tasks` > defaults precedence. 7 tests.
- **TCL-94**: New `vcs.ts` — `detectVcsBackend()` (`.jj/` → jj, colocated wins). New `storage-backend.ts` — `addPathToGitignore()`, `initSeparateBranch()` (jj workspace add root(), git worktree add --orphan), `initExternalRepo()`, `commitTaskChanges()`, `pushTaskBranch()`, `pullTaskBranch()`. New `storage-cmd.ts` CLI command group (`storage init/sync/push/pull/migrate`). 7+6 tests inc. real jj/git repos.
- **TCL-95**: New `auto-commit.ts` — `autoCommitIfEnabled()` commits after mutations when `auto_commit: true`. Wired into `emitMutationResult()` in `helpers.ts`. 2+1 tests.
- **TCL-96**: New `migrate.ts` — `migrateInlineToSeparateBranch()` snapshots inline tasks, bootstraps worktree, restores files. `storage migrate` wired up. 1 integration test.
- **TCL-97**: 3 sync/push/pull no-op tests; `STORAGE.md` operator reference doc (all modes, repair guidance, auto_commit/auto_push semantics).

### Phase 3 — External repo storage (TCL-88) ✅

- **TCL-98**: `initExternalRepo()` integration tests with real local git remote (clone + idempotency). Fixed inline-mode detection bug — `@` + `repo` URL is external-repo mode, not inline. Same fix in `auto-commit.ts`, `migrate.ts`, `runSyncOperation()`.
- **TCL-99**: Named-branch checkout test for `initExternalRepo`. `storage pull` integration test against local remote.
- **TCL-100**: Broken-clone repair integration test. Concurrent-creation collision guidance added to `STORAGE.md`.

### Test count
- Start of session: 267 tests
- End of session: **306 tests** (+39)
- All 26 test files passing, lint clean (bun check: no errors/warnings)

### Commits (9 logical commits on main..@-)
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
```

## In Progress
- None.

## Next Session

- **Code review** — user wants external code review of the Phase 1–3 work before proceeding to Phase 4
- **Phase 4 (TCL-89)** after review: extract reusable storage/bootstrap primitives for PKM/MEM domains
  - TCL-101: Extract reusable storage bootstrap primitives
  - TCL-102: Unified init/status surfaces
  - TCL-103: Document PKM/MEM adoption path
- **Other HIGH priority backlog**:
  - TCL-71: Require key or explicit filter on mutating commands (safety improvement)
  - WEB-9: CSS selector targeting for headless web tool
  - AGENT-35: Deterministic enforcement hooks

## Blockers
- None.

## Context

### New files added this session
- `packages/sandpiper-tasks-cli/src/core/storage-config.ts` + test
- `packages/sandpiper-tasks-cli/src/core/vcs.ts` + test
- `packages/sandpiper-tasks-cli/src/core/storage-backend.ts` + test
- `packages/sandpiper-tasks-cli/src/core/auto-commit.ts` + test
- `packages/sandpiper-tasks-cli/src/core/migrate.ts`
- `packages/sandpiper-tasks-cli/src/commands/storage-cmd.ts` + test
- `packages/sandpiper-tasks-cli/STORAGE.md`
- `.sandpiper/tasks/.gitignore`

### Modified files
- `packages/sandpiper-tasks-cli/src/core/mutate.ts` — scan-primary counter
- `packages/sandpiper-tasks-cli/src/core/index-update.ts` — `ensureIndexGitignore`
- `packages/sandpiper-tasks-cli/src/commands/helpers.ts` — `loadTasks` + `emitMutationResult` wired to auto-commit and gitignore
- `packages/sandpiper-tasks-cli/src/index.ts` — `storageCommand` registered
- `packages/sandpiper-tasks-cli/README.md` — index.toon derived-state docs

### Key design decisions made
- `@` sentinel + `repo` URL = external-repo mode (not inline) — fixed a bug where `branch: "@"` with a repo URL was mistakenly treated as inline
- `jj workspace add` requires parent dir to pre-exist — `initJjWorkspace` now calls `mkdirSync` before the jj command
- jj cleanup in tests uses `execSync('rm -rf ...')` because Node's `rmSync` struggles with jj's `.jj/` workspace structure on macOS

### State of working tree
- `main` bookmark is behind `main@origin` by all 9 new commits (user pushes manually)
- No uncommitted changes (`@` is empty)
