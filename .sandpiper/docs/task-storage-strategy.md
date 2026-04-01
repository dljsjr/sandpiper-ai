# Task Storage Strategy — Reducing VCS Churn

**Status:** Design  
**Ticket:** TCL-82  
**Date:** 2026-04-01  

## Problem

Tasks and project documentation should be colocated with the project they belong to and tracked by version control. However, tracking tasks inline on the main development branch creates significant churn:

1. **Task lifecycle operations** — every `task update`, `task pickup`, `task complete` modifies the task file, creates a history diff file, and rewrites the full index.
2. **Index thrash** — `index.toon` is a large serialized data structure that rewrites entirely on every task operation, producing huge diffs that obscure what actually changed.
3. **History diff accumulation** — the `history/` directory grows by one file per task modification, adding file creation noise to every operation.

A single triage session can touch 25+ files. A normal implementation session with 3–4 task status changes produces 10–15 file changes that are pure bookkeeping, mixed in with code changes on the same branch.

In jj's working-copy-is-a-commit model this is especially pronounced — every task operation immediately appears in `jj st` and `jj diff`, muddying the picture of what code has actually changed.

### What we want to preserve

- Tasks materialized as files on disk (CLI, agent, and humans interact with them directly)
- Fine-grained history of task evolution (the `history/` diffs and in-file activity log)
- Monotonic, collision-resistant task numbering
- The ability to push task state to a remote for backup and multi-machine use
- Zero-config experience for new users — `task create` just works

## Design

### Configuration model

Task storage is configured in `.sandpiper/settings.json` under the `tasks.version_control` key:

```json
{
  "tasks": {
    "version_control": {
      "enabled": true,
      "mode": {
        "branch": "@",
        "repo": "git@github.com:user/project-tasks.git"
      }
    }
  }
}
```

#### `enabled` (boolean)

Whether tasks are tracked by version control at all.

- **`true`** — tasks are VCS-tracked according to `mode`.
- **`false`** — tasks are written directly to `.sandpiper/tasks/` as plain files. If the project is in a VCS repo, the path is added to `.gitignore`. No branch, no worktree, no push/pull.

#### `mode.branch` (string, required when `enabled: true`)

Which branch to store tasks on.

- **`"@"`** — the sentinel value meaning "the current/default branch of the target repo." Tasks are committed inline alongside code. This is equivalent to today's behavior.
- **Any other value** (e.g., `"sandpiper-tasks"`) — a named branch. The CLI ensures this branch exists (creating it with unrelated history if necessary) and manages a worktree checkout at `.sandpiper/tasks/`. The path is added to the main branch's `.gitignore`.

The `"@"` sentinel avoids heuristics for detecting the trunk branch name (`main`, `master`, `trunk`, etc.). It always means "wherever I am right now."

#### `mode.repo` (string, optional)

A remote URL for an external repository to store tasks in. When omitted, the current project's repository is used.

When set, the CLI clones the external repo into `.sandpiper/tasks/` (or a staging location) and commits tasks there. The path is added to the project repo's `.gitignore`. This supports:

- Shared task repos across multiple projects
- Keeping tasks in a completely separate remote
- Using a specific branch on the external repo (via `mode.branch`)

The clone is a plain clone, **not** a submodule. Submodules add friction and tooling complexity that isn't justified here.

#### Configuration matrix

