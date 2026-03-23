---
name: jj
description: >-
  Use Jujutsu (jj) for version control instead of Git. Use for all version control
  operations — committing changes, viewing diffs and history, creating and managing
  branches (called bookmarks in jj), rebasing, squashing, pushing, pulling, undoing
  operations, resolving conflicts, and interacting with Git remotes. Use whenever the
  user wants to commit, view a diff or log, create or manage branches, push or pull,
  rebase or squash commits, undo a mistake, resolve merge conflicts, or do any version
  control work. Also use when the user mentions "jj", "jujutsu", or uses Git terminology
  like "commit", "branch", "push", "pull", "stash", "rebase", "cherry-pick", "blame",
  "log", or "diff" — jj has equivalents for all of these.
compatibility: Requires jj CLI installed (brew install jj / cargo install jj-cli).
---

# Jujutsu (jj) Version Control Skill

jj is a Git-compatible version control tool with a simpler, safer mental model. Always use `jj` commands rather than `git` — even though the underlying repo is Git-backed, jj's model avoids entire categories of mistakes (lost work, detached HEAD, botched rebases) because every operation is automatically recorded and undoable.

## Core Concepts

These aren't just trivia — they change how you work:

- **No staging area** — changes are automatically tracked. The working copy IS a commit (`@`). This means there's no "forgot to `git add`" class of mistake.
- **Commits are mutable** — rewrite history freely with `describe`, `squash`, `absorb`, `split`. There's no penalty for committing early and refining later.
- **Change IDs are persistent** — a change keeps its identity as it evolves (rebased, amended, etc.). You can always find a commit even after it's been rewritten.
- **Bookmarks** (not branches) — named pointers to commits, similar to Git branches but decoupled from the commit graph.
- **Operation log** — every repo mutation is recorded and undoable. Nothing is irreversible. This is the safety net that makes aggressive history rewriting safe.

## How to Work with jj

These patterns matter because jj's mental model rewards a different workflow than Git. In Git, you carefully stage and craft commits because rewriting history is painful. In jj, commits are cheap and mutable — commit early, refine later.

### Commit frequently, refine later

Since there's no staging area, `jj commit` captures all working copy changes. Commit after each logically complete unit of work. Don't worry about getting the message or scope perfect — you can always fix it with `jj describe` or `jj squash` later.

- `jj describe -m "better message"` — update the current commit's message without creating a new commit
- `jj commit -m "msg"` — equivalent to `jj describe -m "msg"` followed by `jj new`
- When wrapping up a unit of work and moving on, prefer `jj commit` over `jj describe` — it leaves the working copy clean on a new empty commit, ready for the next task

### Fix earlier commits with squash and absorb

When you find an issue in an earlier commit (typo, review feedback, small fix), don't create a new "fix" commit. Instead, make the fix in `@` and move it into the right commit:

- `jj squash --from @ --into <target> -m "msg"` — move changes from the current commit into a specific earlier commit
- `jj absorb` — automatically distribute changes to the ancestor commits that last touched those lines (like an intelligent squash)
- Check your work with `jj op show -p` after squash/absorb to verify the result

### Curate history before pushing

Multiple small commits from iterative development should be collapsed into logical units before pushing. Think "one commit per PR/feature." Use `jj squash` to combine related work.

Be mindful of how `jj squash` handles commit messages to avoid opening an editor (which hangs in non-interactive contexts):
- If the source has no description (common when squashing `@`), jj keeps the destination's message automatically — no flags needed
- If you want to discard the source's description and keep the destination's, use `--use-destination-message` (`-u`)
- If both have descriptions and you want to set a new one, provide `-m "message"`

### The safety net

Nothing in jj is irreversible. If something goes wrong:

- `jj undo` — reverts the last operation (repeatable)
- `jj op log` — shows full operation history
- `jj op restore <id>` — jumps to any point in time

This is why aggressive history rewriting is safe in jj — you can always go back.

## Status and Information

```bash
jj status                 # Show repo status (alias: jj st)
jj log                    # Show commit history (mutable revisions + context)
jj log -r ::@             # Show ancestors of current commit
jj log -r all()           # Show all commits
jj log --limit 10         # Limit output
jj log -T 'description.first_line() ++ "\n"'  # Custom template
jj show                   # Show current commit's description and changes
jj show <rev>             # Show a specific revision
jj diff                   # Show changes in working copy vs parent
jj diff -r <rev>          # Show changes in a specific revision
jj diff --from A --to B   # Compare two revisions directly
jj diff --stat            # Summary with file change stats
```

## Making Changes

