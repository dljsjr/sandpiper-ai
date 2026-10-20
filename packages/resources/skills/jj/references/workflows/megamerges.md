# Megamerges

Load this reference when working on multiple in-flight branches simultaneously, when composing
all your work into a single working copy while keeping the branches separable for review, or when
cleaning up a tangled multi-branch state.

Megamerges are jj's answer to the "I have work spread across multiple branches and I need them
to work together to develop the next thing" problem. The pattern uses a **local-only merge
commit** as an integration point — it never gets pushed, but it gives you a single working copy
where all the in-flight work is live simultaneously. The merge can have any number of parents
(two, three, ten) depending on how many streams are being integrated; octopus merges (3+
parents) are common when integrating several feature branches at once, but a two-parent
megamerge (one feature branch + trunk) is also valid.

Topics:

1. What a megamerge is
2. Detecting an existing megamerge
3. When to use one
4. Building a megamerge
5. Working in the megamerge
6. Integrating WIP back into the source branches
7. Adding and removing branches
8. Keeping the megamerge up to date with trunk
9. Resolving conflicts in a megamerge
10. Safety rails — don't push the megamerge
11. When *not* to use a megamerge

---

## 1. What a megamerge is

A megamerge is a single commit whose parents are the tips of every branch you want to work with
simultaneously. The parent count is whatever the number of integration targets happens to be —
two is valid (one feature + trunk), three or more is typical when combining multiple feature
branches. Multi-parent (octopus) merges are legal in Git; jj treats them as first-class.

What distinguishes a megamerge from an ordinary merge commit is not the parent count but the
usage pattern: it lives only in the local repo, never gets pushed, and exists so that the user
can see the combined behavior of the parent branches while still integrating changes back into
them individually.

Graph (three-parent example):

```
     megamerge    ← parents: feature-a, feature-b, feature-c, main
    /    |    \
feat-a feat-b feat-c  main
   \    |    /    /
    ...  ...  ...
       main-ancestors
```

The working copy `@` sits on top of the megamerge. The working-copy commit holds whatever WIP
is under exploration. Every change in it is effectively made against *all* parent branches
simultaneously. The merge commit itself is a convenient integration point — nothing
structurally special.

---

## 2. Detecting an existing megamerge

Before doing any non-trivial jj work, check whether the current session is already operating
inside a megamerge. The signals:

**Signal 1 — mutable merge in `@`'s ancestry:**

```console
jj log -r '::@ & merges() & mutable()'
```

Any result here is a merge commit that is both (a) still rewritable and (b) in the current
ancestry chain. A megamerge is always mutable (it is never pushed), so *any* mutable merge in
the local chain is a strong megamerge signal — regardless of parent count. This is the primary
detection check.

**Signal 2 — parent count and description:**

```console
jj log -r '::@ & merges()' -T 'change_id.shortest() ++ " " ++ parents.len() ++ " parents — " ++ description.first_line() ++ "\n"'
```

Inspect the output:

- A commit with 3+ parents in `@`'s ancestry is almost certainly a megamerge — ordinary Git-flow
  merges are two-parent.
- A two-parent merge can still be a megamerge (integrating one feature branch with trunk).
  Disambiguate using signal 1 (is it mutable?) plus signal 3 (does the description match the
  convention?).

**Signal 3 — conventional description:**

```console
jj log -r 'description(exact:"megamerge") | description(glob:"megamerge*")'
```

If the repo follows the convention in this document, the merge commit has the description
`megamerge` (or starts with it). This is the quickest check and the most explicit signal.

**Signal 4 — `git.private-commits` config targets a megamerge pattern:**

```console
jj config get git.private-commits
```

If the result references `description(exact:"megamerge")` or similar, the repo is set up for the
megamerge workflow and an existing megamerge probably exists somewhere.

**What to do when detection is positive:**

1. Identify the megamerge commit — typically `heads(::@ & merges() & mutable())`.
2. Identify its parents — `parents(<megamerge-change-id>)`. These are the feature branches being
   integrated.
3. Identify any WIP descendants — `<megamerge-change-id>::@`.
4. Before modifying anything, confirm with the user what integration target the work belongs in
   (see section 6, "Integrating WIP back into the source branches"). Do not push the megamerge
   itself (section 10).

**What to do when detection is negative but a megamerge would help:**

The current task may benefit from creating one — see section 3 ("When to use one") and section 4
("Building a megamerge").

---

## 3. When to use one

Use a megamerge when any of the following hold:

- **You have several in-flight branches that touch overlapping code**, and you want to verify they
  work together before merging.
- **You depend on two or more PRs that aren't merged yet** and want to develop on their
  combination.
