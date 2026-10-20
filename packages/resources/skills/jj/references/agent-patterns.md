# jj Agent Patterns

Load this reference for non-trivial jj work: reshaping the graph, choosing between similar
commands, deciding whether to ask the user before proceeding, or executing a checkpoint-first
workflow. SKILL.md carries the mandatory rules and recovery paths; this document covers the
command-choice heuristics, verification habits, and interaction patterns that sit on top of
those rules.

Topics:

1. Why jj fits agent work
2. Command-choice heuristics
3. Verification habits
4. Safe restructuring protocol
5. Interaction patterns with the user
6. When stuck

---

## 1. Why jj fits agent work

Two properties of jj change the cost of version-control mistakes for an agent.

**The working copy is a commit.** Every change is in the graph the moment `jj` sees it. There is
no class of bug where an agent forgot to stage a file, no `git add -p` dance, no "did I commit
that?" ambiguity. The trade-off is that the working copy is itself a real commit that can be
rewritten or orphaned — which matters for safe restructuring (section 4).

**Every operation is journaled and reversible.** The op log records every mutation as an atomic
transaction. `jj undo` steps back; `jj op restore <id>` jumps to any prior state. Nothing is
destroyed by a jj command until `jj util gc` is explicitly run. For an agent that will
occasionally make mistakes, this turns "I broke the history" from a catastrophe into an
inconvenience.

Together these properties permit a different working posture: move fast, iterate, and let the op
log cover the mistakes. Git's model requires more planning before each mutation because reversing
is harder. jj's model permits more planning after, which maps better to how agents iterate.

---

## 2. Command-choice heuristics

Commands with similar effects appear in several places. Decision rules:

### Finalizing current work

Use `jj commit -m "msg"` when the current working-copy commit should become a named change and
you want to continue in a fresh empty `@`. This is the agent-safe spelling of the normal commit
flow because the describe-and-advance sequence happens in one command.

Avoid doing `jj describe -m "msg"` and then `jj new` as two separate steps for normal commits. If
the second command is forgotten or delayed, subsequent file edits modify the just-described commit.
Use `jj describe -m` only when the goal is to rename an existing revision and keep editing it; use
`jj new -m` when the goal is to intentionally create an empty child or merge commit.

### Moving changes into an existing commit

- **`jj squash`** — move `@` changes into `@-`. The default, lowest-cost option.
- **`jj squash --from <a> --into <b> -m "msg"`** — move content between arbitrary commits. Use
  when source and destination are both specific and known.
- **`jj squash --from <a> --into <b> -m "msg" <paths>`** — same, scoped to specific files. The
  agent-preferred form for partial moves: fully non-interactive and explicit about placement.
- **`jj squash -r <rev>`** — squash `<rev>` into its parent. Consolidates a descendant into its
  parent without moving `@`.
- **`jj absorb`** — when `@` contains scattered fixes that belong in several different ancestors,
  absorb routes each hunk to the nearest ancestor that last modified the same lines.
  Conservative: hunks it cannot unambiguously place remain in `@`.

**Rule of thumb:** reach for `absorb` first when the working copy holds scattered fixes. If it
leaves hunks behind (or reports "0 revisions changed"), fall back to file-path-scoped
`jj squash --from ... --into ... <paths>` for explicit placement. Load
`references/workflows/absorb.md` for the full playbook.

### Splitting a commit

- **`jj split -m "msg" <paths>`** — paths go into the first commit, the rest into the second. The
  agent-preferred form.
- **`jj split --parallel`** — siblings instead of parent/child. Use when the split pieces are
  genuinely independent and should not be linearly ordered.

Always pass `-m` when splitting a described commit: both sides may need descriptions, and
without `-m` jj opens `$EDITOR` for the second.

### Moving or extracting a commit

- **`jj rebase -r <rev> -A <after>`** — rip `<rev>` out of its current location and insert after
  `<after>`. Descendants of `<rev>`'s old parent reconnect; the `-A` target's existing children
  rebase onto `<rev>` (stacking them on top).
