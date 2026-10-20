# Stacked PRs with jj

Load this reference when maintaining or reviewing a chain of dependent PRs — where PR #2 builds
on PR #1, PR #3 builds on PR #2, etc., and each needs its own review and merge independently.

Stacked PRs are a common pattern at companies with high code-review rigor (especially
Meta-alumni projects using Phabricator-style workflows). The challenge is keeping the stack
updated: when PR #1 gets review feedback and changes, PR #2 and #3 need to rebase, and the rebase
needs to happen without losing the PR-to-commit mapping on the forge.

jj handles this well because:

- Auto-rebase propagates changes through descendants automatically
- Change IDs are stable, so PR-to-change mappings don't break under rebase
- Lease-checked pushes prevent accidents when updating the stack

---

## 1. The setup

A stack of N commits/PRs:

```
@ (empty, WIP continuation)
│
● feat-3 (PR #3 — depends on #2)
│
● feat-2 (PR #2 — depends on #1)
│
● feat-1 (PR #1)
│
trunk
```

Each commit has a bookmark that maps to a PR on the forge. `feat-1`, `feat-2`, `feat-3` are the
bookmarks.

---

## 2. Creating the stack

```console
jj new main -m "feat(#1): first thing"
# ... implement ...
jj bookmark create feat-1 -r @
jj git push -b feat-1                          # push, create PR #1

jj new -m "feat(#2): second thing depending on first"
# ... implement ...
jj bookmark create feat-2 -r @
jj git push -b feat-2                          # push, create PR #2

jj new -m "feat(#3): third thing depending on second"
# ... implement ...
jj bookmark create feat-3 -r @
jj git push -b feat-3                          # push, create PR #3
```

Each PR is based on the previous one's branch. The forge should show a stack graph (GitHub's
"Compare" view, GitLab's MR dependencies, etc.).

---

## 3. Addressing review feedback on PR #1

You get review on PR #1. Need to amend the commit.

```console
jj edit feat-1          # make feat-1 the working copy
# ... make fixes ...
jj git push -b feat-1   # force-push with lease — safe
```

Auto-rebase handles the propagation: `feat-2` and `feat-3` are re-parented onto the new `feat-1`
tip automatically. If there are no conflicts, done. Push `feat-2` and `feat-3` too:

```console
jj git push -b feat-2 -b feat-3
```

Each force-push is lease-checked; if someone else pushed to `feat-2` or `feat-3` concurrently,
the push refuses with a bookmark conflict.

---

## 4. When the rebase produces conflicts

If amending `feat-1` conflicts with changes in `feat-2` or `feat-3`:

```console
jj log -r 'conflicts()'                # which commits are conflicted
```

Resolve in the earliest conflicted commit first (see `SKILL.md` failure modes section on conflict
propagation). Use the scratch-and-squash pattern:

```console
jj new feat-2 -m "resolve: feat-2 after feat-1 update"
# ... resolve markers ...
jj squash -m "feat(#2): second thing depending on first"
jj bookmark set feat-2 -r @
```

Then push once the whole stack is clean.

---

## 5. Updating the stack against trunk

Before pushing final versions, rebase the whole stack onto current trunk:

```console
jj git fetch
jj rebase -b feat-3 -d main@origin             # rebase the whole branch containing feat-3
```

`-b feat-3` includes `feat-1`, `feat-2`, and `feat-3` since they are all on the same branch
leading to `feat-3`. All rebase onto `main@origin`.

If conflicts appear, resolve from the earliest conflicted commit upward (the conflict in the
earliest commit propagates to its descendants, so fixing it may clear the downstream conflicts
automatically).

---

## 6. Landing the stack

When PR #1 merges on the forge:

```console
jj git fetch                                   # pull the merged main
jj bookmark forget feat-1                      # local bookmark is no longer needed
jj rebase -b feat-3 -d main@origin             # rebase #2 and #3 onto new main
```

Feat-1's commit is now visible on `main@origin` (the merged version). Feat-2 and feat-3 are now
rooted at main again.

Push the updated stack:

```console
jj git push -b feat-2 -b feat-3
```

Repeat for each landed PR.

---

## 7. Reviewing a stack

Use the review-large-changes pattern (see `workflows/reviewing-large-changes.md`), but duplicate
each PR's tip:

```console
jj duplicate feat-1@origin
jj new --no-edit --insert-before @ --message "review: feat-1"
# review feat-1

jj duplicate feat-2@origin
jj new --no-edit --insert-before @ --message "review: feat-2"
# review feat-2 — note, its "diff" is the interdiff between feat-1 and feat-2
# which is exactly what the PR shows on the forge

# etc.
```

---

## 8. Safety rails

### Immutable-heads override

Given that each PR tip is on a remote, mark them immutable to prevent accidental rewrites:

```toml
[revset-aliases]
'immutable_heads()' = "builtin_immutable_heads() | remote_bookmarks()"
```

Intentional rewrites (addressing review) require explicit `jj edit`; accidental ones get blocked.

### Private WIP

If exploring the top of the stack with WIP commits:

```toml
[git]
private-commits = "description(glob:'wip:*')"
```

WIP-labeled commits above `feat-3` can't be pushed.

### Force-push awareness

Every push to an existing stack branch is a force-push (with lease). The lease check is the
safety net. Do NOT use `--force` without lease (there's no such flag in `jj git push` — the lease
is always on).

---

## 9. Quick reference

```console
# Create stack
jj new <base> -m "feat(#N): ..."
jj bookmark create feat-N -r @
jj git push -b feat-N

# Amend a PR in the middle
jj edit feat-K                                  # jump to it
# ... fix ...
jj git push -b feat-K                           # push (descendants auto-rebased)
jj git push -b feat-K+1 -b feat-K+2             # push updated descendants

# Rebase stack onto new trunk
jj git fetch
jj rebase -b <top-of-stack> -d main@origin

# After a PR lands
jj bookmark forget <merged-bookmark>
jj rebase -b <remaining-top> -d main@origin
jj git push -b <remaining...>
```
