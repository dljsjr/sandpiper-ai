# jj ↔ Git Interop and PR/MR Workflows

This reference covers working with Git upstreams — the common case for open-source work and for
most teams that use GitHub, GitLab, or similar Git-based forges. It also includes the cheat sheet
for running `git` commands inside a jj repo, and notes on deprecated-config migrations you may
encounter in older setups.

Load this reference when:

- Setting up jj against a Git upstream (clone, fork→upstream, multiple remotes)
- Pushing to or fetching from remotes
- Working with PRs or MRs (rewriting commits, stacking, review iteration)
- Diagnosing push failures (lease checks, private-commits, conflicted bookmarks)
- Running `git` commands inside a colocated jj repo

Topics:

1. Colocated repos and where jj state lives
2. Fetch and push fundamentals
3. Push safety — force-with-lease, lease checks, conflicted bookmarks
4. Private commits — preventing accidental pushes
5. Multiple remotes (fork → upstream)
6. Push options (GitLab CI, MR creation, etc.)
7. End-to-end PR flow — rewriting vs stacking
8. Bookmark name generation (`templates.git_push_bookmark`)
9. `git` command cheat sheet for colocated repos
10. Deprecated-config migrations

---

## 1. Colocated repos and where jj state lives

jj stores everything except the object store in `.jj/`; the Git backend stores commits in `.git/`.

**Colocated** (default, recommended): `.jj/` and `.git/` sit side by side. Git tools, IDEs, and CI
see a normal Git repo and work unmodified. jj auto-runs `git import` / `git export` before and
after its own commands, so any changes made via `git` directly are picked up by jj.

**Non-colocated:** the Git repo is hidden inside `.jj/git`. Git tools don't work from the working
copy. Useful in rare cases; avoid unless there's a specific reason.

Setup idioms:

```console
jj git init myproject                       # new repo, colocated by default
jj git clone git@github.com:user/repo.git   # clone, colocated by default
cd existing-git-repo
jj git init --colocate                      # add jj to an existing Git repo
```

Once colocated, Git commands (`git log`, `git diff`, `git status`) work as read-only introspection
without causing jj any trouble. Writing Git commands (`git commit`, `git rebase`, `git reset`) can
create bookmark conflicts that jj will surface on the next command — prefer the jj equivalents for
mutations.

---

## 2. Fetch and push fundamentals

### Fetch

```console
jj git fetch                           # fetch tracked bookmarks from origin (or configured default)
jj git fetch --all-remotes             # fetch from every configured remote
jj git fetch --remote upstream         # fetch from a specific remote
jj git fetch -b 'glob:release/*'       # fetch bookmarks matching a glob (repeatable)
jj git fetch --tracked                 # fetch only already-tracked bookmarks
```

Fetch brings remote bookmarks up to date (e.g., `main@origin`). Local bookmarks are not modified
unless they track a remote that moved (see "Push safety" below).

### Push

```console
jj git push -b <bookmark>              # push one bookmark (lease-checked)
jj git push -c @                       # auto-create a bookmark from @'s change ID and push
jj git push -c @-                      # common idiom: WC is empty, push the described parent
jj git push --all                      # push every local bookmark
jj git push -r <revset>                # push bookmarks pointing at revisions in <revset>
jj git push --dry-run                  # preview only
```

**The `-c` form** is the most common for agent workflows: it names the remote bookmark from the
change ID, avoiding the need to think about bookmark names. `@-` is used when the working copy is
empty (the canonical jj habit — `@` is scratch, `@-` is the real commit).

### Push options (0.39.0+)

`-o <option>` / `--option <option>` forwards a server-side push option. Repeatable.

GitLab examples:

```console
jj git push -o ci.skip
jj git push -o 'ci.variable=MAX_RETRIES=10' -o 'ci.variable=MAX_TIME=600'

# Create an MR on push:
jj git push --allow-new \
  -o merge_request.create \
  -o merge_request.target=main \
  -o 'merge_request.title=Add feature X' \
  -o 'merge_request.description=Implements X with tests' \
  -o merge_request.draft
```

GitHub does not meaningfully support push options; this is primarily a GitLab feature.

---

## 3. Push safety — force-with-lease, lease checks, conflicted bookmarks

`jj git push` is lease-checked by default — similar in spirit to `git push --force-with-lease`,
but stronger:

Before moving, creating, or deleting a remote bookmark, `jj git push` contacts the remote and
verifies the actual state matches jj's record of its last known position. On mismatch, jj refuses
to push.

**Why it's stronger than Git's `--force-with-lease`:** Git's lease check has a race where the
remote ref becomes "known" at fetch time, so a fetch-then-push immediately after an upstream move
can still clobber. jj's equivalent produces a *bookmark conflict* on the next `jj git fetch`,
which must be resolved before another push can succeed.

### When a push refuses with a bookmark conflict

Symptom: `jj git push` reports the local bookmark is conflicted.

Cause: the remote bookmark moved (someone else pushed) since the last local fetch. jj detected the
divergence and marked the local bookmark as conflicted — the local commit it points to and the
remote commit it tracks are in conflict.

