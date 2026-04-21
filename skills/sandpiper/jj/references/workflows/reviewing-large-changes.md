# Reviewing Large Changes with jj

Load this reference when reviewing a large diff — either your own pending work, a colleague's
branch, or an agent's output — where line-by-line IDE review with progress tracking is wanted.

The pattern turns a large diff into a navigable workflow where "what have I looked at" is a
machine-checkable artifact. Progress persists across sessions, the review happens in the
reviewer's real IDE with full tooling, and a diff between the original branch and the reviewer's
"brain" commit captures every note as inline code changes.

---

## 1. The problem

A large-PR review in a browser lacks syntax highlighting, navigation, IDE integration, and
progress tracking across sessions. Checking out the branch locally gains the first three but
still misses persistent progress tracking.

Requirements for a useful review workflow:

- Read the code in the reviewer's IDE, with full tooling
- Mark files as reviewed cumulatively as the review progresses
- Resume where review left off after any interruption
- See only what remains to review at any moment
- Leave notes inline in the code without affecting the original branch

---

## 2. The "brain commit" pattern

**Duplicate the branch under review into a mutable copy, then progressively squash reviewed
files into an empty "brain" commit underneath.** What remains in the mutable copy is the code
that has not yet been reviewed.

Graph shape:

```
big-change@origin     (immutable reference; the original branch)

↓ duplicate into a mutable local version

... → brain-commit (empty) → big-change-dup (mutable, contains diff)  ← you review here
```

As you mark files reviewed, you `jj squash <file> -r big-change-dup --into <brain>`. Files move
from the top (unreviewed) into the bottom (reviewed). When the top commit is empty, review is
complete.

---

## 3. Setup

```console
# Fetch the branch to review
jj git fetch -b big-change

# Duplicate it into a mutable local commit
jj duplicate big-change@origin

# Edit into the duplicate
jj edit <duplicated-change-id>

# Create an empty parent commit to serve as the "brain"
jj new --no-edit --insert-before @ --message "review: big-change"
```

Now:

- `@` is the duplicate of the branch (all the diff lives here)
- `@-` is an empty "brain" commit (nothing reviewed yet)

### Alternative ordering

Some reviewers prefer putting the brain *above* the branch (so `@-` contains the code and `@` is
the brain). Either works; adjust commands accordingly.

---

## 4. Reviewing

Open files in the editor, read, and mark each file reviewed by squashing its changes out of `@`
(unreviewed) into `@-` (the brain):

```console
# After reviewing src/foo.ts — move its changes into the brain:
jj squash src/foo.ts -m "review: brain"
```

For partial-file review — where some hunks within a file were inspected and others were not —
prefer the scratch-and-squash pattern over `jj squash -i`: create a scratch commit, copy only
the reviewed lines by hand, and squash. Interactive forms hang in non-interactive contexts (see
SKILL.md rule 1).

### Progress check

```console
jj status                    # shows what's still in @ (unreviewed)
jj diff --stat               # file-level summary of what's left
```

When `jj diff` returns empty, review is complete.

---

## 5. Leaving review notes

To leave a comment on a line that might become a PR review comment:

```console
# Edit the file in @, add a comment
# e.g., in src/foo.ts, add: // REVIEW: this seems off — why not use X?
# Then don't squash that file yet, so the comment stays in @
```

After review, the diff between the brain and the original branch captures all your notes:

```console
jj interdiff --from big-change@origin --to <brain-change-id>
```

Any difference is a note. Useful for exporting feedback or turning into PR comments.

---

## 6. Handling mid-review pauses

Because the brain commit persists, you can walk away and come back:

```console
# Come back the next day:
jj edit <duplicate-change-id>        # back in the duplicate
jj diff --stat                        # see what's left
```

No context loss. Progress is a real commit in the op log.

---

## 7. When the upstream branch updates

If `big-change` gets new commits while you're reviewing:

```console
jj git fetch -b big-change
jj rebase -s <duplicate-change-id> -d big-change@origin
```

The rebase brings the duplicate up to date. Your brain commit now reflects "what I reviewed as of
the old version"; the new diff in the duplicate is the new material.

If you want to see what's new since your last review:

```console
jj interdiff --from <old-brain-change-id> --to <new-duplicate-change-id>
```

---

## 8. Completing the review

When `jj diff` against the duplicate is empty:

```console
jj interdiff --from big-change@origin --to <brain-change-id>
```

- If empty: the brain matches the original branch exactly. No notes to submit; approve.
- If non-empty: the diffs are the review notes. Capture them as PR comments.

### Cleanup

```console
jj abandon <duplicate-change-id>
jj abandon <brain-change-id>
```

Both can be removed; their content is now either merged or captured elsewhere.

---

## 9. Why this works in jj (and not Git)

Two jj properties make the pattern possible:

1. **Change IDs are stable** across rebases and other mutations. The brain commit and duplicate
   retain durable identities throughout the review, even when the upstream branch moves. Git's
   commit-SHA churn would invalidate progress tracking on every rebase.
2. **`jj squash <path>`** cleanly moves file-level changes between any two commits. Git has no
   direct equivalent (`git reset <commit> -- <path>` approximates but produces a different
   working state).

---

## 10. Agent usage

This pattern applies equally when an **agent reviews another agent's output** — a common
verification-heavy workflow.

```console
# Dispatch: agent-A writes code on feat/X
# Orchestrator sets up a reviewer:
jj duplicate feat/X
jj edit <duplicate>
jj new --no-edit --insert-before @ --message "review: feat/X by agent-B"

# Agent-B reviews:
#   reads file, calls `jj squash <file>` for clean files
#   reads file, adds `// REVIEW:` comment and leaves file for orchestrator
```

The brain commit becomes a machine-readable artifact: "what has agent-B inspected?" If agent-B
finished and the duplicate is empty, every file was inspected. If agent-B finished but the
duplicate has files left, those files were implicitly flagged as "inadequate for review."

---

## Quick reference

```console
jj git fetch -b <branch>
jj duplicate <branch>@origin
jj edit <duplicate>
jj new --no-edit --insert-before @ --message "review: <branch>"
# ... review in IDE ...
jj squash <file>                            # mark reviewed
jj status                                   # see what's left
jj interdiff --from <branch>@origin --to <brain>  # see review notes as a diff
# When done:
jj abandon <duplicate> <brain>
```
