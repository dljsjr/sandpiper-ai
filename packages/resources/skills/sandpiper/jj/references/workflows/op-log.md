# The Operation Log — jj's Time Machine

Load this reference when recovering from a mistake, undoing a restructure, investigating what a
command produced, or jumping back to a known-good state.

The op log is jj's most impactful feature over Git. It makes every mutation reversible, subsumes
`git reflog` / `git stash` / `git reset --hard`, and never garbage-collects until
`jj util gc` is run explicitly. Treating it as the primary undo/redo/time-travel mechanism —
not as a last resort — is the habit that makes agent work with jj robust.

Topics:

1. What the op log is
2. Inspecting the log
3. `jj undo` / `jj redo`
4. `jj op revert` and `jj op restore`
5. Reading history non-destructively with `--at-op`
6. Checkpoint workflow
7. When the op log isn't enough (and when to escalate)

---

## 1. What the op log is

Every command that mutates repo state — `commit`, `new`, `rebase`, `squash`, `describe`, `abandon`,
`bookmark set`, `git fetch`, `git push`, `undo` itself — creates exactly one **operation**. Every
operation records:

- The command that ran (args)
- Timestamp and workspace name (0.40.0+ includes workspace)
- A complete snapshot of the repo — all visible commits, all bookmarks, all remote tracking —
  called a **view**
- A pointer to the previous operation

Operations are immutable and permanent. They are never edited after creation. The op log is an
append-only chain. "Undo" works by appending a new operation whose view is a revert; "restore"
appends a new operation whose view is a copy of an older view. The older operations remain in the
log.

This gives jj a lock-free concurrency model: two processes can run jj commands in parallel; each
produces its own new operation; the next command sees both heads and reconciles. No corruption;
no locking.

Operations are not GC'd unless `jj util gc` is run explicitly.

---

## 2. Inspecting the log

```console
jj op log                          # all operations, newest first
jj op log --limit 20               # limit output
jj op log -p                       # with patch — only "interesting" revisions by default (0.40.0+)
jj op log -p --show-changes-in=all()   # with patch, everything changed
jj op show <op-id>                 # detail view of a specific operation
jj op show @-                      # detail view of the previous operation
jj op show <op-id> -p              # with diff
```

`jj op log --limit 1 -T 'self.id() ++ "\n"'` prints only the current op ID — useful for
recording checkpoints.

Each entry in `jj op log` shows the command that produced it. This is the definitive audit trail
for what happened in the session. "What did my last 5 commands do?" is `jj op log --limit 5`.

### The workspace dimension (0.40.0+)

`jj op log` entries now include the workspace the op originated from. This matters when multiple
workspaces share one repo — a common agent pattern. If something surprising appears in the op log,
check the workspace column to see whether it came from your current session or another.

---

## 3. `jj undo` / `jj redo`

`jj undo` reverts the last operation. It is sequential: each invocation walks back one more op.
`jj redo` walks forward, re-applying operations that were undone.

```console
jj undo             # undo the last op
jj undo             # undo the previous op (two steps back now)
jj redo             # re-apply the most recently undone op (one step back)
jj redo             # re-apply the next (current state again)
```

**Use `jj undo` when:** the last command was wrong and you want to reverse it. This is idiomatic
and cheap. Never hesitate to try it — it's always reversible with `jj redo`.

**Use `jj redo` when:** you undid too far, or you want to re-apply an operation you reverted
earlier.

### What `jj undo` cannot do

Once you run a *new* mutating command after `jj undo`, the undone operations branch off the op
log and `jj redo` can no longer find them. Practically: don't use `jj undo` as a permanent
reset — if the intent is "I want to go back to state X and do something new from there," use
`jj op restore <op-id>` instead, or mark the undo clearly and proceed.

Also: `jj undo` reverses the last *operation*, not necessarily the last *command*. A command that
does nothing mutating (`jj log`, `jj status`) doesn't produce an op, so `jj undo` will skip past
it to the last actual mutation.

---

## 4. `jj op revert` and `jj op restore`

For more targeted time travel than `jj undo`:

### `jj op revert <op-id>`

Applies the inverse of a specific operation. Everything that happened *since* that operation is
preserved. Think of it as "undo this one thing in history, keep everything else."

```console
jj op revert d6255cf6       # revert the effect of operation d6255cf6 specifically
```

Use when: a mistake was made several operations ago, but work since then is valid and you want to
keep it.

### `jj op restore <op-id>`

Jumps the entire repo state to the view at a specific operation. Everything that happened after
that operation is bypassed (the operations are still in the log, but no longer the current head).

