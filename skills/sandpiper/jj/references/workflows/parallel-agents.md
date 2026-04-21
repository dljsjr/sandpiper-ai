# Parallel Coding Agents with jj

Load this reference when orchestrating multiple coding-agent sessions against one repository —
deciding between single-directory / multi-revision vs multi-workspace layouts, setting up
isolation, and merging results back.

For workspace mechanics, see `workflows/workspaces.md`. For the verification + recovery habits
that make any agent work robust, see `agent-patterns.md`.

Topics:

1. Why jj is well-suited to parallel agents
2. Two parallel-agent layouts
3. Setting up multiple workspaces for agents
4. Isolating agent sessions
5. Merging agent results back
6. Curation pattern — cleaning an agent's messy iteration
7. Safety rails for parallel agents
8. Anti-patterns

---

## 1. Why jj is well-suited to parallel agents

Short version: jj's history commands (`squash`, `split`, `absorb`, automatic rebase) let you
programmatically clean an agent's messy output into reviewable linear history. Git worktrees
give you filesystem isolation but don't help with history cleanup — you still have to manually
curate the commit sequence.

Specific properties that matter for parallel agent work:

- **The working copy is a commit.** An agent never has "uncommitted state that needs to be
  committed." Every change is already in the graph. You can rebase, squash, or abandon an
  agent's work without asking it to commit first.
- **Change IDs are stable across rewrites.** An orchestrator process can reference an agent's
  commit by change ID and that reference survives whatever restructuring the agent does next.
- **Op log is shared across workspaces.** An orchestrator in workspace 0 sees the op log entries
  from agents in workspaces 1–N. Auditable.
- **First-class conflicts.** If two agents produce work that conflicts during merge-back, jj
  records the conflict and lets you resolve when ready, rather than blocking.

The practical consequence: each agent operates on a separate copy of the codebase (when using
workspaces), and its working-copy commit is already in the shared op log the moment the agent
writes a file. There is no "forgot to add" class of bug and no race between agent edits and
commit boundaries.

---

## 2. Two parallel-agent layouts

### A. Single directory, multiple revisions

One working directory; agents switch between revisions via `jj edit <change-id>`.

**Pros:**

- Lightweight — no filesystem duplication
- Fast context switch (single `jj edit` call)
- Shared `node_modules/`, build caches

**Cons:**

- Agents can't run simultaneously (they collide on `@`)
- Port conflicts if multiple dev servers needed
- Working-copy state is shared, so one agent can clobber another's WIP

**Use when:** tasks are sequential, don't need independent runtime state, and share dependencies.

### B. Multiple workspaces

Each agent gets its own workspace directory with its own working-copy commit.

**Pros:**

- True filesystem isolation — each agent can run its own dev server, have its own
  `node_modules/`, have its own partially-compiled build
- Agents can run simultaneously
- No `@` collision

**Cons:**

- Higher resource cost (disk space, duplicated caches)
- Merging results back requires explicit cross-workspace operations

**Use when:** tasks need runtime isolation, agents run simultaneously, or per-task build/test
separation is wanted.

**Recommendation for most agent work: B (multiple workspaces).** The isolation pays off quickly.

---

## 3. Setting up multiple workspaces for agents

### Initial setup

From the repo's primary directory:

```console
jj workspace add ../proj-agent-1 --rev main
jj workspace add ../proj-agent-2 --rev main
jj workspace add ../proj-agent-3 --rev main
```

Each workspace starts with `@` as an empty commit on `main`. Each agent runs in its respective
workspace directory.

### Per-workspace config

If agents need different configs (e.g., different default editor, different revset for `log`),
set per-workspace config:

```console
cd ../proj-agent-1
jj config edit --workspace    # opens workspace-specific config
```

### Dev servers on different ports

In each workspace:

```console
# In ../proj-agent-1
PORT=3001 npm run dev

# In ../proj-agent-2
PORT=3002 npm run dev
```

The port layout is manual; jj doesn't manage it.

### Workspace naming

Default workspace names are the directory names. Override with `--name`:

```console
jj workspace add ../proj --name agent-a --rev main
```

Useful when directory paths are long or cryptic.

---

## 4. Isolating agent sessions

Beyond workspaces, additional isolation knobs:

### Scratch description prefix

Have agents prefix their WIP with a stable marker:

```console
jj new -m "wip[agent-a]: ..."
```

Then in `revsets.log` or custom aliases, filter:

```toml
[revset-aliases]
'agent_a_work()' = 'description(glob:"wip[agent-a]:*")'
```

`jj log -r 'agent_a_work()'` shows only that agent's commits.

### Private commits

Prevent agents from accidentally pushing scratch:

```toml
[git]
private-commits = "description(glob:'wip[*]:*')"
```

No agent's WIP-labeled commit will be pushable.

### Immutable-heads override

Prevent agents from rewriting pushed work:

```toml
[revset-aliases]
'immutable_heads()' = "builtin_immutable_heads() | remote_bookmarks()"
```

Anything on a tracking remote is immutable; agent rewrites require `--ignore-immutable`, which
should never happen without explicit user authorization.

---

## 5. Merging agent results back

Because workspaces share the op log and change IDs, an orchestrator session can manipulate any
agent's commits by change ID. Canonical patterns:

### Review an agent's branch

From the orchestrator workspace:

```console
jj log -r 'agent_a_work()'                                   # see agent-a's commits
jj diff -r '<agent-a-head-change-id>'                        # inspect the final diff
jj show <agent-a-head-change-id>                             # commit description + diff
```

### Cherry-pick a specific commit

```console
jj duplicate <agent-a-change-id> --destination @             # copy the commit onto @
```

### Squash an agent's work into a feature branch

