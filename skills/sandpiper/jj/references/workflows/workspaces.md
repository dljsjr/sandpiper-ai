# Workspaces

Load this reference when setting up multiple working copies of one repo — for distinct dev
servers, parallel builds, per-task filesystem isolation, or parallel agent sessions.

jj workspaces are the equivalent of Git worktrees, with two notable advantages:

- Workspaces share the same object store and op log — operations in one are visible in others
- jj's history-manipulation commands (`squash`, `rebase`, `absorb`) work across workspaces via
  revset references, making cross-workspace content reorganization tractable

For agent-specific parallel-session patterns built on workspaces, see
`workflows/parallel-agents.md`. This document focuses on workspace mechanics.

Topics:

1. What a workspace is
2. Creating and navigating
3. Use cases
4. Shared state and isolation
5. Pitfalls
6. Cleanup

---

## 1. What a workspace is

A workspace is a separate directory with its own working-copy checkout, tied to the same jj repo.
Each workspace has:

- Its own working-copy commit (`@` in workspace A is distinct from `@` in workspace B)
- Its own workspace name (default: the directory name)
- Separate files on disk (workspace A's directory is independent of workspace B's)

Shared between workspaces:

- Object store (all commits, change IDs)
- Op log
- Bookmarks and remote tracking
- Configuration (with optional per-workspace override via workspace config)

The effect: two workspaces are two windows into the same jj repo, each with a different `@`.

---

## 2. Creating and navigating

### Add a workspace

```console
jj workspace add ../my-second-workspace --rev main
cd ../my-second-workspace
```

The second workspace starts with `@` as an empty commit on top of `main`. Proceed normally — edit,
commit, push.

Common options:

- `--name <name>` — workspace identifier (default: directory name)
- `--rev <revset>` — parent(s) for the new working-copy commit
- `--sparse-patterns copy-from=@` — copy sparse checkout patterns from current workspace

### Version note: relative paths (0.39.0+)

As of 0.39.0, `jj workspace add` creates workspace links using relative paths by default, making
workspaces portable across machines. Pre-0.39 workspaces used absolute paths and continue to work.

### List workspaces

```console
jj workspace list
```

Shows each workspace name and the commit its `@` points to.

### Operate on workspaces by name

From any workspace, you can reference other workspaces' `@`:

```console
jj log -r '<workspace-name>@'          # that workspace's working copy commit
jj log -r 'all_workspaces()@'          # all workspaces' working copies
```

---

## 3. Use cases

### Separate dev servers / ports

Each workspace runs its own dev server on its own port:

```console
# In ../project-wip-1
PORT=3001 npm run dev

# In ../project-wip-2
PORT=3002 npm run dev
```

Each working directory has its own `node_modules/`, `.next/`, `dist/`, etc. — no collision.

### Parallel feature development

Work on `feat-a` in workspace 1, `feat-b` in workspace 2. Switch without losing context:

```console
jj workspace add ../proj-feat-a --rev feat-a
jj workspace add ../proj-feat-b --rev feat-b
```

Each workspace has the feature branch checked out; commits land on the appropriate branch.

### Build isolation

Large projects with slow cold builds benefit from per-task workspaces so that caches (`target/`,
`node_modules/`, compiler-output dirs) don't invalidate when switching tasks.

### Parallel agent sessions

The big use case. One agent per workspace, each running its own dev server, each with its own
working copy. Merge results back via jj's history commands across the shared op log. See
`workflows/parallel-agents.md`.

The core benefit: each agent operates on a separate copy of the codebase, with its own
working-copy commit, its own dependency install directories, and its own build artifacts. The
agents share the op log so their commits are visible to each other and to any orchestrator.

### Long-running build / test while continuing work

Workspace A runs a test suite; workspace B lets you edit files for the next change. Useful when
tests are 10+ minutes.

---

## 4. Shared state and isolation

### Shared: commits, op log, bookmarks

A commit made in workspace A is immediately visible in workspace B (after jj's automatic
`git import`). Bookmarks moved in A are seen in B. The op log is shared — `jj op log` shows ops
from all workspaces (0.40.0+ annotates with workspace name).

This means you can:

- Rebase a commit from workspace A to be based on workspace B's `@`, via revset references
- Squash content from workspace A's `@` into a commit in workspace B's history
- Use `jj absorb` in A to distribute changes into commits that also appear in B's log

### Not shared: working-copy files

Workspace A's `src/foo.ts` and workspace B's `src/foo.ts` are separate files on disk. Neither
workspace sees the other's uncommitted changes until they're committed. This is why workspaces
are useful for isolation.

### Not shared by default: configs

Workspace-specific config lives at a path discoverable via `jj config path --workspace`. Per-repo
config at `jj config path --repo` is shared across workspaces. Use `--workspace` scope for things
that differ per workspace (e.g., a distinct editor per workspace).

---

## 5. Pitfalls

### "Stale working copy" errors

Symptom: a jj command reports that the working copy is stale.

Cause: another workspace or an operation on the shared op log made changes that invalidate the
current workspace's `@`. Often happens when workspace A rebases ancestors of workspace B's `@`.

Resolution:

```console
jj workspace update-stale
```

This reconciles the working copy with the latest op log. Usually resolves automatically. If it
doesn't, inspect with `jj op log` and `jj --at-op=<prior-op> log` to understand what changed.

### Hanging commands

Occasionally jj commands in a multi-workspace setup hang for reasons that aren't well-understood.
Known rough edge. Workaround: wait. Do not `rm -rf .jj`.

### Default `jj log` doesn't snapshot other workspaces

`jj log` shows the state of the current workspace's op log, but doesn't automatically snapshot
other workspaces' working copies first. If workspace A has uncommitted changes and workspace B
runs `jj log -r 'a@'`, it may show stale state for `@` in workspace A.

Workaround:

```console
jj util snapshot                       # snapshot current workspace
# (Or run a jj command in each workspace to force snapshot)
```

A more automated approach with an alias that snapshots all workspaces before logging is doable
but non-trivial.

### Never `rm -rf .jj` to "fix" anything

Same rule as always. `.jj/` is the shared store for all workspaces. Deleting it strands every
workspace.

---

## 6. Cleanup

### Remove a workspace

```console
jj workspace forget <workspace-name>
```

This removes the workspace's tracking metadata. The directory on disk is not removed — delete it
manually if you want:

```console
rm -rf ../my-second-workspace
```

The commits that were on the workspace's `@` remain in the repo (as long as they're reachable via
bookmarks or are mutable). To fully clean up, also abandon any dead commits:

```console
jj abandon <change-id>
```

### GC

After a lot of workspace churn, unreachable objects may accumulate. Clean with:

```console
jj util gc
```

This is the only command that destroys state. Run occasionally; it is the only way the op log
gets trimmed.

---

## Quick reference

```console
jj workspace add <dir> --rev <rev>     # create
jj workspace list                      # list
jj workspace update-stale              # fix stale working copy
jj workspace forget <name>             # remove
jj log -r '<workspace-name>@'          # other workspace's @
jj log -r 'all_workspaces()@'          # all working-copy commits
```