```console
jj op restore d6255cf6      # repo state = as of operation d6255cf6
```

Use when: multiple operations went wrong and you want a clean reset to a known-good checkpoint.

### The difference in one sentence

`jj op revert` is "patch out this one operation"; `jj op restore` is "rewind to this snapshot."

---

## 5. Reading history non-destructively with `--at-op`

Every jj command accepts a global `--at-op=<op-id>` (alias `--at-operation`) flag that reads the
repo *as of that operation*, without modifying current state. The docs note:

Use with read-only commands (`jj log`, `jj status`, `jj diff`). Running mutating commands with
`--at-op` is legal but unusual — it creates a new operation that branches off the old one, which
typically isn't what's intended.

```console
jj --at-op=<op-id> log                     # view log at that point
jj --at-op=<op-id> diff -r @               # what @ looked like at that point
jj --at-op=<op-id> bookmark list           # where bookmarks pointed
jj --at-op=@- diff -r @                    # what @ looked like one op ago
```

`@` inside `jj op` commands refers to the current operation. `@-` is the previous op, `@+` the
next (if undone). `@--` is two ops back.

This is a powerful investigation tool:

- "What did this file look like before I started the rebase?" → `jj --at-op=<pre-rebase-op> file
  show -r <rev> <path>`
- "When did this commit get created?" → `jj --at-op=<op> log -r <rev>` across op history
- "What did the last command change?" → `jj op show @-`

Non-destructive: `--at-op` reads the snapshot and discards it; no op-log entry is created.

---

## 6. Checkpoint workflow

The idiom for any risky multi-step operation:

### Before starting

```console
jj op log --limit 1 -T 'self.id() ++ "\n"'
# → prints a 12-char op id, e.g. a hex string like that of any Git short-SHA
```

Record the printed op ID. Communicate it to the user along with the restore command so they can
roll back if anything looks wrong: `jj op restore <op-id>`.

### During work

Run commands in small steps, verifying each:

```console
jj rebase -r <rev> -A <target>
jj log -r 'main@origin..visible_heads()'   # verify shape
# next step...
```

If something surprising happens, step back one op at a time:

```console
jj undo
jj log -r 'main@origin..visible_heads()'   # verify we're back where we want
```

### If things go wrong

```console
jj op restore <checkpoint-op-id>           # back to the recorded checkpoint
```

This resets the entire repo state to the checkpoint. Operations that happened after are preserved
in the op log (still discoverable via `jj op log`); they are no longer the current head but
remain reachable.

### After completion

Report the final state, a compact `jj log` output, and the checkpoint op ID with the restore
command — so the user can verify what landed and knows exactly how to roll back if anything looks
off.

---

## 7. When the op log isn't enough

The op log is extraordinarily resilient, but it lives inside `.jj/`. If `.jj/` is deleted (e.g.
by an agent that mistakenly runs `rm -rf .jj` to "fix" a hang), the op log and all change-ID
tracking are gone. The Git commits themselves survive in `.git/`, but you've lost:

- The op log (no `jj undo`, no `jj op restore`)
- Change-ID mappings (refer to commits only by SHA from here on)
- Workspace metadata
- The "invisible" commits that aren't reachable via bookmarks

**Never `rm -rf .jj`.** If commands are hanging or the repo seems broken, escalate to the user
before deleting anything.

Recovery after `.jj/` loss:

```console
cd <repo>
jj git init --colocate        # reinitialize jj against the existing .git/
```

This creates a new `.jj/` with a fresh op log. Existing Git commits are now visible in jj again,
but with new change IDs. Anything that was only in the op log (abandoned commits, etc.) is gone.

---

## Quick reference

```console
# Inspect
jj op log                           # list ops
jj op log --limit 10
jj op show <op-id>                  # detail
jj op log -T 'self.id() ++ "\n"'    # op IDs only

# Reverse
jj undo                             # last op
jj redo                             # re-apply undone
jj op revert <op-id>                # undo a specific op
jj op restore <op-id>               # rewind to this state

# Read without modifying
jj --at-op=<op-id> log
jj --at-op=@- diff -r @

# Checkpoint
CHECKPOINT=$(jj op log --limit 1 -T 'self.id()')
# ...risky work...
# if broken:
jj op restore $CHECKPOINT
```

---

## Summary

The op log is the primary mechanism for iterative jj work, not an emergency escape hatch. The
productive loop: move quickly, verify after each step, trust that any mistake is one `jj undo`
away from reversal. Cheap mistakes plus cheap reversal beats expensive planning to avoid
mistakes.