```console
jj squash --from '<agent-a-change-id>::<agent-a-head>' \
  --into <feature-tip> -m "feat: X (from agent-a)"
```

Moves everything from agent-a's base up through its head into the feature branch.

### Rebase an agent's branch onto updated trunk

```console
jj rebase -s <agent-a-base> -d main
```

Moves agent-a's whole branch onto the current main. Conflicts may result; resolve in agent-a's
workspace (or the orchestrator — either works, since the commits are shared).

### Pull changes from multiple agents into one integration commit

Use a megamerge (see `workflows/megamerges.md`):

```console
jj new main <agent-a-head> <agent-b-head> <agent-c-head> -m "megamerge: integrate agents"
```

Now `@` sees all three agents' work combined. Run tests; distribute integrated changes back via
`jj absorb` or manual squashes.

---

## 6. Curation pattern — cleaning an agent's messy iteration

Agents produce messy commit sequences. The canonical cleanup pattern (performed by an
orchestrator, not the messy agent):

```console
# Create a fresh commit where the cleaned version will live
jj new <agent-base> -m "feat: clean final version"

# Pull specific files from the agent's messy commit into the clean one
jj squash --from <agent-change-id> --into @ path/to/foo.ts path/to/bar.ts

# Drop what's left (the unwanted changes)
jj abandon <agent-change-id>
```

This is the jj equivalent of `git add -p` but done *after the fact* — crucial because agents
don't know what "staged" means. Use file paths with `jj squash --from ... --into ...` for
non-interactive, explicit placement. The interactive `jj squash -i --from <agent-change-id>`
variant works for human drivers but hangs for agent drivers; prefer the file-path form.

### Scaling this pattern

For an agent that produced many small commits:

```console
# Create a fresh commit where the cleaned version will live
jj new <agent-base> -m "feat: clean final version"

# Pull specific files from each agent commit in turn
jj squash --from <agent-commit-1> --into @ path/to/foo.ts
jj squash --from <agent-commit-2> --into @ path/to/bar.ts
# ...etc

# Or simpler: consolidate first, then let absorb distribute:
jj squash --from '<agent-base>::<agent-head>' --into @
# Now @ contains all the agent's changes
jj absorb            # distribute hunks into nearest ancestor commits
jj diff              # see what's left; place remaining hunks with file-path squash
```

The interactive forms (`jj squash -i`, `jj split -i`) are fine for human drivers but hang for
agent drivers; prefer the file-path form for non-interactive placement.

---

## 7. Safety rails for parallel agents

### Checkpoint before dispatching

Before spawning agents:

```console
CHECKPOINT=$(jj op log --limit 1 -T 'self.id()')
echo "Checkpoint: $CHECKPOINT"
```

Record this. If agent session turns chaotic, `jj op restore $CHECKPOINT` rewinds the repo to the
pre-dispatch state. Individual workspaces reconcile via `jj workspace update-stale`.

### Monitor via op log

While agents work, the orchestrator can `jj op log --limit 20` to see every operation across all
workspaces. 0.40.0+ annotates ops with the workspace name for at-a-glance attribution.

### Private-commits enforcement

As above:

```toml
[git]
private-commits = "description(glob:'wip[*]:*')"
```

Prevents pushes of scratch work. Complements code-review gates.

### Explicit verification gate

Before merging an agent's work back, run:

```console
jj diff -r <agent-head>                    # inspect diff
jj log -r '<agent-base>..<agent-head>'     # review commit sequence
# Then run the project's verify script:
./verify.sh                                # lint + typecheck + tests
```

Only if verification passes, integrate. This is the "relentless verification" half of the
agent-driven-development pattern.

### Never `rm -rf .jj`

Universal rule; doubly critical when multiple workspaces share one `.jj/`. Losing it strands
every workspace simultaneously.

---

## 8. Anti-patterns

- **Shared working copy across agents.** Agents collide on `@`. Use workspaces.
- **Agents reading each other's working copies directly.** Use `jj log -r '<workspace>@'` or
  coordinate via committed changes. Filesystem snooping creates race conditions.
- **Agents pushing directly to shared remotes.** Gate pushes through an orchestrator or code
  review — agents shouldn't push unsupervised.
- **Relying on an agent to `jj absorb` at session end.** The orchestrator does cleanup; the
  agent does the work. Don't give cleanup authority to the agents that produced the mess.
- **Skipping the checkpoint.** An op ID before dispatch costs nothing and saves sessions.

---

## Reference: minimal orchestrator script pattern

Sketch of what an orchestrator script does (in pseudocode; adapt to your tooling):

```bash
#!/bin/bash

# 1. Checkpoint
CHECKPOINT=$(jj op log --limit 1 -T 'self.id()')

# 2. Set up workspaces (if not already done)
for i in 1 2 3; do
    [ -d ../proj-agent-$i ] || jj workspace add ../proj-agent-$i --rev main
done

# 3. Dispatch agents (each agent runs in its workspace)
cd ../proj-agent-1 && run-agent "task A" &
cd ../proj-agent-2 && run-agent "task B" &
cd ../proj-agent-3 && run-agent "task C" &
wait

# 4. Merge agent results back
cd ../proj-main
for i in 1 2 3; do
    agent_head=$(jj log -r "agent-$i@" --no-graph -T 'change_id')
    jj diff -r "$agent_head"
    ./verify.sh --rev "$agent_head" && \
        jj squash --from "$agent_head" --into feat/integrated -m "feat: task from agent-$i"
done

# 5. Report
jj log -r 'main@origin..visible_heads()'
echo "Checkpoint was: $CHECKPOINT — run 'jj op restore $CHECKPOINT' to rewind"
```

This is illustrative; real orchestrators will be more sophisticated. The shape is: checkpoint,
dispatch, verify each agent's output independently, merge back, report.