```bash
jj commit -m "Message"    # Snapshot working copy with message, create new empty @
jj describe -m "Message"  # Update current commit's description (no new commit)
jj new                    # Create new empty commit on top of @ (like starting fresh)
jj new -m "Message"       # Create new commit with description
jj new A B                # Create new commit with multiple parents (merge)
jj edit <rev>             # Set a different revision as the working copy
jj abandon                # Remove current commit, rebase descendants onto parent
jj abandon <rev>          # Remove a specific revision
```

### commit vs describe vs new

- `jj commit -m "msg"` = `jj describe -m "msg"` + `jj new` (snapshot + start fresh)
- `jj describe -m "msg"` = just update the message, keep working in same commit
- `jj new` = start a new empty commit on top of current

## Fixups: Amending Earlier Commits

**Prefer fixups over new commits** when addressing issues in existing work. jj makes history rewriting safe and easy.

### squash — Move changes into another commit

```bash
jj squash                          # Move all @ changes into parent
jj squash -r <rev>                 # Squash a specific revision into its parent
jj squash --from <rev> --into <target> -m "msg"  # Move changes between any two commits
jj squash --from A --into B --ignore-immutable -m "msg"  # Allow modifying immutable commits
jj squash -i                       # Interactive: choose which hunks to move
jj squash <paths>                  # Move only changes to specific paths
jj squash --keep-emptied           # Don't abandon source even if it becomes empty
jj squash -u                       # Use destination's message (discard source message)
```

Key behaviors:
- If source becomes empty after squash and `--keep-emptied` is not set, source is abandoned
- When squashing with `-m`, the provided message replaces both source and destination messages
- Use `-u` / `--use-destination-message` to keep the target's message without opening an editor
- **Always provide `-m` in non-interactive contexts** to avoid opening an editor

### absorb — Auto-distribute changes to the right commits

```bash
jj absorb                          # Auto-distribute @ changes into ancestor stack
jj absorb --from <rev>             # Absorb from a specific revision
jj absorb --into <revset>          # Limit which ancestors to consider
jj absorb <paths>                  # Only absorb changes to specific paths
```

`absorb` is like an intelligent `squash` — it looks at each changed line, finds the most recent ancestor that modified that line, and moves the change there. Ideal for:
- Fixing typos or small issues across multiple earlier commits
- Applying code review feedback to the correct original commits
- Review results with `jj op show -p`

### split — Break a commit into pieces

```bash
jj split                           # Interactive: split current commit in two
jj split -r <rev>                  # Split a specific revision
jj split <paths>                   # Non-interactive: split by file paths
```

`split` opens a diff editor. Edit the right side to contain what you want in the first commit; the rest goes into the second commit. **Note: interactive, requires editor** — not suitable for fully automated use. Use `jj squash` with paths for non-interactive splitting.

## Bookmarks

```bash
jj bookmark list                   # List bookmarks (alias: jj b l)
jj bookmark create <name>         # Create a bookmark at @
jj bookmark create <name> -r <rev>  # Create at specific revision
jj bookmark set <name>            # Move bookmark to @ 
jj bookmark set <name> -r <rev>   # Move bookmark to specific revision
jj bookmark delete <name>         # Delete (propagates to remotes on next push)
jj bookmark forget <name>         # Forget locally (doesn't propagate deletion)
jj bookmark move <name>           # Move to @
jj bookmark rename <old> <new>    # Rename a bookmark
jj bookmark track <name>@<remote>  # Start tracking a remote bookmark
jj bookmark untrack <name>@<remote>  # Stop tracking
```

## Rebasing

```bash
jj rebase -r <rev> -d <dest>      # Rebase single revision onto destination
jj rebase -s <rev> -d <dest>      # Rebase revision and all descendants
jj rebase -b <rev> -d <dest>      # Rebase whole branch (revision and ancestors up to fork point)
jj rebase -r @ -d main            # Rebase current commit onto main
```

## Restoring and Reverting

```bash
jj restore                         # Restore working copy to parent's state
jj restore <paths>                 # Restore specific paths from parent
jj restore --from <rev>            # Restore from a specific revision
jj restore --from <rev> --to <rev>  # Restore paths between two revisions
jj revert -r <rev>                 # Apply the reverse of a revision (creates new commit)
```

## Inspection and Comparison

```bash
jj evolog                          # Show how current change evolved over time
jj evolog -r <rev>                 # Show evolution of a specific change
jj evolog -p                       # Show with patches
jj interdiff --from A --to B      # Compare what two revisions *do* (their diffs), not their content
jj file annotate <path>           # Blame: show which change introduced each line
jj file list                      # List files in current revision
jj file show <path>               # Print file contents at current revision
jj file show <path> -r <rev>      # Print file contents at specific revision
```

