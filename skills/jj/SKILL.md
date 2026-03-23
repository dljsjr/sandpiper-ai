---
name: jj
description: Use Jujutsu (jj) for version control instead of Git. Includes common commands, advanced features, and Git interoperability. Use for ALL version control operations in repositories that support jj, even when Git interoperability commands are available.
---

# Jujutsu (jj) Version Control Skill

**IMPORTANT**: Always prefer jj commands over git commands in jj repositories, even when Git interoperability is available.

## Core Concepts

- **No staging area** — changes are automatically tracked. The working copy IS a commit (`@`).
- **Commits are mutable** — rewrite history freely with `describe`, `squash`, `absorb`, `split`.
- **Change IDs are persistent** — a change keeps its identity as it evolves (rebased, amended, etc.).
- **Bookmarks** (not branches) — named pointers to commits, similar to Git branches but more flexible.
- **Operation log** — every repo mutation is recorded and undoable.

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

## Agent-Specific Workflow Guidance

### Commit Hygiene

**Commit frequently.** No staging area means `jj commit` captures ALL working copy changes. Commit after each logically complete unit of work to keep changes separate.

**Use `jj describe` to update messages** without creating new commits. `jj describe -m "msg"` is a no-op if working on the current commit's content.

**Use fixups aggressively.** When you find an issue in an earlier commit, fix it in `@` then use `jj squash --from @ --into <target> -m "msg"` or `jj absorb` to move the fix into the right commit. This keeps history clean without the overhead of interactive rebasing.

### History Curation

**Squash related work together** at the end of a work session. Multiple small commits from iterative development should be collapsed into logical units before pushing. Think "one commit per PR/feature."

**Always provide `-m` with squash** to avoid opening an editor (which hangs in non-interactive contexts).

**Use `--ignore-immutable`** when squashing commits that are on main/trunk in a trunk-based workflow.

### Safety Net

**Nothing is irreversible.** `jj undo` reverts the last operation and can be repeated. `jj op log` shows full history. `jj op restore <id>` jumps to any point in time.

**Check your work with `jj op show -p`** after squash/absorb operations to verify the result.

## Reference Documentation

- [Jujutsu Documentation](https://docs.jj-vcs.dev/latest/)
- [Git Command Table](https://docs.jj-vcs.dev/latest/git-command-table/)
- [Revset Language](https://docs.jj-vcs.dev/latest/revsets/)
- [Template Language](https://docs.jj-vcs.dev/latest/templates/)
