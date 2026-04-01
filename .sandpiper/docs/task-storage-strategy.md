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

Task storage configuration can live in two places:

1. **Sandpiper project settings** — `.sandpiper/settings.json`, namespaced under the `tasks` key.
2. **Standalone config file** — a file at the project root (e.g., `.sandpiper-tasks.json`) whose root object maps directly to the `tasks` value.

When both are present, the standalone file wins — it overrides the sandpiper settings block entirely for the `tasks` namespace. This lets teams commit a task storage config to the project root on `main` even when the tasks themselves live on a separate branch or in a separate repo.

#### Sandpiper settings (`/.sandpiper/settings.json`)

```json
{
  "tasks": {
    "version_control": {
      "enabled": true,
      "mode": {
        "branch": "sandpiper-tasks"
      },
      "auto_commit": false,
      "auto_push": false
    }
  }
}
```

#### Standalone config (project root, e.g., `.sandpiper-tasks.json`)

```json
{
  "version_control": {
    "enabled": true,
    "mode": {
      "branch": "sandpiper-tasks",
      "repo": "git@github.com:user/project-tasks.git"
    },
    "auto_commit": true,
    "auto_push": false
  }
}
```

The standalone file has no `"tasks"` namespace — its root object IS the tasks config. This keeps the file focused and avoids redundant nesting.

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

#### `auto_commit` (boolean, optional, default: `false`)

When `true` and tasks are on a separate branch (or external repo), the CLI automatically commits to the task branch after every mutating operation. When `false`, file changes accumulate in the task worktree's working copy and the user commits manually.

Not applicable when `branch` is `"@"` (inline mode) — the user's normal VCS workflow handles commits.

#### `auto_push` (boolean, optional, default: `false`)

When `true`, the CLI automatically pushes the task branch to its remote after every commit (or batch of commits). When `false`, the user pushes manually via `sandpiper tasks sync` or their VCS tooling.

Requires `auto_commit: true` to have any effect (there's nothing to push if changes aren't committed). Not applicable in inline mode.

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
  "version_control": {
    "enabled": true,
    "mode": {
      "branch": "@"
    },
    "auto_commit": false,
    "auto_push": false
  }
}
```

Out-of-the-box behavior is identical to today: tasks tracked inline on the current branch, no auto-commit or auto-push. Users opt into the separate-branch model by changing `"@"` to a branch name. No existing workflows break.

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

### Backend selection and storage mechanics

When `mode.branch` is not `"@"` and `mode.repo` is omitted (separate branch in the **current repo**), the backend depends on the repository type:

- **Current repo has `.jj/`** → use **`jj workspace`**
- **Current repo has `.git/` but not `.jj/`** → use **`git worktree`**
- **Do not use `git worktree` inside a jj repo**

When `mode.repo` is set (an **external repo**), do **not** use a workspace/worktree at all — just clone the repo into the canonical path. Use the same VCS semantics as the current repo:

- **Current repo has `.jj/`** → use **`jj git clone --colocate`**
- **Current repo has `.git/` but not `.jj/`** → use **`git clone`**

This keeps the mental model simple:
- workspaces/worktrees are only for a second checkout of the **current repo**
- external repos are always plain clones

#### Spike findings (TCL-83)

The mechanics were validated in temporary colocated test repos.

##### `jj workspace add` inside a jj repo: works

A nested workspace created at `.sandpiper/tasks/` behaved correctly:

- `jj workspace add .sandpiper/tasks --name tasks --revision @-` succeeded
- the main workspace's `jj st` remained clean after creation
- the parent repo's `git status` also remained clean
- uncommitted changes inside `.sandpiper/tasks/` did **not** leak into the parent workspace
- commits inside the nested workspace remained isolated from the parent workspace
- `jj workspace add .sandpiper/tasks --revision 'root()'` also worked, giving the task workspace truly independent history (not sharing the code branch ancestor)

##### `git worktree add` inside a jj repo: unsafe

A nested git worktree also looked clean from Git's point of view:

- parent `git status` remained clean
- parent `jj st` initially remained clean

But `jj` behavior inside the nested worktree was wrong:

- `jj st` inside the nested git worktree did **not** create separate workspace semantics
- `jj` commands there behaved as though they were still operating on the parent/default workspace
- commits in the nested git worktree affected the main jj workspace state instead of staying isolated

**Conclusion:** `git worktree` is not a safe backend when the current repo is jj-managed and the user is expected to keep using jj commands.

#### jj workspace approach (current repo is jj)

```bash
# Create the task workspace with independent history rooted at root()
jj workspace add .sandpiper/tasks --name tasks --revision 'root()'

# Optional: create a bookmark for remote sync
cd .sandpiper/tasks
jj bookmark create sandpiper-tasks -r @-
```

This produces a fully independent nested workspace at `.sandpiper/tasks/` while keeping the parent workspace clean.

#### Git worktree approach (current repo is plain git)

```bash
# Bootstrap: create orphan branch if it doesn't exist
git worktree add --orphan -b sandpiper-tasks .sandpiper/tasks

