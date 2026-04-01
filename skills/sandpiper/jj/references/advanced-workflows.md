# jj Advanced Workflows

Power-user patterns for jj. Read this file when dealing with complex multi-branch work,
stacked PRs, code review, workspaces, or the absorb command.

## Table of Contents
- [The Megamerge Pattern](#the-megamerge-pattern)
- [jj absorb](#jj-absorb)
- [Stacked Diffs / Stacked PRs](#stacked-diffs--stacked-prs)
- [Reviewing Large Changes Locally](#reviewing-large-changes-locally)
- [Working with Multiple Workspaces](#working-with-multiple-workspaces)
- [Inserting Changes into History](#inserting-changes-into-history)
- [The Fix Command](#the-fix-command)
- [Fork Workflow (Multiple Remotes)](#fork-workflow-multiple-remotes)
- [Useful Aliases and Config Patterns](#useful-aliases-and-config-patterns)

---

## The Megamerge Pattern

When working on **multiple parallel streams** (features, refactors, docs) simultaneously,
create a merge commit combining all branch tips so you can see how everything integrates.

### Setup
```bash
# Create branches for each stream of work
jj new main -m "feature A"
# ... work on feature A, note its change ID (e.g., "aa") ...

jj new main -m "docs update"
# ... work on docs, note its change ID (e.g., "dd") ...

jj new main -m "refactor B"
# ... work on refactor, note its change ID (e.g., "bb") ...

# Create the megamerge: merge all branch tips
jj new aa dd bb -m "megamerge: all active work"
jj new                         # Working area on top of merge
```

### Working in the megamerge
Your working copy now contains all streams integrated together. You can build, test, and
see how everything fits. When you make changes, distribute them to the right branch:

```bash
jj squash --into aa            # Move all changes to feature A
jj squash -i --into dd         # Interactively select what goes to docs
jj absorb                      # Auto-route changes to correct ancestors (best option)
```

### Why megamerges?
- See how streams integrate (merge + build + test) before any is merged upstream
- Separate work into streams without ceremony
- Deliver incremental progress via parallel PRs
- After PRs merge upstream, `jj abandon` the local copies and rebuild the megamerge
  with remaining streams

### Maintaining the megamerge
```bash
# After a PR merges upstream:
jj git fetch
jj abandon <merged-branch-change-id>
# The megamerge auto-rebases and drops the abandoned parent

# To add a new stream:
jj new main -m "new stream"
# ... make changes ...
# Then recreate the megamerge with the new stream added:
jj new aa dd bb <new-stream> -m "megamerge: updated"
```

---

## jj absorb

`jj absorb` examines each hunk of changes in the source commit, determines which mutable
ancestor last modified those lines, and moves the hunk there automatically.

### Basic usage
```bash
jj absorb                      # Route all @ changes to correct ancestors
jj absorb src/                 # Only absorb changes in src/
jj absorb -f @ -t mutable()   # Explicit source and target set
```

### How it works
1. For each changed hunk in the source, absorb looks at which ancestor commit last touched
   those specific lines
2. If exactly one mutable ancestor is responsible, the hunk moves there
3. If the destination is ambiguous (multiple ancestors touched nearby lines), the change
   stays in place — absorb is conservative
4. All intermediate commits auto-rebase after the moves

### When to use absorb vs squash
- **`jj absorb`** — When changes span multiple files/areas that belong to different
  ancestors. The autopilot option. Works best when changes are clearly attributable.
- **`jj squash -i --into <target>`** — When you need manual control, or absorb can't
  determine the right destination.
- **`jj squash --into <target>`** — When ALL changes go to one specific target.
- **`jj squash --into <target> -k`** — Same, but keep the source commit alive with `-k`
  (`--keep-emptied`).

### Absorb in the megamerge
The megamerge + absorb combination is extremely powerful. Work in the megamerge context
where everything is integrated, then `jj absorb` to automatically sort changes back to
the correct branch. This is the ideal workflow for making cross-cutting changes across
parallel work streams.

---

## Stacked Diffs / Stacked PRs

Work on a chain of dependent changes, each targeting a separate PR.

### Creating the stack
```bash
jj new main -m "step 1: database migration"
# ... make changes ...
jj new -m "step 2: API endpoint"
# ... make changes ...
jj new -m "step 3: frontend integration"
# ... make changes ...
```

### Creating bookmarks and pushing
```bash
jj bookmark create step-1 -r @--
jj bookmark create step-2 -r @-
jj bookmark create step-3 -r @
jj git push -b step-1 -b step-2 -b step-3
```

### Editing commits in the stack
Edit any commit — descendants auto-rebase:
```bash
jj edit step-1
# ... fix something ...
# step-2 and step-3 automatically rebase on top of the new step-1
jj new                         # Return to working on new changes
```

### After a PR merges upstream
```bash
jj git fetch
jj rebase -s step-2 -o main   # Rebase remaining stack onto updated main
jj bookmark delete step-1     # Clean up merged bookmark

# Update bookmarks for next push
jj bookmark set step-2
jj bookmark set step-3
jj git push -b step-2 -b step-3
```

### Quick push with auto-bookmarks
For simpler cases, use `-c` to auto-create bookmarks:
```bash
jj git push -c @               # Creates bookmark like "push-mwmpwkwknuz" and pushes
```

---

## Reviewing Large Changes Locally

Use jj to track review progress on large PRs by squashing reviewed files out of your
working view.

### Setup
```bash
# Fetch the branch to review
jj git fetch -b big-change

# Duplicate into a mutable copy (original is immutable)
jj duplicate big-change@origin
jj edit <new-change-id>

# Insert an empty "review brain" commit before the duplicate
jj new --no-edit --insert-before @ --message 'review: big-change'
```

### Reviewing file by file
```bash
# Review a file
cat path/to/file.py                # Read the file
jj diff -r @ path/to/file.py     # See just this file's changes

# Mark as reviewed by squashing into the review commit
jj squash path/to/file.py

# Track progress: see what's left
jj diff --stat                     # Remaining unreviewed changes
jj diff --summary                  # File-level summary of what's left
```

### Comparing versions
```bash
# See what you've reviewed vs the original
jj interdiff --from big-change@origin --to <review-commit>
```

### Why this works
- The diff in your working copy shrinks as you review, giving clear progress tracking
- You can add review notes as descriptions on intermediate commits
- The original change is preserved immutably for reference
- You can abandon everything when done — no artifacts left behind

---

## Working with Multiple Workspaces

Workspaces give you multiple working copies of the same repo. They share the commit graph
but each has its own checked-out revision.

### Creating and using workspaces
```bash
# Create a second workspace for running tests
jj workspace add ../test-workspace

# In test workspace, work on a different commit
cd ../test-workspace
jj edit <some-commit>

# Workspaces share the repo — commits visible in both
# Reference other workspace's working copy from either:
jj log -r 'test-workspace@'
```

### Less-obvious but useful patterns
```bash
# Nested workspace under a subdirectory of the current workspace
jj workspace add .sandpiper/tasks --name tasks

# Create a workspace with unrelated history rooted at root()
jj workspace add ../scratch --name scratch --revision 'root()'
```

Nested workspaces can be useful when a tool expects a canonical path inside the repo tree but you
still want an independent working copy.

A `root()`-based workspace is the jj-native way to create unrelated history when you need a branch
that should not share ancestors with the main code history.

### Important colocated-repo gotcha

In a colocated jj/git repo, prefer `jj workspace add` over `git worktree add` if you expect to use
`jj` inside both checkouts.

A git worktree may look fine from Git's point of view, but jj may not treat it as an independent
workspace. The result can be surprising: `jj` commands run in the nested git worktree can affect the
parent workspace state instead of staying isolated.

Rule of thumb:
- **jj repo** → use `jj workspace`
- **plain git repo** → use `git worktree`

### Use cases
- Run a long test suite in one workspace while continuing to code in another
- Compare behavior of two different commits side by side
- Have a "clean" workspace always pointing at main for reference
- Maintain an unrelated-history workspace rooted at `root()` for specialized content or tooling

### Cleanup
```bash
jj workspace forget test-workspace
rm -rf ../test-workspace
```

### Gotcha: `jj edit` fails on immutable commits

Remote-tracking commits (those reachable from `name@origin`) are **immutable** by default.
Calling `jj edit <some-commit>` on one will fail:

```
Error: Commit abc123 is immutable
Hint: Could not modify commit: ...
```

This typically surfaces when trying to check out a cloned remote branch with `jj edit`. Use
`jj new <branch>` instead — it creates a **new mutable working-copy commit** on top of the
immutable one, which is the correct way to start working on a cloned branch:

```bash
# Wrong: trying to edit an immutable remote-tracking commit
jj edit "tasks@origin"     # → Error: Commit is immutable

# Right: create a mutable working copy on top of it
jj new "tasks@origin"      # → @ is now a new empty commit, parent = tasks@origin
jj bookmark set tasks -r "tasks@origin"  # track the remote branch locally
```

If you specifically need to modify an immutable commit (rare, e.g. rewriting history you own),
configure the `immutable_heads` revset in your jj config to exclude it.

---

## Inserting Changes into History

jj makes it easy to insert new commits anywhere in the graph.

### Insert before current commit
```bash
jj new -B @ -m "refactor needed first"
# Make changes — they become a new parent of your original @
# All descendants auto-rebase
jj next --edit                 # Return to the original commit
```

### Insert after a specific commit
```bash
jj new -A <rev> -m "addition after rev"
# Make changes — they insert between <rev> and its children
# Children of <rev> auto-rebase onto this new commit
```

### Reorder commits
```bash
# Make commits parallel instead of sequential
jj parallelize @-- @- @

# Or rebase to change order
jj rebase -r @- -o @           # Swap parent and child
```

---

## The Fix Command

`jj fix` runs configured code formatters across mutable commits automatically.

### Configuration
```toml
[fix.tools.rustfmt]
command = ["rustfmt", "--emit", "stdout"]
patterns = ["glob:'**/*.rs'"]

[fix.tools.prettier]
command = ["prettier", "--stdin-filepath", "$path"]
patterns = ["glob:'**/*.{js,ts,jsx,tsx}'"]

[fix.tools.black]
command = ["black", "-"]
patterns = ["glob:'**/*.py'"]
```

### Usage
```bash
jj fix                         # Fix all files in reachable mutable commits
jj fix -s @                    # Fix only @ and descendants
jj fix src/                    # Fix only specific paths
```

The fix command rewrites commits in place — all affected commits get new IDs but
change IDs remain stable.

---

## Fork Workflow (Multiple Remotes)

For contributing to open-source repos where you push to a fork:

### Configuration
```toml
# In .jj/repo/config.toml or user config
[git]
fetch = ["upstream", "origin"]   # Fetch from both
push = "origin"                  # Push to your fork
```

### Setup
```bash
jj git remote add upstream git@github.com:org/repo.git
jj git fetch --all-remotes
```

### Workflow
```bash
# Start work from upstream's main
jj new upstream/main -m "my contribution"
# ... make changes ...

# Push to your fork
jj bookmark create my-feature
jj git push                    # Goes to origin (your fork)

# Keep in sync
jj git fetch --all-remotes
jj rebase -b @ -o main@upstream
```

---

## Useful Aliases and Config Patterns

### Aliases
```toml
[aliases]
# Short log of active work
l = ["log", "-r", "(main..@):: | (main..@)-"]

# Diff with stat
ds = ["diff", "--stat"]

# Push current change (auto-creates bookmark)
pc = ["git", "push", "-c", "@"]

# Show evolution of current change
el = ["evolog", "-p"]

# Sync with upstream: fetch + rebase
sync = ["util", "exec", "--", "bash", "-c", """
set -euo pipefail
jj git fetch --all-remotes
jj rebase -b @ -o main
""", ""]
```

### Customizing the default log revset
```toml
[revsets]
# Show current stack plus trunk context
log = "present(@) | ancestors(immutable_heads().., 2) | trunk()"

# Use shorter IDs for active work
short-prefixes = "(main..@)::"
```

### Protecting commits from accidental push
```toml
[git]
# Commits with "wip" in description can't be pushed
private-commits = "description(substring:'wip')"
```

### Diff and merge tool configuration
```toml
[ui]
diff-formatter = ":color-words"    # Best for inline viewing
merge-editor = "meld"             # Or "kdiff3", ":builtin", "vimdiff"

[merge-tools.vimdiff]
program = "vim"
merge-args = ["-f", "-d", "$output", "-M", "$left", "$base", "$right",
              "-c", "wincmd J", "-c", "set modifiable write"]
merge-tool-edits-conflict-markers = true
```

### Color customization
```toml
[colors]
"working_copy" = { bold = true }
"working_copy change_id" = { color = "magenta", bold = true }
"bookmark" = { color = "green", bold = true }
"diff removed token" = { bg = "#221111" }
"diff added token" = { bg = "#002200" }
```

---

## Known Limitations

These Git features are not supported or have limited support in jj:
- `.gitattributes` (ignored)
- Git hooks (not executed)
- Git LFS (not supported)
- Submodules (contents hidden, treated as opaque)
- Partial clones
- Annotated tags (only lightweight tags supported)
- Deepening shallow clones after initial clone

Other notes:
- File paths are assumed to be UTF-8
- Conflicted commits in Git storage use `.jjconflict-base-*/` and `.jjconflict-side-*/` dirs
- `git gc` is generally safe in colocated repos but back up first