| `enabled` | `repo` | `branch` | Behavior |
|-----------|--------|----------|----------|
| `false` | — | — | Plain files on disk, gitignored if in a VCS repo |
| `true` | omitted | `"@"` | Inline on current branch in current repo (today's behavior) |
| `true` | omitted | `"sandpiper-tasks"` | Separate branch in current repo, worktree checkout |
| `true` | `"git@..."` | `"@"` | Clone external repo, commit on its default branch |
| `true` | `"git@..."` | `"tasks"` | Clone external repo, use a specific named branch |

#### Defaults

```json
{
  "tasks": {
    "version_control": {
      "enabled": true,
      "mode": {
        "branch": "@"
      }
    }
  }
}
```

Out-of-the-box behavior is identical to today: tasks tracked inline on the current branch. Users opt into the separate-branch model by changing `"@"` to a branch name. No existing workflows break.

For non-VCS directories, the CLI behaves as though `enabled: false` regardless of the config value. It may emit a one-time informational message but does not error.

### Handling non-VCS directories

When the working directory is not inside a VCS repository:

1. Tasks are written to `.sandpiper/tasks/` as plain files (same as `enabled: false`).
2. If the user later initializes VCS in the project, the CLI does **not** automatically migrate. The user can manually set `version_control.enabled: true` and run a migration command to move existing tasks into the configured branch.
3. A future `sandpiper tasks migrate` command handles this: creates the target branch, moves task files into it, sets up the worktree, and gitignores the path on main.

### Index as derived state

`index.toon` is a cache over the task files on disk. It should be treated as derived state:

1. **Gitignore `index.toon`** in all storage modes. It is never committed.
2. **Auto-rebuild on CLI invocation** when the index is missing or stale. The CLI already supports `index update` which scans task files from disk.
3. **Staleness detection** via mtime comparison: if any task file's mtime is newer than the index file's mtime, rebuild before querying.

#### Counter stability without a versioned index

The task counter is currently stored in the index. With the index gitignored, counter safety relies on the scan-from-disk fallback that already exists:

- On `task create`, the CLI scans all task files (and `.moved` tombstones) in the target project directory to find the highest allocated number, then increments.
- Tombstone files prevent counter reuse after cross-project moves.
- This scan should become the **primary** mechanism for counter allocation, not a fallback. The index counter becomes a performance optimization (skip the scan when index is fresh), not a source of truth.

**Concurrent creation across machines:** Two machines creating tasks simultaneously before syncing could allocate the same number. This is already possible today (the index isn't locked across machines). In the separate-branch model, the collision becomes visible as a VCS conflict on push — which is the correct behavior. The user resolves by renumbering one task.

### History files and activity log

Both the `history/` directory (full unified diffs per modification) and the in-file activity log (summary of field changes) are retained.

**Why not eliminate history files and rely on VCS history?**

1. **VCS history is lossy.** In the separate-branch model, users are encouraged to curate task branch history independently. Squashing destroys intermediate states. History files are an append-only record that survives VCS history manipulation.
2. **Rendering task evolution.** The planned TUI and web UI for the task board need to show a task's timeline ("created → picked up → description updated → completed"). With history files, this is `readdir()` + file reads — fast, simple, zero VCS dependency. Parsing VCS log output is slower, more fragile, and breaks when history is curated.
3. **Atomicity.** Each history diff file is a self-contained record of what changed at a specific moment. VCS commits may bundle multiple task changes.

History files move to the same storage location as tasks (orphan branch, external repo, or inline — whatever is configured). In the separate-branch model, the churn they create is isolated from code history, which is the primary goal.

### Worktree / workspace mechanics

When `mode.branch` is not `"@"` and `mode.repo` is omitted (separate branch in the current repo):

#### Git worktree approach (colocated jj)

```bash
# Bootstrap: create orphan branch if it doesn't exist
git checkout --orphan sandpiper-tasks
git rm -rf .
git commit --allow-empty -m "Initialize task storage"
git checkout -          # back to previous branch

# Add worktree at the canonical path
git worktree add .sandpiper/tasks sandpiper-tasks

# Gitignore the path on main
echo ".sandpiper/tasks/" >> .gitignore
```

In jj colocated mode, jj reads git's worktree configuration. The main workspace's `jj st` should not include files from the worktree path.

#### jj workspace approach (if supported)

```bash
jj workspace add .sandpiper/tasks --revision sandpiper-tasks
```

This may or may not work for subdirectories of an existing workspace. Needs a spike to determine whether jj supports this and how it interacts with the main workspace's snapshot.

#### External repo approach

When `mode.repo` is set:

```bash
# Clone the external repo into the canonical path
git clone <repo-url> .sandpiper/tasks
cd .sandpiper/tasks
git checkout <branch>    # or create if needed

# Gitignore the path in the project repo
echo ".sandpiper/tasks/" >> .gitignore
```

The CLI manages clone, pull, commit, and push as part of task operations — or exposes a `sandpiper tasks sync` command for manual control.

### CLI bootstrap behavior

On any task CLI invocation, the CLI checks:

1. **Is `.sandpiper/tasks/` present and populated?** If yes, use it.
2. **Is there a config at `.sandpiper/settings.json`?** If yes, read `tasks.version_control` and ensure the storage is set up:
   - `enabled: false` or no VCS → create the directory if missing.
   - `branch: "@"` → nothing to do, files are inline.
   - `branch: "<name>"` → ensure the branch exists, ensure the worktree is checked out.
   - `repo: "<url>"` → ensure the clone exists, ensure the right branch is checked out.
3. **No config and no existing tasks directory?** Use defaults (`enabled: true, branch: "@"`) and create the directory.

The bootstrap is idempotent — running it multiple times is safe.

### Commit behavior in separate-branch mode

When tasks are on a separate branch, task CLI operations that modify files should auto-commit to that branch:

- `task create` → commit "Create TCL-82: ..."
- `task update` → commit "Update TCL-82: ..."
- `task pickup` → commit "Pick up TCL-82"
- `task complete` → commit "Complete TCL-82 → DONE"

This keeps the task branch's history granular and meaningful. The user can curate it later if desired.

**Open question:** Should auto-commit be configurable? Some users might prefer to batch task changes and commit manually. A `tasks.version_control.auto_commit: true | false` option could control this. Default: `true` for separate-branch mode, not applicable for inline mode (the user's normal VCS workflow handles it).

### Push/pull behavior

The task branch should be pushed to the remote for backup and multi-machine sync. Options:

1. **Auto-push on every commit** — simple but potentially slow (network round-trip on every task operation).
2. **Push on CLI exit / session end** — batch pushes, lower latency per operation.
3. **Manual push via `sandpiper tasks sync`** — maximum control, risk of forgetting.
4. **Configurable** — let the user choose.

**Recommendation:** Default to manual push (`sandpiper tasks sync` or `sandpiper tasks push`) with an option to enable auto-push. Task operations should be fast and offline-capable; network I/O should be explicit.

For the external repo case, the same options apply but with the addition of pull-before-operate to pick up remote changes.

## Implementation plan

### Phase 1 — Reduce inline churn (no config changes)

1. Gitignore `index.toon` and make the CLI auto-rebuild with mtime-based staleness detection.
2. Make scan-from-disk the primary counter allocation mechanism.
3. Verify that existing tests pass with the index absent at startup.

**Impact:** Eliminates the single noisiest file from VCS diffs. Every task operation touches one fewer file.

### Phase 2 — Separate-branch support

1. **Spike:** Validate jj workspace / git worktree behavior with a branch checked out into `.sandpiper/tasks/`.
2. Add `tasks.version_control` config schema to `.sandpiper/settings.json`.
3. Implement branch bootstrap (create orphan branch, set up worktree, gitignore path).
4. Implement auto-commit for task operations in separate-branch mode.
5. Implement `sandpiper tasks sync` for push/pull.
6. Migration command: move existing inline tasks to the configured branch.

### Phase 3 — External repo support

1. Implement clone-based bootstrap for `mode.repo`.
2. Handle pull-before-operate for remote changes.
3. Handle conflict detection and resolution guidance.

### Phase 4 — Extend pattern

1. Additional storage domains for PKM, MEM when those systems come online.
2. Unified `sandpiper init` bootstrap command that sets up all configured storage.

## Prior art considered

| Project | Approach | Takeaway |
|---------|----------|----------|
| [git-bug](https://github.com/git-bug/git-bug) | Custom git objects, no files on disk | Good idea (separate storage from materialization) but too coupled to git internals. Breaks with reftable, jj native backend. |
| Orphaned branches + worktrees | Standard VCS feature | The core of our approach. Portable, well-understood, supported by both git and jj. |
| [sqlitefs](https://github.com/narumatt/sqlitefs) / [wddbfs](https://github.com/adamobeng/wddbfs) | Database + virtual FS | FUSE is a portability nightmare (macOS, permissions). WebDAV adds a server process. Rejected. |
| [beads](https://github.com/gastownhall/beads) / [beads_rust](https://github.com/Dicklesworthstone/beads_rust) | Flat files in `.beads/` | Same churn problem as us. Viral repo behavior is a cautionary tale — our bootstrap must be explicit and opt-in. |
| [beans](https://github.com/hmans/beans) / [ticket](https://github.com/wedow/ticket) | Flat file CLI trackers | Same model as us. No evidence of churn mitigation strategies. |

## Open questions

1. **jj workspace mechanics** — Does `jj workspace add` support targeting a subdirectory of an existing workspace? If not, does `git worktree add` in colocated mode work cleanly with jj's snapshot? Needs a spike.
2. **Auto-commit granularity** — Should batch operations (e.g., a triage session updating 12 tasks) produce 12 commits or 1? Leaning toward 1-per-CLI-invocation for batch operations, 1-per-operation for single-task commands.
3. **Auto-push default** — Should auto-push be opt-in (manual sync) or opt-out (auto-push by default)? Leaning toward opt-in for offline-first operation.
4. **Settings file location** — `.sandpiper/settings.json` is currently the project settings file. Is this the right place for task storage config, or should it live in the task directory itself? If the task directory is on a separate branch, the settings file on main would reference a branch that's not visible in the main checkout — which is fine conceptually but might be surprising.
5. **`@` sentinel in external repo context** — When `repo` is set and `branch` is `"@"`, what is "the default branch"? For a freshly cloned repo, it's whatever HEAD points to (usually `main`). This should work but needs explicit documentation.