# Gitignore the path on the main branch
echo ".sandpiper/tasks/" >> .gitignore
```

In a plain git repo this gives the expected second checkout semantics.

#### External repo approach

When `mode.repo` is set, clone the external repo directly into `.sandpiper/tasks/`:

##### If the current repo is jj-managed

```bash
jj git clone --colocate <repo-url> .sandpiper/tasks
cd .sandpiper/tasks
jj edit root()  # or switch/create the configured branch as needed
```

##### If the current repo is plain git

```bash
git clone <repo-url> .sandpiper/tasks
cd .sandpiper/tasks
git checkout <branch>    # or create if needed
```

The CLI manages clone, pull, commit, and push as part of task operations — or exposes a `sandpiper tasks sync` command for manual control.

### CLI bootstrap behavior

On any task CLI invocation, the CLI resolves configuration and ensures storage is set up:

1. **Resolve config.** Check for a standalone config file at the project root. If present, use it. Otherwise, read `.sandpiper/settings.json` → `tasks` key. If neither exists, use defaults.
2. **Is `.sandpiper/tasks/` present and populated?** If yes, use it.
3. **Ensure storage matches config:**
   - `enabled: false` or no VCS → create the directory if missing.
   - `branch: "@"` → nothing to do, files are inline.
   - `branch: "<name>"` with no `repo` → ensure the separate checkout exists using the repo-appropriate backend (`jj workspace` in jj repos, `git worktree` in plain git repos).
   - `repo: "<url>"` → ensure the clone exists using the repo-appropriate clone semantics (`jj git clone --colocate` in jj repos, `git clone` in plain git repos), then ensure the configured branch is checked out.
4. **No config and no existing tasks directory?** Use defaults (`enabled: true, branch: "@"`) and create the directory.

The bootstrap is idempotent — running it multiple times is safe.

### Commit behavior in separate-branch mode

When `auto_commit` is enabled and tasks are on a separate branch, the CLI automatically commits to the task branch after each mutating operation:

- `task create` → commit "Create TCL-82: ..."
- `task update` → commit "Update TCL-82: ..."
- `task pickup` → commit "Pick up TCL-82"
- `task complete` → commit "Complete TCL-82 → DONE"

When `auto_commit` is disabled (the default), file changes accumulate in the task worktree and the user commits manually using their VCS tooling. This gives full control over commit granularity — a triage session that updates 12 tasks can be one commit or twelve, at the user's discretion.

### Push/pull behavior

When `auto_push` is enabled (and `auto_commit` is also enabled), the CLI pushes the task branch to its remote after each commit. This is opt-in because task operations should be fast and offline-capable by default — network I/O should be a conscious choice.

When `auto_push` is disabled (the default), the user pushes manually:

```bash
sandpiper tasks sync    # pull remote changes, then push local changes
sandpiper tasks push    # push only
sandpiper tasks pull    # pull only
```

For the external repo case, the same options apply with the addition of pull-before-operate to pick up remote changes when syncing.

## Implementation plan

### Phase 1 — Reduce inline churn (no config changes)

1. Gitignore `index.toon` and make the CLI auto-rebuild with mtime-based staleness detection.
2. Make scan-from-disk the primary counter allocation mechanism.
3. Verify that existing tests pass with the index absent at startup.

**Impact:** Eliminates the single noisiest file from VCS diffs. Every task operation touches one fewer file.

### Phase 2 — Separate-branch support (current repo)

1. Add `tasks.version_control` config schema to `.sandpiper/settings.json` and `.sandpiper-tasks.json`.
2. Implement backend detection (`.jj/` → `jj workspace`, `.git/` without `.jj/` → `git worktree`).
3. Implement branch bootstrap:
   - jj repo → `jj workspace add .sandpiper/tasks --revision 'root()'`
   - git repo → `git worktree add --orphan -b <branch> .sandpiper/tasks`
4. Implement gitignore updates for the main checkout.
5. Implement auto-commit / manual-commit behavior according to config.
6. Implement `sandpiper tasks sync` for push/pull.
7. Migration command: move existing inline tasks to the configured branch.

### Phase 3 — External repo support

1. Implement clone-based bootstrap for `mode.repo` using repo-appropriate clone semantics:
   - jj repo → `jj git clone --colocate`
   - git repo → `git clone`
2. Handle branch selection / creation after clone.
3. Handle pull-before-operate for remote changes.
4. Handle conflict detection and resolution guidance.

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

## Resolved decisions

1. **Auto-commit** — opt-in via `auto_commit: true` in config. Default `false`. User controls commit granularity.
2. **Auto-push** — opt-in via `auto_push: true` in config. Default `false`. Offline-first by default.
3. **Settings file location** — two locations, standalone overrides sandpiper settings. The standalone file lives at the project root (not in `.sandpiper/` or the tasks directory) so it can be committed to `main` even when tasks are on a separate branch.
4. **Standalone config filename** — `.sandpiper-tasks.json`.
5. **Standalone config format** — JSON only, matching the base sandpiper config to simplify migration strategies.
6. **`@` sentinel in external repo context** — when `repo` is set and `branch` is `"@"`, the default branch is whatever HEAD points to on the cloned remote. This is standard `git clone` / `jj git clone` behavior and does not require special handling. Documented in the `mode.branch` section.
7. **Backend selection rule** — current repo: jj → `jj workspace`, git → `git worktree`. External repo: always plain clone, using the same VCS semantics as the current repo (`jj git clone --colocate` in jj repos, `git clone` in git repos).
8. **History files** — retained. VCS history is lossy (squashing destroys intermediate states); history files are an append-only audit trail that survives VCS curation and enables efficient rendering for TUI/web UI.

## Open questions

1. **Bootstrap UX** — when separate-branch or external-repo mode is configured but storage is not yet initialized, should the CLI auto-bootstrap silently, prompt interactively, or fail with an actionable message plus an explicit init command? Leaning toward explicit bootstrap command plus actionable guidance for safety.
2. **Root-based history and remotes** — for the jj workspace backend, should the implementation always root the task workspace at `root()` from day one, or make that configurable? Root-based independent history is desirable, but we should validate the remote push/pull ergonomics before hard-coding it into the implementation.
