---
name: jj
description: >
  Use this skill whenever the user wants to use Jujutsu (jj) version control, or when working
  in a repository that has a `.jj/` directory. Triggers include: any mention of "jj", "jujutsu",
  jj CLI commands (jj new, jj squash, jj describe, jj log, jj rebase, jj bookmark, jj git push,
  jj split, jj absorb, jj edit, jj diff, jj status, jj resolve, jj op, jj undo, jj redo,
  jj bookmark advance, jj workspace, etc.), revsets, change IDs (strings of letters k-z like
  "qzmzpxyl"), operation IDs, "--at-op", "colocated repo", or "jj conflicts". Also trigger when
  the user asks about workflows like megamerges, stacked PRs with jj, jj absorb, the operation
  log, workspaces, parallel coding-agent sessions, templates, jj config, or Git-to-jj migration.
  Always consult this skill before running any jj commands — it covers the mental model,
  commands, revsets, templates, Git interop, advanced workflows, and pitfalls. Do NOT confuse
  with unrelated uses of "jj" (e.g., a person's initials).
---

# Jujutsu (jj) — skill entry point

Jujutsu (`jj`) is a Git-compatible VCS. It stores data in a Git backend, so GitHub, GitLab, and every
Git-speaking tool work transparently against a jj working copy. Collaborators do not need to know or
care that jj is in use.

This file contains the mental model, mandatory rules, recovery procedures for common failure modes,
a pocket command reference, and a routing table. Read it through on first encounter, then use it
as the index into the reference files in `references/`.

---

## Core mental model (read this section whole)

Four distinct identifier kinds appear in jj. Confusing them is the most common source of error.

| Name | Shape | Stability | What it identifies |
|---|---|---|---|
| **Commit ID** | hex `0–9 a–f` (e.g. `2965e54b`) | Changes on rewrite | A Git SHA. The storage-layer identity of a snapshot. |
| **Change ID** | letters `k–z` (e.g. `qzmzpxyl`) | Stable across rewrites | The *logical* identity of a change. Survives amends, rebases, splits. |
| **Operation ID** | hex (e.g. `d6255cf6`) | Permanent | An entry in the op log — one transaction that rewrote the repo view. |
| **Revision / revset** | any selector | n/a | A selector expression that resolves to one or more commits (e.g. `@`, `@-`, `main`, `trunk()..@`). |

The character sets for commit IDs and change IDs are disjoint, so they are never ambiguous. **Always
prefer change IDs when referencing an agent's own work** — they survive rewrites; commit IDs do not.

### Non-negotiable invariants

1. **The working copy is a real commit.** Every command starts by snapshotting the working directory
   into a commit identified by `@`. There is no staging area. To craft precise commits, use
   `jj split -m "msg" <paths>` or `jj squash --from ... --into ... <paths>` — these work on any
   commit, not only the tip. Never use interactive forms (`-i`); see rule 1.

2. **Rewriting a commit auto-rebases its descendants.** `describe`, `squash`, `split`, `edit`,
   `rebase`, `abandon` — any mutation — re-parents everything above. Bookmarks follow. No manual
   rebase chains.

3. **Conflicts are first-class.** Operations that produce conflicts succeed and record the conflict
   in the commit tree. Resolve when ready, not when the tool demands. Resolutions propagate through
   descendant rebases automatically.

4. **The operation log is the time machine.** Every mutation creates an append-only operation.
   `jj undo` walks back one op; `jj redo` walks forward; `jj op restore <op-id>` jumps to any prior
   state. `--at-op=<op-id>` reads the repo *as of* that operation. Cache never GCs unless explicitly
   requested. This subsumes Git's reflog, stash, reset, and `reset --hard` in a single
   non-destructive mechanism. Load `references/workflows/op-log.md` for the patterns.

5. **Bookmarks do not silently auto-advance on `commit`/`new`.** They move only when explicitly asked
   (`jj bookmark set`, `jj bookmark move`, or the 0.39.0+ on-demand command `jj bookmark advance`).
   This is by design — it prevents accidentally advancing `main` over WIP.

### The `@` ecosystem

- `@` — working-copy commit
- `@-` — parent of `@` (shorthand for `parents(@)`)
- `@--` — grandparent
- `<workspace>@` — working copy in another workspace
- `name@remote` — remote-tracking bookmark (e.g. `main@origin`)
- `@` inside `jj op` commands — current operation; `@-` is the previous operation (the parent/child operators resolve against operations, not commits, in that context)

---

## Agent-mandatory rules

These are hard rules for agent sessions. Matched recovery paths for each are in the next section.

1. **Always pass `-m <message>` on any command that accepts a description, and never invoke
   interactive flags.** Two distinct hang vectors:
   - *Editor hang* — commands that would open `$EDITOR` for a missing description (`describe`,
     `commit`, `new`, `squash`, `split`, `rebase --reinsert-message`, merge-description prompts).
     Always pass `-m <message>`. `-m ""` is legal if the intent is to leave empty.
   - *Diff-editor hang* — commands with `-i` / `--interactive` open a diff editor (`meld`,
     `kdiff3`, `:builtin`, etc.) for hunk selection. Never invoke the interactive forms
     (`jj squash -i`, `jj split -i`, `jj diffedit`, `jj resolve` without `--tool`). Use the
     non-interactive alternatives: `jj squash --from ... --into ... <paths>` for explicit
     hunk placement, `jj split -m "msg" <paths>` for path-based splits, `jj resolve --tool :ours`
     / `:theirs` for simple conflict picks, or the scratch-and-squash pattern for anything else.

2. **Prefer change IDs over commit IDs** when referencing your own in-flight work. Commit IDs churn
   on every rewrite; change IDs are stable.

3. **Verify after every graph restructuring.** After `rebase`, `squash`, `split`, `abandon`, `edit`,
   or any bookmark move, run `jj log -r 'main@origin..visible_heads()'` (or equivalent) to confirm
   the shape is what you expected. Do not chain multiple restructures without verifying. Run graph-
   mutating jj commands one at a time rather than bundling several into one shell script; jj conflicts
   are recorded successfully and may not stop a script before later mutations compound the state.

4. **On unexpected failure, reach for the op log, not destructive alternatives.** `jj undo` walks
   back the last op; `jj op restore <op-id>` jumps to a specific state. Do not run `rm -rf .jj`
   to "reset" — it wipes the op log and change IDs, leaving only the Git backing store.

5. **Never force-push to `main`/`master`.** `jj git push -b <feature>` is safe (lease-checked). A
   forced push to a shared trunk requires explicit user authorization.

6. **Before restructuring the graph, ensure no important state lives only in the working copy.**
   The working copy is a real commit, but it is ephemeral — if `@` becomes orphaned during a
   rebase, its uncommitted diff is lost. Commit or stash (i.e. create a named descendant) before
   restructuring ancestors.

7. **When `jj squash` would combine two described commits**, always pass `-m` to supply the merged
   description. Without `-m`, jj opens `$EDITOR` to let the caller combine the two descriptions
   manually — a hang in non-interactive contexts.

---

## Critical failure modes — symptoms and recovery

When a rule breaks down despite best efforts, these are the recovery paths. Each is keyed to the
rule whose violation causes it.

### Editor hang (violates rule 1)

**Symptom:** command executes, no output, session unresponsive.
**Cause:** a command needing a description was invoked without `-m`, and opened `$EDITOR`.
**Prevention:** pass `-m <message>` on every command that accepts it. `-m ""` is legal.
**Recovery:** the agent cannot recover a hung process. Escalate to the user to cancel. This is
preventable 100% of the time; prevent rather than recover.

### Orphaned working copy (violates rule 6)

**Symptom:** `jj log` no longer shows work that was in `@` before a restructure. `@` may be empty
or show different content.
**Cause:** uncommitted working-copy changes were abandoned when ancestors were rewritten.
**Prevention:** before restructuring any ancestor of `@`, either `jj describe -m "wip: ..."` to
name the current `@`, or `jj new -m "..."` to create a named descendant and continue there.
**Recovery:** `jj op log` shows the op where `@` was last intact. Either `jj op restore <op-id>`
to rewind the whole repo, or `jj restore --from <change-id> -- <paths>` to pull specific files
forward into the current `@` without rewinding other work.

### Stale commit ID (violates rule 2)

**Symptom:** `Error: Revision X doesn't exist` when referencing a previously valid commit ID.
**Cause:** a mutation rewrote the commit; the old ID no longer resolves.
**Prevention:** reference in-flight work by change ID (letters `k–z`), not commit ID (hex). Change
IDs survive rewrites.
**Recovery:** re-derive current IDs with `jj log -r '<revset>'`. Substitute the change ID for the
stale commit ID and reissue the command.

### Conflict propagation through a chain (violates rule 3)

**Symptom:** after a rebase, multiple commits appear conflicted, not only one.
**Cause:** a conflict in an earlier commit propagates to descendants (their content is computed by
applying their diff to a conflicted base, which produces a conflicted result).
**Prevention:** after a restructure, check `jj log -r 'conflicts()'` and resolve in topological
order — earliest conflict first.
**Recovery:** find the earliest conflicted commit (its parent should be unconflicted) and resolve
it via the scratch-and-squash pattern:

```console
jj new <conflicted-rev> -m "resolve: ..."
# edit files, remove all <<<<<<, +++++++, %%%%%%, >>>>>> markers
jj squash -m "..."
```

Then re-check `jj log -r 'conflicts()'`. Descendants rebase onto the resolved commit; if the
original conflict was the root cause of theirs, they become unconflicted automatically.

### Stuck or mysterious state (violates rule 4)

**Symptom:** command fails unexpectedly, graph looks wrong, tests that passed now fail, or
the repo state does not match the expected state.
**Cause:** a prior command had a side effect the agent did not track.
**Prevention:** before risky work, record a checkpoint op ID:
`jj op log --limit 1 -T 'self.id() ++ "\n"'`. Verify after each restructuring command.
**Recovery:** `jj op log --limit 10` to see recent history, then either `jj undo` (reverses the
last op; call repeatedly to walk back) or `jj op restore <checkpoint>` (jumps to a specific
known-good state). `jj --at-op=<op-id> log` reads state from any prior op without modifying
current state — useful for investigation.

**Never run `rm -rf .jj`.** That directory contains the op log and change-ID tracking. Deleting
it strands the repo with only the Git backing store; every jj operation record and change-ID
mapping is lost. If commands are hanging and the op log offers no recovery path, escalate to the
user before taking any destructive action.

### Bookmark at an older position than expected

**Symptom:** `jj git push -b <bookmark>` pushes an older commit than expected, or fails.
**Cause:** bookmarks don't auto-advance on `jj commit`/`jj new`. After a sequence of commits, the
bookmark is still pointing at the commit where it was last explicitly set.
**Prevention:** before pushing, check `jj log -r 'bookmarks() | @'` to see where bookmarks point
relative to `@`.
**Recovery:** move the bookmark explicitly with `jj bookmark set <name> -r <rev>`, or advance the
nearest bookmark to `@` with `jj bookmark advance` (0.39.0+).

---

## Pocket command reference

Commands used constantly. For the full reference with every flag, load `references/commands.md`.

### Inspect state

```console
jj log                                      # graph of recent revisions
jj log -r 'main@origin..@'                  # only local work above remote main
jj log -r 'mine() & trunk()..'              # only this author's local work
jj status                                   # working-copy state, conflicts
jj diff                                     # changes in @
jj diff -r <rev>                            # changes in a specific rev
jj show <rev>                               # description + diff
```

### Craft commits

```console
jj describe -m "msg"                        # set @'s description
jj describe -m "msg" -r <rev>               # set any rev's description
jj new -m "msg"                             # new empty commit on top of @
jj new <rev> -m "msg"                       # new commit on top of a specific rev
jj commit -m "msg"                          # describe @, then start a new empty commit on top
jj squash -m "msg"                          # fold @ into @- with merged description
jj squash --from <a> --into <b> -m "msg"    # move changes between arbitrary commits
jj squash --from <a> --into <b> -m "msg" <paths>   # same, scoped to specific files
jj split -m "msg" <paths>                   # split @ — listed paths go into first commit
jj abandon <rev>                            # drop a commit; children reconnect to grandparent
```

### Restructure

```console
jj rebase -r <rev> -A <after>               # rip one commit, insert after <after>
jj rebase -r <rev> -B <before>              # rip one commit, insert before <before>
jj rebase -r <rev> -o <new-parent>          # rip one commit, place onto <new-parent>
jj rebase -s <rev> -d <dest>                # move rev + descendants onto dest
jj rebase -b <rev> -d <dest>                # move whole branch relative to dest
jj absorb                                   # auto-distribute @ hunks into correct ancestors
```

### Bookmarks and pushing

```console
jj bookmark list                            # list bookmarks
jj bookmark create <name> -r <rev>          # create at rev
jj bookmark set <name> -r <rev>             # move (forward-only by default)
jj bookmark set <name> -r <rev> --allow-backwards   # allow backward move
jj bookmark advance                         # walk nearest bookmark forward to @ (0.39.0+)
jj bookmark forget <name>                   # drop bookmark locally; don't propagate to remote
jj bookmark delete <name>                   # delete; propagates to remote on next push

jj git fetch                                # fetch from origin
jj git fetch --all-remotes                  # fetch from all remotes
jj git push -b <bookmark>                   # push one bookmark (force-with-lease safe)
jj git push -c @                            # auto-create bookmark from change-id, push
jj git push --all                           # push all bookmarks
jj git push -o <option>                     # forward push option to remote (GitLab CI, etc.)
```

### Recover

```console
jj undo                                     # revert the last operation
jj redo                                     # re-apply the most recently undone operation
jj op log                                   # list operations
jj op show <op-id>                          # show what a specific op did
jj op restore <op-id>                       # jump repo state to this op
jj --at-op=<op-id> log                      # read-only view as of <op-id>
jj restore --from <rev> -- <paths>          # restore specific files from another rev
```

### Conflicts

```console
jj log -r 'conflicts()'                     # list all conflicted commits
jj resolve --list                           # list conflicted files in @
jj new <conflicted-rev> -m "resolve: ..."   # scratch on top to edit markers
# ...edit the files...
jj squash -m "..."                          # fold resolution into the conflicted commit
```

**Conflict marker format (diff style, default):**

```
<<<<<<< Conflict 1 of 1
+++++++ <side #1 label>
<snapshot content of side #1>
%%%%%%% Diff from <base> to <side #2>
 context line
-removed line
+added line
>>>>>>> Conflict 1 of 1 ends
```

The `+++++++` block is a literal snapshot. The `%%%%%%%` block is a diff (apply to the base to
get side #2). To resolve: replace the entire conflict block with what the merged content should be.

---

## Routing table — when to load which reference

Load reference files on demand. Each row below names a reference and the situations in which
loading it pays off.

### Load when the task calls for depth

| Reference | Load when |
|---|---|
| `references/agent-patterns.md` | Non-trivial jj work: reshaping the graph, choosing between similar commands, deciding whether to ask the user before proceeding, or writing a checkpoint-first workflow |
| `references/mental-model.md` | Explaining jj to the user, reasoning about commits vs changes vs operations, or whenever behavior is confusing and a deeper model would help |
| `references/commands.md` | Encountering an unfamiliar command or unsure about a flag's exact semantics |
| `references/revsets.md` | Constructing any non-trivial `-r` expression, or needing a revset function beyond `trunk()`, `mine()`, `conflicts()`, `empty()` |
| `references/templates.md` | Customizing `log` / `show` output; writing a script that needs structured jj output; defining `git_push_bookmark` or other template-driven config |
| `references/config.md` | Editing `~/.config/jj/config.toml` or `jj config edit --repo`; choosing between `user` / `repo` / `workspace` scopes; enabling advanced behavior (private-commits, immutable-heads override, custom revset aliases) |
| `references/git-interop.md` | Any PR/MR workflow against a Git upstream; any `git` command inside a jj repo; force-push mechanics; push options; multiple remotes; fork→upstream setup |

### Load for specific workflows

| Workflow reference | Load when |
|---|---|
| `references/workflows/op-log.md` | Recovering from a mistake, undoing a rebase, time-travelling to a prior state, or inspecting what a command produced |
| `references/workflows/megamerges.md` | Working on multiple in-flight branches simultaneously; combining features locally while keeping them separable; cleaning up a tangled multi-branch state |
| `references/workflows/absorb.md` | Working-copy has scattered fixes that belong in different ancestor commits; considering `jj absorb` |
| `references/workflows/reviewing-large-changes.md` | Reviewing a large diff — either your own, a colleague's, or an agent's output — when line-by-line IDE review + progress tracking is wanted |
| `references/workflows/stacked-prs.md` | Maintaining or reviewing a chain of dependent PRs against a Git upstream |
| `references/workflows/workspaces.md` | Setting up multiple working copies of one repo — distinct dev servers, parallel builds, per-task filesystem isolation |
| `references/workflows/parallel-agents.md` | Running multiple coding-agent sessions against one repository — workspace layout, merge-back patterns, isolation strategies |

### Grep-friendly file-size note

None of the reference files currently exceed 20 KB. `grep` patterns work well on them. When
searching for something specific, run `grep` / `rg` first and load only the matching section
rather than the whole file.

---

## Session-start checklist for agent work

When starting jj work in a session, run this sequence before any destructive command:

1. Read this file (done by virtue of being triggered)
2. Run `jj log -r 'main@origin..visible_heads()'` to orient on local state
3. Run `jj op log --limit 5` — establishes a recent op history to roll back to if needed
4. **Check for an existing megamerge** — `jj log -r '::@ & merges() & mutable()'`. A megamerge
   can have any number of parents (two or more) and is always mutable (it is never pushed), so
   any mutable merge commit in `@`'s ancestry is a strong signal that the session is already
   inside a megamerge workflow — especially if the commit's description matches the convention
   (`megamerge`) or it has 3+ parents. Load `references/workflows/megamerges.md` before taking
   any integration action.
5. Confirm the user's intent if the change graph shape is unexpected

For high-risk sessions (graph restructuring, rebases across features, merges), also:

6. Note the current op ID as a checkpoint: `jj op log --limit 1 -T 'self.id() ++ "\n"'`
7. Inform the user of the checkpoint and how to restore: `jj op restore <op-id>`
8. Load `references/agent-patterns.md` for safe-restructuring protocols and command-choice heuristics