## Navigation

```bash
jj next                            # Move working copy to child (creates new @ on top of child)
jj next --edit                     # Move working copy to child (edit child directly)
jj next 3                          # Move forward 3 revisions
jj prev                            # Move working copy to parent
jj prev --edit                     # Edit parent directly
jj next --conflict                 # Jump to next conflicted descendant
jj prev --conflict                 # Jump to previous conflicted ancestor
```

## Conflict Resolution

```bash
jj resolve                         # Open external merge tool for conflicted files
jj resolve --list                  # List conflicted files
jj resolve <path>                  # Resolve a specific file
```

## Git Interoperability

```bash
jj git fetch                       # Fetch from Git remotes
jj git push                        # Push to Git remotes
jj git push --bookmark <name>     # Push specific bookmark
jj git clone <url>                 # Clone a Git repository
jj git init                        # Initialize a Git-backed jj repository
```

Pull changes (equivalent to `git pull`):
```bash
jj git fetch
jj rebase -d <bookmark>@origin    # e.g., jj rebase -d main@origin
```

## Operation Log (Time Travel)

Every jj operation is recorded. Nothing is irreversible.

```bash
jj operation log                   # Show operation history (alias: jj op log)
jj operation log -p                # Show with patches
jj operation show                  # Show what the last operation changed
jj operation show <op-id>         # Show what a specific operation changed
jj operation show -p               # Show with detailed diffs
jj operation diff --from A --to B  # Compare repo state between two operations
jj undo                            # Undo the last operation (repeatable)
jj redo                            # Redo the most recently undone operation
jj operation restore <op-id>      # Jump to a specific point in history
```

## Advanced Operations

### Duplicate
```bash
jj duplicate                       # Duplicate current commit
jj duplicate <revs>               # Duplicate specific revisions
jj duplicate --onto <rev>         # Duplicate onto a different parent
```

### Parallelize
```bash
jj parallelize A::B               # Make A and B siblings instead of parent-child
```

### Simplify Parents
```bash
jj simplify-parents               # Remove redundant parent edges
```

### Metadata Editing
```bash
jj metaedit -m "new message"      # Change message without opening editor
jj metaedit --update-author       # Update author to configured user
jj metaedit --author "Name <email>"  # Set specific author
```

### Diff Editing
```bash
jj diffedit                        # Edit the diff of current commit in a diff editor
jj diffedit -r <rev>              # Edit a specific revision's diff
jj diffedit --from A --to B       # Edit the diff between two revisions
```

### Fix (Auto-formatting)
```bash
jj fix                             # Apply configured formatters to changed files
jj fix -s <rev>                   # Fix a revision and its descendants
```

### Bisect
```bash
jj bisect run --bad <rev> --good <rev> -- <command>  # Find first bad revision
```

## Workspaces

```bash
jj workspace list                  # List workspaces
jj workspace add <path>           # Add a workspace (separate working copy, same repo)
jj workspace forget <name>        # Remove a workspace
jj workspace root                  # Show workspace root (alias: jj root)
```

## Configuration

```bash
jj config list                     # List all config values
jj config get <key>               # Get a specific config value
jj config set --user <key> <val>  # Set user-level config
jj config set --repo <key> <val>  # Set repo-level config
jj config edit --user              # Edit user config in editor
jj config path --user              # Show config file path
```

## Common Mistakes

**Unexpected editor on squash**: jj opens an editor when both source and destination have descriptions and you don't specify `-m` or `-u`. In non-interactive contexts this hangs. Use `-m "message"` to set a new description, or `-u` to keep the destination's.

**Using `git` commands in a jj repo**: The Git CLI and jj can conflict because they both manage the same underlying Git repository. Stick to jj commands — they're safer and more capable.

**Immutable commit errors**: If you get "immutable commit" errors when trying to squash into a commit that's already on main/trunk, add `--ignore-immutable` to the command.

**Confusing `commit` and `describe`**: `jj commit` creates a *new* empty commit on top. If you just want to update the current commit's message without starting a new one, use `jj describe`.

**Not verifying after squash/absorb**: Always run `jj op show -p` after a squash or absorb to confirm the changes landed where you expected.

## Reference Documentation

- [Jujutsu Documentation](https://docs.jj-vcs.dev/latest/)
- [Git Command Table](https://docs.jj-vcs.dev/latest/git-command-table/)
- [Revset Language](https://docs.jj-vcs.dev/latest/revsets/)
- [Template Language](https://docs.jj-vcs.dev/latest/templates/)
