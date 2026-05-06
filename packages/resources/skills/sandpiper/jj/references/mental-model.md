# jj Mental Model — Commits, Changes, Operations, Revisions

Understanding jj well means distinguishing four concepts that Git conflates or omits. Each has its
own identifier, its own lifecycle, and its own role. Confusing them is the most common source of
agent error.

This document is the deep-dive companion to the mental-model primer in `SKILL.md`. Load it when
the primer is insufficient, when explaining jj to a Git-native user, or when diagnosing a
situation where the four concepts have become tangled.

---

## The four identifier kinds

| Kind | Example | Character set | Stability | Lifetime |
|---|---|---|---|---|
| **Commit** | `2965e54b` | hex (`0–9`, `a–f`) | changes on every rewrite | persists in Git backend |
| **Change** | `qzmzpxyl` | letters (`k–z`) | stable across rewrites | persists until explicitly removed |
| **Operation** | `d6255cf6` | hex | permanent — never changes | persists until explicit GC |
| **Revision** | `@`, `main`, `trunk()..@-` | any string accepted by the revset parser | n/a (not an identifier; a selector) | computed on demand |

The commit-ID and change-ID character sets are **disjoint**: hex uses `0–9 a–f`, change IDs use
`k–z`. A given string can be at most one of them, so they never collide. Any command that takes an
identifier will accept either.

### Commit ID

The commit ID is a Git SHA. It identifies a specific tree + parent set + author + committer +
message combination — the traditional object-store identity. It is stable in the sense that **a
specific commit content always produces the same commit ID** (Git property).

It is *not* stable under rewrite. The moment a commit is amended, rebased, or split, the resulting
commit has a different tree/parents/message and thus a different commit ID. The old commit ID still
refers to the old content — it's still in the object store — but it no longer corresponds to the
user's in-flight work.

Implication: **an agent should never cache a commit ID and reference it across a mutation
boundary.** Before the mutation, the ID resolves to X. After, it resolves to X's obsolete
predecessor, not the current version of that work.

### Change ID

The change ID is jj's answer to "how do I refer to *this logical change*, even after I've rewritten
it five times?" It is assigned when a commit is first created and remains constant through every
subsequent `describe`, `squash`, `split`, `rebase`, or `edit` that affects that commit. A given
change ID always points to the current incarnation of the logical change — regardless of what its
commit ID is today.

Mechanically: every jj operation records a mapping from change ID to current commit ID. When the
commit gets rewritten, the mapping updates. Old commit IDs become unreferenced and are eventually
reclaimed; the change ID survives.

The character set `k–z` is chosen to be disjoint from hex. The prefix shown in `jj log` is the
shortest unambiguous prefix — `qzmzp` might display when the log is small but lengthen to
`qzmzpxyl` if more changes create collisions. Override with `short-prefixes` in config to force
shorter prefixes for the revsets you care about:

```toml
[revsets]
short-prefixes = "(main..@)::"   # "changes visible above main get shortest prefixes"
```

Implication: **prefer change IDs for any reference that persists across a mutation.** Record them
in notes, planning documents, scripts — change IDs are the right unit of logical identity.

### Operation ID

An operation is one transaction against the repo. Every jj command that mutates state creates
exactly one operation. The operation records:

- The command that ran (`args`)
- A timestamp and the workspace that ran it (0.40.0+)
- A **view object** — a complete snapshot of how the repo looked at the end of the operation (all
  visible commits, all bookmarks, all remotes)
- A pointer to the previous operation

The operation log is an append-only chain. New operations are children of the previous operation.
Operation IDs are hex-prefixed and permanent — they never change, and no operation is ever mutated.
To "undo," jj appends a new operation whose view is a revert of the prior one (`jj undo` /
`jj op revert`) or a copy of an older view (`jj op restore`). Older operations remain in the
log; they are no longer the current head but remain reachable.

