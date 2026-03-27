---
name: jj
description: >
  Use this skill whenever the user wants to use Jujutsu (jj) version control, or when working
  in a repository that has a `.jj/` directory. Triggers include: any mention of "jj", "jujutsu",
  jj CLI commands (jj new, jj squash, jj describe, jj log, jj rebase, jj bookmark, jj git push,
  jj split, jj absorb, jj edit, jj diff, jj status, jj resolve, jj op, jj undo, etc.), revsets,
  change IDs (strings of letters k-z like "qzmzpxyl"), "colocated repo", "jj conflicts", or
  version control tasks in a jj-managed repo. Also trigger when the user asks about workflows
  like megamerges, stacked diffs/PRs with jj, jj absorb, jj operation log, or migrating from
  Git to jj. Always consult this skill before running any jj commands — it covers the full mental
  model, command reference, revset language, template language, Git interop, advanced workflows,
  and common pitfalls. Do NOT confuse with unrelated uses of "jj" (e.g., a person's initials).
---

# Jujutsu (jj) Version Control — Power User Skill

Jujutsu (`jj`) is a Git-compatible VCS. It uses Git as its storage backend, so it works
transparently with GitHub/GitLab — collaborators never need to know you're using jj.

**Before diving into specific commands, read this file fully.** For the complete revset
language reference, read `references/revsets.md`. For the full command reference with all
flags, read `references/commands.md`. For advanced workflow patterns (megamerges, absorb,
stacked PRs, large-change review), read `references/advanced-workflows.md`.

---

## Core mental model (read this first)

These concepts are fundamental. Every jj command makes sense once you internalize them.

### The working copy IS a commit
Every jj command starts by snapshotting the working directory into a real commit. `@` always
refers to this working-copy commit. There is no staging area — files are tracked automatically.
To craft precise commits, use `jj split` or `jj squash -i` instead of `git add -p`.

### Change IDs vs commit IDs
Every commit has two identifiers:
- **Commit ID** (hex digits 0-9, a-f): the Git SHA. Changes on rewrite.
- **Change ID** (letters k-z): stable across rewrites. Tracks logical identity.
The character sets are disjoint, so they're never ambiguous. **Always prefer change IDs**
when referencing your own work — they survive rebases and amends.

### No named branches required
jj tracks all visible head commits automatically. "Detached HEAD" doesn't exist. Named
pointers ("bookmarks," formerly "branches") exist primarily for Git interop and pushing.
**Bookmarks do NOT auto-advance** — move them explicitly with `jj bookmark set`.

### Automatic rebasing
Rewriting any commit (describe, squash, rebase, edit) automatically rebases all descendants.
Bookmarks and the working copy follow. No manual rebase chains needed.

### First-class conflicts
Operations that produce conflicts (rebase, merge) **succeed** and record the conflict in the
commit tree. Resolve when ready — not when the tool demands. Resolutions propagate through
descendant rebases automatically.

### Operation log and undo
Every mutation creates an operation in an append-only log. `jj undo` reverts the last
operation. `jj op restore <id>` restores any prior state. Far more powerful than git reflog.

### The @ symbol ecosystem
- `@` — working-copy commit
- `@-` — parent of @ (shorthand for `parents(@)`)
- `@--` — grandparent
- `<workspace>@` — working copy in another workspace
- `name@remote` — remote-tracking bookmark (e.g. `main@origin`)

---

## Essential commands (quick reference)

This section covers the commands you'll use constantly. For the complete reference with all
flags, see `references/commands.md`.

### Repository setup
```bash
jj git init myproject                      # New repo (colocated by default)
jj git clone git@github.com:user/repo.git  # Clone (colocated by default)
cd existing-git-repo && jj git init --colocate  # Add jj to existing git repo
```

### The two main workflows

**Squash workflow (recommended)** — treat `@-` as the "real" commit, `@` as scratch:
```bash
jj describe -m "feat: add auth"   # Name the work on @-
jj new                            # Fresh scratch commit on top
# ... make changes ...
jj squash                         # Fold changes into @- (the named commit)
jj squash -i                      # Interactive hunk selection
jj squash path/to/file.rs         # Specific file only
```

**Edit workflow** — work directly in named commits:
```bash
# ... make changes ...
jj commit -m "feat: add auth"     # Name this work, move @ to a new empty commit ← preferred
# ... make more changes ...
jj commit -m "feat: next thing"   # Same pattern — snapshot and move on
```

Use `jj commit -m "msg"` to finish a unit of work — it names the current commit and moves `@`
to a fresh empty commit in one step. **Avoid `jj describe -m "msg"` + `jj new`** — that's
equivalent but error-prone: it's easy to keep adding changes to the described commit instead
of the new one, silently mixing work that should be in separate commits. Reserve `jj describe`
for amending a commit's message while staying in it, and `jj new` for branching off an ancestor.

### Viewing state
```bash
jj log                             # Graph of revision history
jj log -r 'trunk()..@'            # Only local work above trunk
jj status                          # Working copy info, conflicts
jj diff                            # Changes in @
jj diff -r <rev>                   # Changes in specific revision
jj diff --from <a> --to <b>       # Compare two revisions
jj show <rev>                      # Description + diff of a revision
```

### Making commits
```bash
jj commit -m "msg"                 # Name @, move to new empty @ (finish a unit of work)
jj commit                          # Same, opens editor for message
```

### Rewriting history
```bash
jj describe -m "new message"       # Amend description of @ in place (stay in same commit)
jj describe -m "msg" -r <rev>     # Amend description of any commit

jj squash                          # Move @ changes into @-
jj squash --from <a> --into <b>   # Move changes between any two commits
jj squash -i                       # Interactive hunk selection

jj split                           # Split @ into two commits (interactive)
jj split path/file.rs              # Split by file

jj edit <change-id>                # Make a revision the working copy (edit in-place)
jj new -A <rev>                    # Insert new commit after <rev>
jj new -B <rev>                    # Insert new commit before <rev>

jj rebase -b @ -o main            # Rebase current branch onto main
jj rebase -s <rev> -o main        # Rebase rev + descendants onto main
jj rebase -r <rev> -o main        # Rip single rev out, place onto main

jj abandon <rev>                   # Abandon commit (descendants reconnect to parent)
jj duplicate <rev>                 # Copy a commit

jj absorb                          # Auto-route @ changes to correct ancestor commits
```

### Bookmarks (branches) and pushing
```bash
jj bookmark create feat -r @       # Create bookmark at @
jj bookmark set feat               # Move bookmark to @ (any direction)
jj bookmark advance feat           # Advance bookmark to @ (forward/descendant only — safer)
jj bookmark advance feat --to @-   # Advance to a specific descendant revision
jj bookmark delete feat            # Delete bookmark
jj bookmark list                   # List bookmarks

jj git push -b feat                # Push specific bookmark
jj git push -c @                   # Auto-create bookmark from change ID and push
jj git push --all                  # Push all bookmarks

jj git fetch                       # Fetch from remotes
jj git fetch --all-remotes         # Fetch from all remotes
```

### Conflict resolution
```bash
jj log -r 'conflicts()'           # Find all conflicted commits
jj resolve --list                  # List conflicted files in @
jj resolve                         # Launch merge tool
jj resolve --tool :theirs          # Accept their side
jj resolve --tool :ours            # Accept our side

# Preferred method: new commit + squash
jj new <conflicted>                # Create working copy on top
# ... fix conflict markers ...
jj squash                          # Fold resolution into conflicted commit
```

**Conflict marker format (diff style, default):**
```
<<<<<<< Conflict 1 of 1
%%%%%%% Changes from base to side #1
 context
-removed
+added
+++++++ Contents of side #2
content of other side
>>>>>>> Conflict 1 of 1 ends
```
Apply the diff (between `%` markers) to the snapshot (between `+` markers) to produce the
correct result. Replace the entire block.

### Undo and operation log
```bash
jj undo                            # Undo last operation
jj op log                          # View operation history
jj op restore <op-id>             # Restore repo to prior state
```

### Navigation
```bash
jj next                            # Move to child commit
jj prev                            # Move to parent commit
jj next --edit                     # Move to child and edit directly
jj prev --edit                     # Move to parent and edit directly
```

---

## Revsets (revision selection language)

Revsets are used with `-r` flags to select commits. Full reference: `references/revsets.md`.

**Key symbols:** `@` (working copy), `@-` (parent), `root()` (root commit)

**Key operators:**
- `x..y` — ancestors of y minus ancestors of x (like git's `x..y`)
- `::x` — all ancestors of x (inclusive)
- `x::` — all descendants of x (inclusive)
- `x & y` — intersection
- `x | y` — union
- `~x` — complement (not in x)
- `x-` — parents of x
- `x+` — children of x

**Key functions:**
- `trunk()` — head of main/master/trunk on origin
- `mine()` — commits authored by configured user
- `heads(x)` / `roots(x)` — topological heads/roots
- `bookmarks()` / `tags()` — named refs
- `conflicts()` — commits with unresolved conflicts
- `empty()` — commits with no file changes
- `description(pattern)` / `author(pattern)` — metadata filters
- `mutable()` / `immutable()` — mutability categories

**Practical examples:**
```bash
jj log -r 'trunk()..@'                    # Local work not on trunk
jj log -r 'mine() & trunk()..'            # My local work
jj log -r 'conflicts()'                   # All conflicted commits
jj log -r 'description(regex:"fix.*bug")' # Search descriptions
jj log -r 'ancestors(@, 5)'               # Last 5 ancestors
```

---

## Git interop and colocated repos

**Colocated mode (default, recommended):** `.jj` and `.git` coexist. Git tools, IDEs, CI
all work because they see a normal `.git` directory. jj auto-runs `git import`/`export`.

Key behaviors:
- Git stays in detached HEAD (jj has no "current branch")
- Read-only git commands work freely (`git log`, `git diff`)
- Mutating git commands work but can create bookmark conflicts
- `jj undo` can undo even git operations

**Working with GitHub PRs:**
```bash
jj new main -m "feat: my feature"
# ... make changes ...
jj git push -c @                   # Auto-creates bookmark, pushes
# After review feedback:
jj edit <change-id>                # Edit original commit
# ... make fixes ...
jj git push -b <bookmark>         # Force-pushes (safe, uses lease check)
```

**Preventing accidental pushes:**
```toml
# In config
[git]
private-commits = "description(exact:'wip')"
```

---

## Configuration

Config locations (later overrides earlier): built-in → user (`~/.config/jj/config.toml`)
→ repo (`.jj/repo/config.toml`) → workspace (`.jj/workspace-config.toml`) → CLI `--config`.

```toml
[user]
name = "Your Name"
email = "you@example.com"

[ui]
editor = "nvim"                           # Or "code -w", "vim"
diff-formatter = ":color-words"           # :color-words|:git|:summary|:stat
merge-editor = "meld"                     # Or "kdiff3", ":builtin", "vimdiff"
default-command = ["log"]
pager = "less -FRX"
graph.style = "curved"                    # curved|square|ascii
conflict-marker-style = "diff"            # diff|snapshot|git

[git]
push-bookmark-prefix = "push-"

[revsets]
log = "present(@) | ancestors(immutable_heads().., 2) | trunk()"
short-prefixes = "(main..@)::"            # Shorter IDs for active work

[snapshot]
auto-track = "all()"                       # "none()" for explicit tracking

[aliases]
l = ["log", "-r", "(main..@):: | (main..@)-"]
d = ["diff"]
s = ["status"]
pc = ["git", "push", "-c", "@"]
```

---

## Common pitfalls for Git users

**"Where's my staging area?"** — Use `jj squash -i` for interactive hunk selection, `jj split`
to break up commits. These work on ANY commit, not just HEAD.

**"My bookmark didn't move."** — By design. Move explicitly: `jj bookmark set my-feature`.

**"I see `(empty)` commits."** — Normal. `@` is often empty — it's your scratch space.

**"How do I stash?"** — Just `jj new`. Previous changes are already a commit. Switch back
with `jj edit <change-id>`.

**"Rebase didn't stop on conflict."** — Correct. jj records conflicts without stopping.
Check `jj log -r 'conflicts()'`, resolve when ready.

**"Commit IDs keep changing!"** — Expected. Use change IDs (k-z letters) — they're stable
across rewrites.

**"Push was rejected."** — Remote moved. `jj git fetch`, rebase, push again.

**Using `jj describe` + `jj new` instead of `jj commit`** — These are equivalent, but the
two-step pattern is error-prone: it's easy to keep adding changes to the described commit
instead of the new empty one, silently mixing work across commits. Use `jj commit -m "msg"`
to finish a unit of work. Use `jj describe` only to amend the current commit's message in
place, and `jj new` to branch off an ancestor commit.

**"How do I git blame?"** — `jj file annotate <path>`.

**"How do I undo everything?"** — `jj op log` to find good state, `jj op restore <op-id>`.

**"I need to recover specific files from an old commit."** — Use `jj restore --from <rev> path/to/files`. Supports glob patterns (quote them to prevent shell expansion). The files are restored into `@` — no need to create a new commit first:
```
jj restore --from abc123 '.sandpiper/tasks/*/PROJECT.md'
```

---

## Reference files

For detailed information beyond this overview, read these files in `references/`:

- **`references/commands.md`** — Complete command reference with all subcommands, flags, and
  options. Read when you need the exact flags for a command or encounter an unfamiliar command.
- **`references/revsets.md`** — Full revset language: all operators, functions, string/date
  patterns, built-in aliases. Read when constructing complex revision queries.
- **`references/advanced-workflows.md`** — Power user patterns: megamerges, jj absorb,
  stacked PRs, large-change review, workspaces, templates. Read for non-trivial workflows.