- **`jj rebase -r <rev> -B <before>`** — same, inserting before.
- **`jj rebase -r <rev> -o <new-parent>`** — place `<rev>` onto `<new-parent>` as a new child.
  `<new-parent>`'s existing children do not move — this creates a fork, not a stack.
- **`jj rebase -s <rev> -d <dest>`** — move `<rev>` and all its descendants.
- **`jj rebase -b <rev> -d <dest>`** — move the whole "branch" containing `<rev>` relative to
  `<dest>`.

The `-A` / `-B` flags rebase the target's existing descendants onto the moved revision (stack).
`-o` does not (fork). Pick `-A` / `-B` for stacking, `-o` for forking.

### Resolving conflicts

For non-trivial resolution, use the scratch-and-squash pattern:

```console
jj new <conflicted-rev> -m "resolve: <description>"
# ...edit files to remove conflict markers...
jj squash -m "<description of the conflicted commit>"
```

This creates a scratch commit on top of the conflicted one, performs the resolution there, and
folds the resolution back. Works for any commit in the graph, not only `@`.

For simple "accept one side" resolutions:

```console
jj resolve --tool :ours      # or :theirs
```

`:ours` and `:theirs` semantics depend on context. In a rebase, `:ours` is the rebased side. In a
merge, `:ours` is the side that was merged into. When the semantics are not obvious from the
operation that produced the conflict, read the markers and resolve explicitly instead.

### Creating or moving a bookmark

- **`jj bookmark create <name> -r <rev>`** — new bookmark at `<rev>`.
- **`jj bookmark set <name> -r <rev>`** — create or move (forward-only by default).
  `--allow-backwards` permits backward moves.
- **`jj bookmark advance`** — move the nearest bookmark to `@` on demand (0.39.0+). Configurable
  via `revsets.bookmark-advance-{from,to}`.

Forgetting vs deleting:

- **`jj bookmark forget <name>`** — remove locally; do not propagate to remotes. Use when a
  local-only bookmark is no longer needed.
- **`jj bookmark delete <name>`** — queue a delete that propagates to tracking remotes on next
  push. Use when retiring a bookmark everywhere.

### Investigating without modifying

- **`jj --at-op=<op-id> log`** — read the repo as of a prior operation. No changes made.
- **`jj --at-op=@- diff -r @`** — what `@` looked like one op ago.
- **`jj op show <op-id>`** — detailed view of a specific operation.
- **`jj evolog -r <change-id>`** — show every past commit that this change ID has been.

These commands are safe to run at any time. Use them before attempting a fix, not after.

---

## 3. Verification habits

**Check the shape, not only the status.** `jj status` reports working-copy state and conflicts —
enough for "what is in `@` right now" — but not graph shape. After any restructure, run
`jj log -r '<revset>'` scoped to the change:

```console
jj log -r 'main@origin..visible_heads()'        # everything local
jj log -r 'trunk()..@'                          # work atop trunk
jj log -r 'main..feat/autotoon'                 # one bookmark's contribution
jj log -r '<change-id>::<change-id>'            # a specific range
```

**Record op history before risky work.**

```console
jj op log --limit 1 -T 'self.id() ++ "\n"'
```

Note the op ID. After the work, `jj op log --limit 3` shows the new op plus its parent (the
checkpoint).

**Surface conflicts anywhere in the graph**, not only at `@`:

```console
jj log -r 'conflicts()'
```

A conflict can appear several commits away from `@` after a rebase. This revset surfaces every
conflicted commit in the repo.

**Identify stale empty commits:**

```console
jj log -r 'empty() & mutable()'
```

After consolidation, empty mutable commits may linger. `jj abandon <rev>` removes them cleanly.

---

## 4. Safe restructuring protocol

For non-trivial graph surgery — reordering, splitting, consolidating branches, megamerges — the
following sequence minimizes the risk of a half-done state:

1. **Record a checkpoint.** `jj op log --limit 1 -T 'self.id() ++ "\n"'`. Share the op ID with
   the user.
2. **Plan the end state.** Describe the final graph shape in prose before executing. Reference
   change IDs, not commit IDs.