Implication: the op log is jj's time machine. `--at-op=<op-id>` reads the repo view from any prior
operation, non-destructively. `jj op restore <op-id>` makes a prior operation the current state.
See `workflows/op-log.md` for the patterns.

**Concurrency note:** because each operation is a self-contained transaction with a snapshot view,
jj is lock-free under concurrent invocations. Two concurrent `jj` processes will each create a new
operation; the result is a divergence in the op log (two operations with the same parent), which
the next command reconciles.

### Revision / revset

A revision is not an identifier — it's the result of *resolving a selector* (a revset expression)
to one or more commits. Common revisions:

- `@` — working-copy commit
- `@-` — parent of `@`
- `main`, `feat/autotoon` — bookmark names
- `qzmzpxyl` — a change ID
- `2965e54b` — a commit ID

Revsets are a small language (see `references/revsets.md` for the full grammar). They support set
operations, graph traversal, and filters:

```
@                                       # working copy
@-                                      # parent of @
main@origin..@                          # ancestors of @ not already on origin/main
mine() & trunk()..                      # my local work above trunk
description(glob:"feat: autotoon*")     # commits whose description matches a glob
conflicts()                             # all conflicted commits in the repo
```

Flags like `-r <revset>` accept any of these.

---

## Key relationships

### One change → one commit (at any given time)

Each change ID points to exactly one current commit. Rewrites update the pointer. The relationship
is 1:1 in the current state, but **1:many over time** if you consider historical versions —
`jj evolog -r <change-id>` shows every past commit ID that change has had.

### One operation → one complete repo view

Every operation has a view. The view is a snapshot of *everything*: all visible commits, all
bookmarks at their positions, all remote-tracking state. When `jj undo` or `jj op restore` is used,
the view is replaced — not edited.

### Revisions and change IDs are interchangeable in most commands

`jj show qzmzp` and `jj show main` both work. The revset parser resolves the input, whatever form
it takes, to a set of commits.

---

## `jj commit` = `jj describe` + `jj new`

This decomposition is worth internalizing because it reveals that no jj command is atomic magic —
everything is a composition of primitives. The primitives:

- `jj describe -m "msg"` — set the description of `@`.
- `jj new -m "msg"` — create a new empty commit on top of `@`, then `@` becomes the new commit.

`jj commit -m "msg"` is exactly these two in sequence: the current `@` gets "msg" as its
description, then a new empty commit is created on top. The previous `@` is now `@-`. This matches
the Git user's mental model of "finalize what I've written, start a new commit."

Similarly:

- `jj squash` = take `@`'s changes, apply to `@-`, leave `@` empty.
- `jj split` = move some of `@`'s changes into a new first commit, keep the rest in `@` (reversed
  by default — `jj split --parallel` for siblings).
- `jj rebase -r X -o Y` = re-parent `X` onto `Y`, patching descendants to account for the move.

Most "advanced" jj operations are compositions of these primitives fused into a single command
for ergonomics. When a command's effect is unclear, decompose it into the primitives above.

---

## Mutable vs immutable commits

jj distinguishes commits you are permitted to rewrite from commits you are not. The default:

- **Mutable:** commits that are *not* ancestors of the `trunk()` head on any tracked remote, and
  are not tagged.
- **Immutable:** `trunk()`, its ancestors, and tagged commits — anything that has been "published."

Rewriting an immutable commit requires `--ignore-immutable`. This is a safety net: it stops you
from accidentally rewriting history that has been pushed and others may already have.

The definition of immutable is configurable via the `immutable_heads()` revset alias. A common
override for PR-based teams:

```toml
[revset-aliases]
'immutable_heads()' = "builtin_immutable_heads() | remote_bookmarks()"
```

This marks anything pushed to any remote bookmark as immutable, preventing unintended rewrites of
published PR commits.

Useful revsets:

- `mutable()` — all mutable commits
- `immutable()` — all immutable commits
- `remote_bookmarks()` — commits that are tips of remote-tracking bookmarks