- **Your local "work-in-progress" includes environment scaffolding** (local config tweaks, debug
  toggles) that shouldn't land in any of the feature branches but should be active while you
  work.
- **You want to see the integrated product.** If the combined working copy compiles and runs
  without issue, you have evidence that the feature branches interact cleanly — which is worth
  much more than testing each branch in isolation.

---

## 4. Building a megamerge

### Create the merge commit and a WIP child

```console
jj new main feat-a feat-b feat-c -m "megamerge"
# ...include whatever bookmarks you want to integrate...
jj new -m "wip: working on the integrated state"
```

The first `jj new` creates the octopus merge commit with four parents. The second `jj new` makes
an empty descendant that becomes your WIP working copy. Do your work in that WIP commit.

### Alternative: one step

```console
jj new main feat-a feat-b feat-c -m "megamerge"
# The new commit is @ directly; it's both the octopus merge and the WIP.
```

Not recommended — keep the merge commit separate so you can reliably identify it with a
description-based revset (see the "find the megamerge" example below).

### Confirming the shape

```console
jj log -r 'roots(main..@)::@'
```

You should see the parent branch tips feeding into the megamerge, with `@` on top.

---

## 5. Working in the megamerge

In day-to-day use, edit files and commit as normal:

```console
jj commit -m "wip: experimenting with combined state"
# ...more edits...
jj commit -m "wip: next exploration"
```

Each `jj commit -m` finalizes the current working-copy commit and advances to a fresh empty `@`.
Every commit you make is a descendant of the megamerge. The feature branches below are unaffected;
they stay at their tips.

Running tests, dev servers, builds — all operate on the combined state. That is the value the
megamerge delivers: the runtime behavior reflects all parent branches simultaneously.

---

## 6. Integrating WIP back into the source branches

Once you've made a change in the WIP commit, which feature branch does it belong to? Three
approaches, from most-automatic to most-explicit:

### `jj absorb` (try first)

```console
jj absorb
```

`jj absorb` examines each hunk in the WIP and routes it to the ancestor that most recently
modified those lines. Because the megamerge has multiple branch ancestors, absorb's
"nearest-ancestor" logic produces the expected outcome: a hunk in code last touched in `feat-b`
lands in `feat-b`.

`jj absorb` is conservative: if it cannot unambiguously determine where a hunk belongs, it leaves
the hunk in the working copy rather than guessing. After running, inspect with `jj diff` to see
what, if anything, is left in `@`. See `workflows/absorb.md` for the full absorb playbook.

### Targeted `jj squash --from / --into` with file paths (explicit placement)

```console
jj squash --from @ --into feat-b -m "feat-b: targeted change" path/to/foo.ts path/to/bar.ts
```

Moves only the listed paths from `@` into `feat-b`. Repeat with different `--into` targets to
distribute remaining changes. This is the agent-preferred fallback when absorb leaves hunks
behind: it is fully non-interactive, the placement is explicit, and you can verify the result
with `jj diff` between runs.

### `jj squash --from @ --into <branch-tip>` (wholesale)

```console
jj squash --from @ --into feat-a --keep-emptied -m "feat-a: WIP consolidated"
```

Moves the entire WIP into one branch tip. `--keep-emptied` preserves the WIP commit empty, so
further exploration can continue from there. Use when the WIP genuinely belongs wholesale to one
branch and splitting is unnecessary.

### Interactive alternative (for human drivers)

`jj squash -i --into <branch-tip>` opens an interactive hunk picker. This hangs in a
non-interactive shell; an agent driver should reach for file-path-scoped `jj squash --from ...
--into ... <paths>` instead.

### After integration

```console
jj log -r 'main@origin..visible_heads()'
```

Verify the feature branches have absorbed the intended changes. The megamerge and WIP should
otherwise be unchanged — still the integration point and still your scratch.

---

## 7. Adding and removing branches

### Add a new parent to the megamerge

```console
jj rebase -r <megamerge> -d main -d feat-a -d feat-b -d feat-c -d feat-d
```

Rebases the megamerge with an explicit list of parents. Include the existing parents plus the new
one. Descendants of the megamerge (the WIP above it) are rebased automatically.

### Remove a parent

Rebuild the megamerge with the parents you want:

```console
jj new main feat-a feat-c -m "megamerge"   # no feat-b this time
```

Or surgically:

```console
jj rebase -r <megamerge> -d main -d feat-a -d feat-c
```

### Find the megamerge easily

```console
jj log -r 'description(exact:"megamerge")'
```

This is why giving the merge commit a consistent description pays off — you can reference it
without knowing its change ID.

### Optional: alias for insertion

If megamerges are routine in a given repo, these aliases streamline insertion:

