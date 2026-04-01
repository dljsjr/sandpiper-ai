# Session Stand-Up

Updated: 2026-04-01T20:30:00Z
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

### Self-reflection pass ✅
- jj skill: added `jj workspace add` parent-directory gotcha
- tasks skill: added "Task Storage Modes" section with storage command reference
- refactoring TypeScript ref: added Biome gotchas (import sort order, line length)
- AGENTS.md: updated task storage routing row with STORAGE.md and new commands
- task-storage-implementation-plan.md: updated status to reflect Phases 1–3 done
- task-storage-strategy.md: updated status header
- Filed bugs: TCL-104 (auto_push ignored), TCL-105 (migrate interruption risk)
- Filed task: TCL-106 (storage status command)

### Test count
- Start of session: 267 tests
- End of session: **306 tests** (+39)
- All 26 test files passing, lint clean

### Commits (11 total on main..@-)
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
Move tasks to separate 'tasks' branch  ← main branch side of dogfooding
[tasks workspace] Migrate existing tasks from inline storage  ← tasks branch side
```

## In Progress
- None.

## Next Session

- **Code review** — external review of Phase 1–3 before Phase 4
- **Phase 4 (TCL-89)** after review: extract reusable storage bootstrap primitives
  - TCL-101, TCL-102, TCL-103
- **Bugs to fix (LOW priority, fine to defer):**
  - TCL-104: `auto_push` silently ignored after `autoCommitIfEnabled`
  - TCL-105: `storage migrate` data loss risk on interruption
- **Other HIGH backlog:**
  - TCL-71: Require key or explicit filter on mutating commands
  - WEB-9: CSS selector targeting for headless web tool
  - AGENT-35: Deterministic enforcement hooks

## Blockers
- None.

## Context

### Current working tree state
- **Main workspace** (`@`): empty working copy on top of the tasks-migration commit
- **Tasks workspace** (`.sandpiper/tasks/`): empty working copy; tasks branch has all task files
- `main` bookmark is behind `main@origin` by all commits this session (user pushes manually)

### New files this session
- `packages/sandpiper-tasks-cli/src/core/storage-config.ts` + test
- `packages/sandpiper-tasks-cli/src/core/vcs.ts` + test
- `packages/sandpiper-tasks-cli/src/core/storage-backend.ts` + test
- `packages/sandpiper-tasks-cli/src/core/auto-commit.ts` + test
- `packages/sandpiper-tasks-cli/src/core/migrate.ts`
- `packages/sandpiper-tasks-cli/src/commands/storage-cmd.ts` + test
- `packages/sandpiper-tasks-cli/STORAGE.md`
- `.sandpiper/tasks/.gitignore`
- `.sandpiper-tasks.json` (repo config, mode=tasks branch)

### Key gotchas discovered
- `jj workspace add` does NOT create parent directories — must `mkdir -p` first
- `git branch` doesn't show an orphan branch until it has a commit — use `git worktree list` to verify
- Node's `rmSync` can fail on jj workspace directories on macOS — use `execSync('rm -rf ...')` in tests
- `branch: "@"` means inline ONLY when no `repo` URL is set; `@` + `repo` URL = external-repo mode
- Biome `assist/source/organizeImports` enforces strict alphabetical import order — check carefully when adding new imports to existing files