---

## First-class conflicts — internals

In Git, a conflict is a *state* the repo is in. Merge or rebase halts, working tree has `<<<<<<<`
markers, index is inconsistent, and no new commits can be made until the conflict is resolved.

In jj, a conflict is a *commit property*. A rebase or merge that produces a conflict creates a
conflicted commit — a real commit whose content is conflicted. The operation completes
successfully; no further action is forced. Descendants can be built on top of conflicted commits,
and they inherit the conflict (their content is also conflicted because it was produced by applying
their diff to a conflicted base).

Resolving the conflict rewrites the conflicted commit into an unconflicted commit. Descendants
automatically rebase onto the new non-conflicted parent, and the conflict propagates through the
resolution.

Implications:

- Rebases never block. They succeed, possibly with conflicted commits, and the user resolves when
  ready.
- Multiple conflicts across a restructure are all visible at once: `jj log -r 'conflicts()'`.
- Resolving the earliest conflict in a chain implicitly resolves downstream conflicts (by
  rebasing).
- A rebase of a chain where intermediate commits produce conflicts, but the final tip is conflict-
  free (because a later commit happens to fix the earlier conflict), still leaves the intermediate
  commits conflicted. This is faithful to the content but can be confusing — the "conflict count"
  doesn't drop to zero even though the tip looks fine.