```toml
[revset-aliases]
'closest_merge(to)' = 'heads(::to & merges())'

[aliases]
# Insert a revset as a new parent under the nearest ancestor merge commit
stack = ["rebase", "--after", "trunk()", "--before", "closest_merge(@)", "--revision"]
```

With the alias, adding a branch becomes `jj stack feat-d`. Optional; the explicit
`jj rebase -r <megamerge> -d ...` form works without it.

---

## 8. Keeping the megamerge up to date with trunk

The direct approach:

```console
jj git fetch
jj rebase -s <megamerge> -d 'trunk() | feat-a | feat-b | feat-c'
```

This rebases the megamerge (and descendants) onto current trunk plus the current feature-branch
tips. If feature branches on remotes have moved, include their updated tracked references.

### Optional: `restack` alias

If a repo has a mix of your-work and others'-work in its history, this alias rebases only the
mutable roots onto trunk, leaving already-published work alone:

```toml
[aliases]
restack = ["rebase", "--onto", "trunk()", "--source",
           "roots(trunk()..) & mutable()", "--simplify-parents"]
```

`jj restack` then rebases the roots of all mutable work onto `trunk()`. Remote-tracked branches
(which aren't in `mutable()`) stay where they were. The megamerge rebuilds on top of the new
trunk with the updated branch tips.

---

## 9. Resolving conflicts in a megamerge

Megamerges with 3+ parents integrate several branches simultaneously, so conflicts appear more
often than in an ordinary two-parent merge. jj handles them the same way regardless of parent
count — as commit properties, not blocking states.

### Identify

```console
jj log -r 'conflicts()'
```

Typically the megamerge itself will be conflicted; the WIP above it may also inherit the conflict.

### Resolve in the megamerge

```console
jj new <megamerge> -m "resolve: megamerge conflicts"
# ...edit files, remove all <<<<<<, +++++++, %%%%%%, >>>>>> markers...
jj squash -m "megamerge"
```

The resolution is folded into the megamerge commit. Descendants (the WIP) automatically rebase
and — if the resolution was correct — become unconflicted.

### Resolve in an individual branch

If the conflict is a symptom of incompatibility between two branches, fix it at one of the
branch tips rather than in the megamerge. Use the scratch-and-squash pattern on the branch tip:

```console
jj new feat-b -m "fix: resolve conflict with feat-a"
# ...edit...
jj squash -m "feat-b with feat-a compatibility fix"
jj rebase -s <megamerge> -d 'trunk() | feat-a | feat-b | feat-c'   # or jj restack if aliased
```

The megamerge rebuilds with the fixed branch and the conflict disappears.

### Conflicts propagate — resolve upstream first

If the megamerge is conflicted, so is the WIP built on top of it. Resolving the megamerge
automatically clears downstream conflicts (via rebase). Resolving the WIP without first resolving
the megamerge produces a conflicted WIP state — the rebase of the resolution back onto the
conflicted megamerge re-introduces the conflict. Always resolve the earliest conflict in the
chain first.

---

## 10. Safety rails — don't push the megamerge

The megamerge is a local integration artifact. Pushing it to a shared remote creates an octopus
merge commit in the upstream history that collaborators have no context for. Enforce this in
config:

```toml
[git]
private-commits = 'description(exact:"megamerge")'
```

This makes `jj git push` refuse to push the megamerge commit and, by transitivity, any WIP
descendants of it. Individual branch tips are not private and can still be pushed.

### Pushing individual branches after integration

```console
jj absorb                        # or targeted squash with file paths
jj git push -b feat-a
jj git push -b feat-b
jj git push -b feat-c
```

The megamerge stays local.

---

## 11. When *not* to use a megamerge

A megamerge is overkill for:

- **Single-branch work.** Use a normal linear branch.
- **Two branches that don't interact.** If `feat-a` and `feat-b` don't touch overlapping code,
  you don't need to see them integrated. Develop them independently.
- **Branches at different levels of stability.** If `feat-a` is about to merge and `feat-b` is a
  spike, merging them locally couples them artificially. Use separate workspaces instead — see
  `workflows/workspaces.md`.
- **Conflict-resolution-heavy scenarios where resolving the conflicts is premature.** Megamerges
  surface all conflicts between branches at once; if the branches aren't ready for reconciliation,
  keep them separate.

The common case: a handful of parallel streams (one or more feature branches plus trunk) that
will all land soon, where seeing their integrated behavior de-risks each one. There is no
structural upper bound on the number of parents — the practical limit is whatever a human or
agent can reason about without losing the plot. Single-stream megamerges work but are rare —
a plain rebase usually suffices.
