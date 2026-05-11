# `jj absorb` — Hunk-Level Auto Split-and-Squash

Load this reference when the working copy has scattered changes that logically belong in
different ancestor commits, and you want jj to figure out where each hunk goes.

`jj absorb` is the automated version of "I have some fixes spread across the code; please
distribute them into the commits that introduced the relevant lines." Conservative by design — if
it can't unambiguously place a hunk, it leaves the hunk in the working copy rather than guessing.

---

## 1. What absorb does

For each changed hunk in `@`:

1. Find the set of **mutable ancestor commits** that last modified the lines this hunk touches.
2. If exactly one ancestor wins, move the hunk into that ancestor.
3. If multiple ancestors could plausibly own the hunk, do nothing (leave the hunk in `@`).
4. Apply descendants rebases automatically.

The mental model: "squash the fix into the commit that introduced the bug, without me having to
find it."

---

## 2. When to use it

- After a working-copy-heavy session where you made several small fixes that each belong in a
  different recent commit.
- When cleaning up a megamerge's WIP back into its parent branches.
- After a code-review pass that touched many files — each fix needs to land in the commit that
  introduced the issue.
- When you forgot to amend a commit in real-time and now have a chain of "fix X, forgot to do Y,
  forgot to update Z" commits that should be folded back.

---

## 3. When not to use it

- When the changes belong in **one** specific ancestor. Use `jj squash --into <rev>` for
  explicit placement — clearer about intent.
- When the changes should form a **new** commit. Use `jj commit -m "msg"`.
- When the target ancestor is **immutable** (already on a remote with tracking bookmarks).
  `jj absorb` does not touch immutable commits; use `--ignore-immutable` only when the intent is
  to rewrite published history.
- When the changes span **unrelated files** and there isn't a single "owner" commit for each. In
  this case, absorb may correctly route some and leave others behind; you'll still need manual
  placement for the leftovers.

---

## 4. Usage

```console
jj absorb                              # source: @, destination: mutable() ancestors
jj absorb --from @-                    # use a different source
jj absorb --into 'mutable() & description(glob:"feat/*")'   # restrict destination set
```

### Flag reference

- `-f, --from <REVSET>` — source of changes to distribute (default: `@`)
- `-t, --into <REVSETS>` — destination set; absorb picks from this (default: `mutable()`)

### Scope with file paths

To limit absorb to specific files:

```console
# Only absorb changes in src/foo.rs
jj absorb src/foo.rs
```

This is useful when the working copy has scattered changes that absorb can handle, plus some
changes you want to keep in `@` as a new commit. Absorb only the former.

---

## 5. Reading absorb's output

absorb reports how many revisions it moved changes into, and implicitly how many hunks were left
behind (by what's still in `@` afterward). Typical output:

```
Absorbed changes into these revisions:
  qzmzpxyl xxxxxxxx feat: add widget
  rlvwtylp yyyyyyyy fix: widget bug
Working copy now at: ...
```

If `@`'s diff is non-empty after `jj absorb`, those hunks could not be unambiguously placed.
Inspect with `jj diff` and fall back to file-path-scoped placement:

```console
jj diff                                                              # see what is left
jj squash --from @ --into <target> -m "fix: ..." path/to/file.ts     # place specific files
```

---

## 6. What "ambiguous" means in practice

absorb refuses to act when:

- **Multiple ancestors last modified the same line.** A hunk touching line 10 of `foo.ts` could
  go to commit A (which last touched line 10 in its current form) or commit B (which also
  touched it in a different way earlier). absorb leaves it.
- **No ancestor modified the line.** A hunk touching brand-new lines (that no prior commit
  added) has no owner; absorb leaves it.
- **The target would be immutable.** absorb won't rewrite commits outside the `mutable()` set.
- **The destination doesn't exist.** If `--into` is an empty set, nothing to absorb into.

---

## 7. Recovery if absorb does something surprising

absorb creates an op log entry like any other command:

```console
jj op log --limit 3
jj undo       # reverse the absorb
```

Since absorb's output is visible (which revisions were changed), undoing after inspecting should
be a fast recovery path.

---

## 8. Combining absorb with squash for full coverage

The canonical cleanup pattern after a scattered WIP session:

```console
# Step 1: let absorb place what it can
jj absorb

# Step 2: see what is left
jj diff

# Step 3: for each remaining group of changes, place with explicit file paths
jj squash --from @ --into <target-1> -m "fix: ..." path/to/foo.ts
jj squash --from @ --into <target-2> -m "fix: ..." path/to/bar.ts

# Step 4: changes that belong in a new commit stay in @
jj commit -m "feat: new thing"
```

---

## 9. Agent usage

`jj absorb` is one of the tools that enables a "work messy, clean up after" workflow for agents.
An agent can make scattered fixes across files, then run `jj absorb` at the end to consolidate
into the correct ancestor commits.

**Pattern for agent sessions:**

```console
# Agent makes many small related fixes without worrying about commit boundaries
# ... edits ...

# At the end, consolidate
jj absorb
jj diff          # confirm what is left in @
# If @ is empty or contains only WIP: describe it or abandon
# If @ has leftover hunks: place them with file-path-scoped squash or keep as a new commit
```

`jj absorb` is conservative, so its output is trustworthy: it will not silently misroute changes.
A non-empty leftover diff is a signal to inspect and place manually, not a sign of malfunction.