Conflict format (diff-style, jj's default):

```
<<<<<<< Conflict 1 of N
+++++++ <side 1 label>
<literal snapshot of side 1>
%%%%%%% Diff from <base> to <side 2>
 context line
-removed line
+added line
>>>>>>> Conflict 1 of N ends
```

The `+++++++` block is a literal snapshot. The `%%%%%%%` block is a *diff* — applying it to the
common base would produce side 2. These are not symmetric — one is content, the other is
instructions. To resolve, replace the entire block (markers included) with the merged content.

Alternate marker styles (`conflict-marker-style` in config): `snapshot` (both sides as literal
snapshots) or `git` (Git-compatible `<<< === >>>`). The default `diff` style is the recommended
setting — it encodes both sides unambiguously for programmatic resolution.

---

## The working copy is a commit — in depth

Every time a jj command runs, it first snapshots the working directory into the current `@` commit.
This snapshotting is automatic and near-zero-cost. The effect is that there is never a moment where
work exists "in the working directory but not in a commit" — `@` always contains the current state.

This has several consequences:

1. **There is no staging area.** There is no `git add`. To craft a precise commit from a busy
   working copy, use `jj split -m "msg" <paths>` or
   `jj squash --from ... --into ... -m "msg" <paths>` — both work on any commit, not only the
   tip. (Avoid the interactive `-i` forms in agent contexts; see SKILL.md rule 1.)

2. **The working copy can be rewritten like any other commit.** `jj describe -m "msg"` gives `@` a
   description. `jj squash` moves `@`'s content into `@-`. `jj edit <other>` makes a different
   commit the new `@` and leaves the previous `@` as a named commit in the graph.

3. **`@` is ephemeral in a particular sense.** It is a real commit, but it is special in that most
   agents treat it as scratch space. The convention is: give the "real" work a description (either
   on `@` or on `@-` via the squash workflow), keep `@` as the growing tip of scratch.

4. **Restructuring can orphan `@`.** If a `rebase`, `abandon`, or `edit` reshapes the graph such
   that the previous `@` is no longer reachable through bookmarks or heads, its content is not
   lost (the op log retains it), but it is no longer visible in the default log. Agents should
   commit or name the `@` state before restructuring ancestors.

---

## Git → jj mental translations

For Git-native users, a quick-reference table of operations:

| Git | jj | Notes |
|---|---|---|
| `git commit -m "msg"` | `jj commit -m "msg"` | Also: `jj describe -m "msg"` to set `@`'s message without creating a new commit on top |
| `git add -p` | `jj squash --from ... --into ... <paths>` or `jj split -m "msg" <paths>` | Works on any commit, not only the tip |
| `git stash` | `jj new -m "wip"` | Previous work is already a commit; `jj edit <change-id>` to return |
| `git reset --hard HEAD~1` | `jj abandon @` | Or `jj undo` if the last op was what created it |
| `git rebase -i` | `jj rebase`, `jj squash`, `jj split` | No interactive TODO list — operate on the graph directly |
| `git checkout <commit>` | `jj edit <change-id>` | Puts you *in* that commit to modify; `jj new <change-id>` for a fresh commit on top |
| `git cherry-pick` | `jj duplicate` or `jj rebase -r <rev> -o <dest>` | `duplicate` copies; `rebase -r` moves |
| `git reflog` | `jj op log` | Better: more structured, never GCs unexpectedly |
| `git reset` | `jj undo` or `jj op restore` | The "oops" button, non-destructive |
| `git blame <file>` | `jj file annotate <path>` | Same idea, different command |
| `git push --force-with-lease` | `jj git push` | Lease-check is the default — jj refuses to push if the remote has moved |
| `git log --graph` | `jj log` | Graph is the default |

---

## Common confusion points (FAQ)

### "Why does my commit ID keep changing?"

Because every mutation — `describe`, `squash`, `rebase`, even `jj new`'s implicit snapshot of the
working copy — creates a new commit object with a new SHA. This is correct behavior. The change ID
is stable; reference your work by that instead.

### "I see `(empty)` in the log. Is that bad?"

No. `@` is commonly empty after a `jj commit` — the command describes `@` and creates a fresh
empty commit on top. `jj new` also creates empty commits by design. Abandon them with
`jj abandon <rev>` if they accumulate.

### "How do I know if a commit has been pushed?"

`jj log -r '<rev> & remote_bookmarks()'` returns it if it is the tip of a tracked remote bookmark.
More broadly, `jj log -r 'immutable()'` lists all immutable commits; anything reachable from them
has been published.

### "Rebase didn't stop on a conflict. What do I do?"

That is by design. Check `jj log -r 'conflicts()'` to see conflicted commits; resolve them when
ready. The rebase completed successfully from jj's perspective.

### "What's the difference between `jj undo` and `jj op restore`?"

`jj undo` walks back one operation. Repeated calls walk further back. `jj redo` walks forward.
`jj op restore <id>` jumps directly to a specific op ID — useful when many operations need to be
rewound at once.

### "Why don't my bookmarks move when I commit?"

By design. Bookmarks are Git-branch-like pointers, and silently moving them on every commit would
make it easy to accidentally advance `main` over WIP. Move bookmarks explicitly with
`jj bookmark set <name>`, or use `jj bookmark advance` (0.39.0+) to move the nearest bookmark
forward on demand.

### "What is `trunk()`?"

A built-in revset alias that resolves to the head of the main/master/trunk bookmark on the default
remote (usually `main@origin`). Override with `revset-aliases.'trunk()'` if your repo's trunk is
named differently.

### "How do I get back my stale working copy?"

In multi-workspace setups, `jj workspace update-stale`. This runs automatically in most cases.

### "Where does jj store its state?"

- `.jj/` — operation log, workspace metadata, change-ID tracking. jj-specific.
- `.git/` — underlying Git object store. All commits are here.

In a colocated repo, both exist side-by-side. Never delete `.jj/` manually — it wipes the op log
and change-ID mappings, though the Git commits survive.

---

## Summary

1. **Commit IDs change, change IDs do not, operation IDs never change.** Reference the right one
   for the context.
2. **The working copy is a commit; `@` is ephemeral by convention but durable in implementation.**
3. **Conflicts are commit properties, not process states. Resolve when ready.**
4. **The op log is a time machine. Use it.**
5. **Mutable vs immutable is a safety net. Respect it unless there is an explicit reason to
   override.**

These five rules capture the model. Command names follow from them.