Resolution:

```console
jj git fetch                           # pull the remote changes
jj log -r 'bookmarks()'                # inspect the conflicted bookmark(s)
jj rebase -b <local-bookmark> -d <remote-bookmark>   # rebase local onto remote
jj bookmark set <local-bookmark> -r @  # move local bookmark to the rebased tip (or new appropriate rev)
jj git push -b <local-bookmark>        # try again
```

This workflow is the jj equivalent of the Git dance `git fetch && git rebase origin/branch && git
push`. The jj version is safer because the bookmark-conflict state is explicit and blocks until
resolved.

### Intentionally rewriting published commits

If you *want* to rewrite a remote-visible commit (e.g., amending a PR in response to review):

```console
jj edit <change-id>                    # jump into the commit
# ...make fixes...
jj git push -b <bookmark>              # jj force-pushes with lease
```

This is standard and safe — the lease check prevents clobbering if someone else pushed to the
same bookmark in the meantime.

### What you cannot push

- **Commits with conflicts:** refused. Resolve first.
- **Commits matching `git.private-commits`:** refused. See section 4.
- **Descendants of private commits:** refused (pushing them would require pushing the private
  parent).
- **Already-on-remote commits** marked private: not considered private for push purposes (jj
  treats anything already on the remote as non-private regardless of config).

---

## 4. Private commits — preventing accidental pushes

The single most useful safety knob for agent workflows. `git.private-commits` accepts a revset;
any matching commit (and its descendants) is refused by `jj git push`.

Canonical patterns:

```toml
[git]
# Prevent pushing anything labeled wip or private
private-commits = "description('wip:*') | description('private:*')"
```

For megamerge users:

```toml
[git]
# Prevent pushing the megamerge commit itself
private-commits = 'description(exact:"megamerge")'
```

For agents specifically, wrap scratch work with a description prefix:

```console
jj commit -m "wip: exploring fix for X"
```

Then `private-commits = "description('wip:*')"` blocks accidental pushes.

### Semantics recap

- Matching commits are refused by `jj git push`.
- Matching commits' descendants are also refused (pushing the descendant would require pushing
  the parent).
- A commit already on the remote is not considered private, regardless of the config.
- Immutable commits are excluded from the private set automatically.

---

## 5. Multiple remotes (fork → upstream)

Common pattern: fork a project on GitHub, clone your fork, keep upstream as a second remote for
fetching.

```console
# Option A: clone directly from upstream, add fork as push remote
jj git clone --remote upstream https://github.com/upstream-org/repo
cd repo
jj git remote add origin git@github.com:your-org/your-repo-fork

# Option B: clone your fork, add upstream as fetch-only remote
jj git clone git@github.com:your-org/your-repo-fork
cd your-repo-fork
jj git remote add upstream https://github.com/upstream-org/repo
jj git fetch --remote upstream
```

### Configuring default fetch/push

```toml
[git]
fetch = ["upstream", "origin"]     # fetch from both by default
push = "origin"                    # always push to origin (the fork)
```

`git.fetch` accepts a list or a pattern (`glob:`, `regex:`). `git.push` is currently a single
remote — the docs note this as a limitation, not a fundamental one.

### Useful aliases for fork workflow

```toml
[aliases]
sync = ["git", "fetch", "--remote", "upstream"]
```

Then `jj sync` pulls upstream changes. Follow with `jj rebase -b @ -d upstream-main` to rebase
local work onto the new upstream tip.

---

## 6. End-to-end PR flow

Two styles, pick based on project convention.

### Rewriting commits (jj-native projects, LLVM, most jj contributors)

The reviewer leaves feedback; you amend the relevant commit rather than adding a fixup.

```console
jj new main
jj commit -m "feat: add widget"
jj git push -c @-                           # creates push-<changeid> bookmark, pushes

# --- PR review comes back ---
# Reviewer asks for a fix in the commit
jj new your-feature-                        # trailing hyphen = parent of `your-feature` bookmark
# ...make fixes...
jj squash                                   # fold into the parent (the original feature commit)
jj git push -b your-feature                 # force-push with lease
```

**Note:** Replace `your-feature` with the actual bookmark name. If you used `jj git push -c @-`,
the bookmark is `push-<changeid>`; use `jj bookmark list` to find it.

### Stacking commits (Git-native projects)

Add a "address review comments" commit on top instead of rewriting.

```console
jj new your-feature
# ...make fixes...
jj commit -m "address PR comments"
jj bookmark move your-feature --to @-       # advance bookmark to the new tip
jj git push
```

### Multi-commit feature

```console
jj new main
jj commit -m "refactor(foo): extract helper"
jj commit -m "feat(bar): add bar depending on foo"
jj git push -c @-                            # auto-creates bookmark push-<changeid>
```

The `@-` is because the working copy is empty after the last `jj commit` — the canonical idiom.

### Addressing review by stacking up changes locally, flattening at push

