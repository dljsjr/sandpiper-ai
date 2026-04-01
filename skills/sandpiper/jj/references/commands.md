# jj Command Reference

Complete reference for all jj CLI commands with flags and options.

## Table of Contents
- [Global Options](#global-options)
- [Repository Setup](#repository-setup)
- [Creating and Navigating Changes](#creating-and-navigating-changes)
- [Describing and Committing](#describing-and-committing)
- [Viewing Changes and History](#viewing-changes-and-history)
- [Rewriting History](#rewriting-history)
- [Bookmarks](#bookmarks)
- [Git Operations](#git-operations)
- [Operation Log](#operation-log)
- [Conflict Resolution](#conflict-resolution)
- [File Operations](#file-operations)
- [Workspace Management](#workspace-management)
- [Other Commands](#other-commands)

---

## Global Options

These flags apply to all commands:

| Flag | Purpose |
|------|---------|
| `-R, --repository <PATH>` | Path to repo (default: searches for `.jj/` in ancestors) |
| `--ignore-working-copy` | Don't snapshot or update working copy |
| `--ignore-immutable` | Allow rewriting immutable commits |
| `--at-operation <OP>` (`--at-op`) | Load repo at specific operation |
| `--color <WHEN>` | `always\|never\|debug\|auto` |
| `--quiet` | Silence non-primary output |
| `--no-pager` | Disable pager |
| `--config <NAME=VALUE>` | Additional TOML config (repeatable) |
| `--config-file <PATH>` | Additional config file (repeatable) |

---

## Repository Setup

### `jj git init [DESTINATION]`
Create a new Git-backed jj repo. Default destination: `.` (current directory).
- `--colocate` — (DEFAULT) `.jj` and `.git` side by side; Git tools work alongside jj
- `--no-colocate` — Git repo hidden inside `.jj/`
- `--git-repo <PATH>` — Use existing Git repo as backend

### `jj git clone <SOURCE> [DESTINATION]`
Clone a Git repo into a jj workspace.
- `--colocate` / `--no-colocate` — Colocation control (colocate is default)
- `--remote <NAME>` — Remote name (default: `origin`)
- `--depth <N>` — Shallow clone
- `-b, --branch <BRANCH>` — Specific branch(es) to fetch (glob patterns, repeatable)

---

## Creating and Navigating Changes

### `jj new [REVSETS]...`
Create a new empty change. Default parent: `@`.
- `-m, --message <MSG>` — Set description
- `--no-edit` — Don't make it the working copy
- `-A, --insert-after <REVSETS>` — Insert after given commits, rebasing their children
- `-B, --insert-before <REVSETS>` — Insert before given commits
- Multiple parents creates a merge: `jj new main feature-a feature-b`

### `jj edit <REVSET>`
Set a revision as the working-copy commit. Future file changes modify that commit directly.
This is how you go back and edit earlier commits.

### `jj next [OFFSET]`
Move working copy to child revision. Default offset: 1.
- `-e, --edit` — Edit target directly (vs creating new commit on top)
- `--conflict` — Jump to next conflicted descendant

### `jj prev [OFFSET]`
Move working copy to parent revision. Default offset: 1.
- `-e, --edit` — Edit target directly
- `--conflict` — Jump to previous conflicted ancestor

---

## Describing and Committing

### `jj describe [REVSETS]...` (alias: `desc`)
Update change description. Default: `@`.
- `-m, --message <MSG>` — Set description without opening editor
- `--stdin` — Read description from stdin
- `--editor` — Force editor open even with `--message`

### `jj commit [FILESETS]...` (alias: `ci`)
Finalize working copy: equivalent to `jj describe` + `jj new`.
- `-m, --message <MSG>` — Description for the finalized commit
- `-i, --interactive` — Interactively choose what to include
- `--tool <NAME>` — Diff editor for selection

---

## Viewing Changes and History

### `jj log [FILESETS]...`
Show revision history as a graph.
- `-r, --revisions <REVSETS>` — Which revisions (default: configurable via `revsets.log`)
- `-n, --limit <N>` — Limit number of entries
- `-T, --template <TMPL>` — Custom template
- `-p, --patch` — Show diffs inline
- `-s, --summary` — File-level change summary
- `--stat` — Diffstat
- `--reversed` — Oldest first
- `--no-graph` — Flat list without graph lines

### `jj diff [FILESETS]...`
Compare file contents between revisions.
- `-r, --revision <REVSETS>` — Show changes in these revisions (default: `@`)
- `-f, --from <REV>` / `-t, --to <REV>` — Explicit from/to
- `-s, --summary` — File-level summary
- `--stat` — Diffstat
- `--git` — Git-format diff
- `--color-words` — Word-level coloring
- `--name-only` — File names only
- `--types` — Show file types
- `--tool <TOOL>` — External diff tool

### `jj show [REVSET]`
Show commit description and diff. Default: `@`.
- `-T, --template <TMPL>` — Custom template
- Same diff format options as `jj diff`

### `jj status [FILESETS]...` (alias: `st`)
High-level repo status: working copy info, conflicts, conflicted bookmarks.

### `jj interdiff [FILESETS]...`
Compare the diffs of two revisions (what changed between two patches).
- `-f, --from <REV>` / `-t, --to <REV>` — The two revisions to compare

### `jj evolog [OPTIONS]` (alias: `evolution-log`)
Show how a change evolved over time (all predecessors of a change ID).
- `-r, --revision <REVSETS>` — Default: `@`
- `-p, --patch` — With diffs

---

## Rewriting History

### `jj squash [FILESETS]...`
Move changes from one revision into another.
- Default: move `@` changes into `@-`
- `-r, --revision <REV>` — Squash this revision into its parent
- `-f, --from <REVSETS>` / `-t, --into <REV>` — Explicit source/destination
- `-i, --interactive` — Select hunks interactively
- `--tool <NAME>` — Diff editor for interactive mode
- `-k, --keep-emptied` — Don't abandon source if it becomes empty
- `-m, --message <MSG>` — Description for result
- `-u, --use-destination-message` — Keep destination's description

### `jj split [FILESETS]...`
Split a revision into two. Opens diff editor to select what stays in the first commit.
- `-r, --revision <REV>` — Revision to split (default: `@`)
- `-p, --parallel` — Create siblings instead of parent-child
- `-m, --message <MSG>` — Description for first (selected) commit
- `-i, --interactive` — Interactive mode (default when no filesets given)

### `jj absorb [FILESETS]...`
Automatically move changes from source into the correct ancestor commits based on which
lines were last modified there. Conservative: leaves changes if destination is ambiguous.
- `-f, --from <REVSET>` — Source (default: `@`)
- `-t, --into <REVSETS>` — Destination ancestors (default: `mutable()`)

### `jj rebase`
Move revisions to different parent(s).

**What to rebase (pick one):**
- `-b, --branch <REVSETS>` — Whole branch (default if none specified: `-b @`)
- `-s, --source <REVSETS>` — Revision + all descendants
- `-r, --revisions <REVSETS>` — Only specified revisions (descendants reconnect to grandparent)

**Where to rebase (pick one):**
- `-o, --onto <REVSETS>` — Rebase onto these targets
- `-A, --insert-after <REVSETS>` — Insert after targets
- `-B, --insert-before <REVSETS>` — Insert before targets

**Options:**
- `--skip-emptied` — Abandon commits that become empty after rebase

### `jj duplicate [REVSETS]...`
Create copies of commits. Default: `@`.
- `-o, --onto <REVSETS>` — Where to place duplicates

### `jj abandon [REVSETS]...`
Abandon revision(s), rebasing descendants onto their parents. Default: `@`.
- `--restore-descendants` — Preserve content of children

### `jj restore [FILESETS]...`
Restore paths from another revision.
- `-f, --from <REV>` — Source revision
- `-t, --into <REV>` — Destination
- `-c, --changes-in <REV>` — Undo changes made in a specific revision
- `-i, --interactive` — Choose interactively

### `jj revert -r <REVSETS> <placement>`
Create reverse of given revision(s). Must specify placement:
`--onto`, `--insert-after`, or `--insert-before`.

### `jj diffedit [FILESETS]...`
Edit changes in a revision using a diff editor.
- `-r, --revision <REV>` — Default: `@`

### `jj parallelize [REVSETS]...`
Make revisions siblings instead of a chain.

### `jj simplify-parents`
Remove redundant parent edges from merge commits.

### `jj arrange`
Interactively arrange the commit graph.

---

## Bookmarks

Bookmarks are jj's equivalent of Git branches. They're named pointers to commits, used
primarily for Git interop and pushing to remotes.

### `jj bookmark create <NAMES>...` (alias: `jj b c`)
Create bookmark(s) at a revision.
- `-r, --revision <REV>` — Target (default: `@`)

### `jj bookmark set <NAMES>...` (alias: `jj b s`)
Create or update bookmark.
- `-r, --revision <REV>` — Target (default: `@`)
- `-B, --allow-backwards` — Allow moving backwards/sideways

### `jj bookmark move [NAMES]...` (alias: `jj b m`)
Move existing bookmarks.
- `-f, --from <REVSETS>` — Move from these revisions
- `-t, --to <REV>` — Target (default: `@`)
- `-B, --allow-backwards`

### `jj bookmark delete <NAMES>...` (alias: `jj b d`)
Delete bookmark(s). Propagates deletion on next push. Glob patterns supported.

### `jj bookmark list [NAMES]...` (alias: `jj b l`)
List bookmarks.
- `-a, --all-remotes` — Show all remote bookmarks
- `-t, --tracked` — Show only tracked
- `-c, --conflicted` — Show only conflicted
- `-T, --template <TMPL>` — Custom template

### `jj bookmark track <BOOKMARK@REMOTE>...`
Start tracking a remote bookmark (enables auto-merge on fetch).

### `jj bookmark untrack <BOOKMARK@REMOTE>...`
Stop tracking a remote bookmark.

### `jj bookmark rename <OLD> <NEW>`
Rename a bookmark.

---

## Git Operations

### `jj git fetch`
Fetch from Git remote(s).
- `-b, --branch <BRANCH>` — Specific branch pattern (glob, repeatable)
- `--remote <REMOTE>` — Specific remote (repeatable)
- `--all-remotes` — Fetch from all remotes
- `--tracked` — Fetch only tracked bookmarks

### `jj git push`
Push to Git remote. Safety: like `git push --force-with-lease`.
- `-b, --bookmark <PATTERN>` — Push specific bookmark(s)
- `-c, --change <REVSETS>` — Auto-create bookmark from change ID and push
- `-r, --revisions <REVSETS>` — Push bookmarks pointing to these commits
- `--all` — Push all bookmarks
- `--dry-run` — Preview only
- `--allow-empty-description` — Allow pushing commits without descriptions

### `jj git import`
Update jj from underlying Git repo (automatic in colocated repos).

### `jj git export`
Update Git repo from jj (automatic in colocated repos).

### `jj git remote add|remove|rename|list|set-url`
Manage Git remotes (same semantics as `git remote`).

### `jj git colocation enable|disable|status`
Convert between colocated and non-colocated modes, or check current mode.

---

## Operation Log

### `jj op log`
View operation history.
- `-n, --limit <N>` — Limit entries
- `-p, --patch` — Show file diffs per operation
- `-d, --op-diff` — Show repo changes per operation

### `jj op show [OPERATION]`
Show changes in an operation.

### `jj op restore <OPERATION>`
Restore repo to a prior state.
- `--what <WHAT>` — `repo`, `remote-tracking` (both default)

### `jj op revert [OPERATION]`
Revert a specific operation (apply inverse).

### `jj undo`
Undo the last operation.

### `jj redo`
Redo the most recently undone operation.

---

## Conflict Resolution

### `jj resolve [FILESETS]...`
Resolve conflicts with external merge tool.
- `-r, --revision <REV>` — Target revision (default: `@`)
- `-l, --list` — List conflicts instead of resolving
- `--tool <NAME>` — Merge tool. Built-in options: `:ours`, `:theirs`

---

## File Operations

### `jj file annotate <PATH>`
Like `git blame`. Show source change for each line.
- `-r, --revision <REV>` — Starting revision

### `jj file list [FILESETS]...`
List files in a revision.

### `jj file show <FILESETS>...`
Print file contents at a revision.

### `jj file track <FILESETS>...`
Start tracking paths.

### `jj file untrack <FILESETS>...`
Stop tracking (must be in `.gitignore` first).

### `jj file chmod <MODE> <FILESETS>...`
Set executable bit. `n` = normal, `x` = executable.

---

## Workspace Management

### `jj workspace add <DESTINATION>`
Add new workspace (separate working copy, same repo).
- `--name <NAME>` — Workspace name
- `-r, --revision <REVSETS>` — Parent(s) for new working-copy commit

### `jj workspace forget [WORKSPACES]...`
Stop tracking workspace.

### `jj workspace list`
List all workspaces.

### `jj workspace update-stale`
Update stale workspace after repo changes from another workspace.

---

## Other Commands

### `jj fix [FILESETS]...`
Run configured code formatters on files in mutable revisions.
- `-s, --source <REVSETS>` — Fix these + descendants (default: `reachable(@, mutable())`)

### `jj bisect run --range <REVSETS> [COMMAND] [ARGS]...`
Binary search for first bad revision.
- Exit codes: 0=good, 125=skip, 127=abort, other=bad

### `jj sparse set|list|reset|edit`
Manage sparse checkout patterns (only check out certain paths).

### `jj config edit <--user|--repo|--workspace>`
Open config file in editor.

### `jj config set <--user|--repo|--workspace> <NAME> <VALUE>`
Set a config option.

### `jj config list [NAME]`
List config values.

### `jj util gc`
Garbage collect unreachable objects.

### `jj help [COMMAND]`
Help. Use `-k <keyword>` for topic help: `bookmarks`, `config`, `filesets`, `glossary`,
`revsets`, `templates`, `tutorial`.