3. **Classify each in-scope commit.** Decide whether it gets moved, abandoned, split, squashed,
   or left in place. Write the classification down as a plan the user can review.
4. **Execute in small steps.** After each restructuring command, run `jj log -r '<revset>'` and
   verify against the plan. Do not chain multiple restructures and verify only at the end.
5. **Resolve conflicts before the next restructure.** If a restructure creates conflicts in
   several commits, resolve the earliest conflicted commit and verify the others clear before
   proceeding. Conflicts compound across restructures.
6. **Move bookmarks last.** Bookmarks follow underlying commits, but explicit bookmark moves
   belong at the end, once the graph has settled.
7. **Verify the final state.** Full graph inspection. If the repo has a fast type-check or test
   suite, run it.
8. **Report the end state and the checkpoint op ID.** The user needs: what changed, a compact
   `jj log` output, and the rollback command (`jj op restore <checkpoint>`).

If step 4 or 5 produces surprising state, stop and read. Do not try to "fix forward" through an
unexpected condition — that compounds the problem. Use `jj undo` or
`jj op restore <checkpoint>` to return to a known-good state, then plan again.

---

## 5. Interaction patterns with the user

### When to proceed, when to ask

Proceed without asking when:

- The task is constrained and the failure modes are local and reversible (for example: "edit this
  file, commit, push")
- Recovery is cheap (op log always available)
- The shape of the end state is unambiguous from the user's request

Ask before proceeding when:

- The task will rewrite *published* commits (anything pushed to a shared remote)
- The task will delete or abandon commits not clearly marked as throwaway
- The task will force-push to `main` / `master` / `trunk`
- The task touches a bookmark that has a remote-tracking counterpart
- The mental model of the task and the user's words diverge — confirm rather than surprise

**Heuristic:** if the user's request is the jj equivalent of `git push --force origin main` or
`git reset --hard` in Git-land, stop and confirm intent. jj's safety mechanisms (lease checks,
first-class conflicts, op log) make the mechanical risk lower than the Git equivalent, but the
social impact of rewriting published history is the same.

### Sanity-checking user commands

Some user requests will cause damage if executed literally. Before executing:

- `jj abandon <rev>` where `<rev>` is an arbitrary ancestor — abandoning already-pushed commits
  creates divergence for collaborators. Confirm the target is not in `immutable()`.
- `jj git push --force` or equivalent overrides — confirm which bookmark and whether the remote
  is shared.
- `jj op restore <old-op>` that rolls back past multiple sessions of work — confirm the intended
  end state.
- Any `jj rebase --ignore-immutable` — this overrides the immutable-heads safety. Requires
  explicit justification.

### Reporting after operations

For non-trivial jj work, the end-of-turn summary includes:

- Which bookmarks moved, and where they point now (one line each)
- The final graph shape — a compact `jj log` output, scoped to the change with
  `-r 'main@origin..visible_heads()'`
- The checkpoint op ID so the user can run `jj op restore <checkpoint>` if the result looks wrong
- Any remaining conflicts — if intentional (for example, a megamerge tracking WIP), say so; if
  not, flag them for resolution

### When stuck, escalate cleanly

If several recovery attempts have not resolved an issue, escalate to the user with:

- A clear summary of what was attempted, in sequence
- The current state (`jj log`, `jj status`, `jj op log --limit 5`)
- A specific question or decision required from the user

Do not improvise destructive commands to "clean up." The op log provides a safe route back to a
known state.

---

## 6. When stuck

A diagnostic checklist when something looks wrong, in order:

1. `jj status` — working-copy state, conflicts
2. `jj log -r 'main@origin..visible_heads()'` — graph shape
3. `jj log -r 'conflicts()'` — conflicts anywhere
4. `jj op log --limit 10` — recent ops
5. `jj --at-op=<op-id> log` — read state as of a prior op without modifying
6. `jj undo` — reverse the last op
7. `jj op restore <checkpoint>` — jump to a known-good state

If none of the above resolves it, escalate to the user with the state summary described in
section 5. Do not improvise.