```console
# Make exploratory fixes in several small commits
jj new your-feature -m "fix: review item 1"
jj new -m "fix: review item 2"
jj new -m "fix: review item 3"

# Before pushing, consolidate
jj squash --from 'your-feature+..@' --into your-feature -m "feat: add widget (with review fixes)"
jj git push -b your-feature
```

---

## 7. Bookmark name generation

`jj git push -c <revset>` creates a remote bookmark per matching commit, using the
`templates.git_push_bookmark` template. The default produces `push-<changeid-short>`:

```toml
[templates]
git_push_bookmark = '"push-" ++ change_id.short()'
```

Customize with your initials, team prefix, etc.:

```toml
[templates]
git_push_bookmark = '"yourname/push-" ++ change_id.short()'
```

**Note:** the older `git.push-bookmark-prefix` config key was deprecated in 0.32.0 and removed in
0.37.0. If you see it in old configs, migrate to `templates.git_push_bookmark`.

---

## 8. `git` command cheat sheet for colocated repos

In a colocated repo, `git` commands work alongside jj. Use these freely for read-only
introspection; prefer jj for mutations.

| Task | Safe `git` equivalent | jj equivalent |
|---|---|---|
| View log | `git log` | `jj log` |
| View diff | `git diff` | `jj diff` |
| View file history | `git log -p <file>` | `jj log -p -r '...' <file>` |
| Blame a file | `git blame <file>` | `jj file annotate <file>` |
| Show a commit | `git show <sha>` | `jj show <change-id-or-sha>` |
| List branches | `git branch -a` | `jj bookmark list --all-remotes` |
| Inspect refs | `git show-ref` | `jj bookmark list -t` |
| GitHub CLI, etc. | `gh pr view`, etc. | n/a — use `gh` directly |

### Things you should *not* do with `git` in a colocated repo

- `git commit` — jj's snapshot model will pick it up, but you bypass the change-ID tracking. Prefer
  `jj commit -m "msg"`.
- `git reset --hard` — can leave jj's view out of sync. Prefer `jj undo` or `jj op restore`.
- `git rebase` — works but creates bookmark conflicts jj will complain about. Prefer `jj rebase`.
- `git checkout <branch>` — similarly creates bookmark movement jj didn't authorize. Prefer
  `jj edit <change-id>` or `jj new <bookmark>`.

### Things that are fine

- `gh pr create`, `gh pr view`, etc. — GitHub CLI operates against `.git/` and doesn't interact
  with jj state.
- `git fetch` in a pinch — jj will see the remote updates on its next command.
- `git diff`, `git show`, `git log` — pure reads, no state mutation.

---

## 9. Deprecated-config migrations

Configs you may encounter in old sources that need updating:

### `git.push-bookmark-prefix` → `templates.git_push_bookmark`

Deprecated 0.32.0, removed 0.37.0. Migration:

```toml
# Old
[git]
push-bookmark-prefix = "yourname/push-"

# New
[templates]
git_push_bookmark = '"yourname/push-" ++ change_id.short()'
```

### `git.push-new-bookmarks = true` → `remotes.<name>.auto-track-bookmarks`

Deprecated 0.36.0 in favor of per-remote auto-tracking. Migration:

```toml
# Old
[git]
push-new-bookmarks = true

# New
[remotes.origin]
auto-track-bookmarks = "glob:*"
```

Or the 0.38.0+ refinement that only auto-tracks locally-created bookmarks:

```toml
[remotes.origin]
auto-track-created-bookmarks = true
```

### `.jj/repo/config.toml` → `jj config edit --repo`

As of 0.38.0, per-repo and per-workspace config moved outside the repo. Writing to
`.jj/repo/config.toml` or `.jj/workspace-config.toml` still works (auto-migrated on read), but
new config should go via `jj config edit --repo` / `jj config edit --workspace`. Location is
discoverable via `jj config path --repo` / `--workspace`.

---

## 10. End-to-end setup for a new contributor workflow

A template for getting from clone to first PR:

```console
# Clone, set up fork
jj git clone git@github.com:upstream/project
cd project
jj git remote add fork git@github.com:you/project

# Configure
cat > .jj/repo/config.toml <<'EOF'
[git]
fetch = ["origin", "fork"]
push = "fork"
private-commits = "description('wip:*')"

[templates]
git_push_bookmark = '"yourname/push-" ++ change_id.short()'

[revset-aliases]
'immutable_heads()' = "builtin_immutable_heads() | remote_bookmarks()"
EOF

# First feature
jj new origin/main
jj commit -m "feat: add widget"
jj git push -c @-          # creates yourname/push-<changeid>, pushes to fork
```

Adjust config paths for the 0.38.0+ location if needed (use `jj config edit --repo` to be safe).

With this setup:

- `private-commits` blocks pushing anything wip-labeled.
- Custom `immutable_heads()` prevents rewriting any pushed commit (including in `fork`).
- `git_push_bookmark` gives generated bookmarks a distinctive prefix.
- Push defaults to `fork`, fetch covers both `origin` and `fork`.
