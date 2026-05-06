# jj Configuration Reference

Load this reference when editing jj config — user, repo, or workspace scope. Covers config
locations, the most useful knobs, and patterns that pay off for agent work.

For PR/MR-specific config (push bookmarks, remotes, auto-tracking), see
`references/git-interop.md`. For template language (used in several config keys), see
`references/templates.md`.

Topics:

1. Config file locations and precedence
2. `jj config` command
3. Essential knobs (`[user]`, `[ui]`)
4. Revset aliases and overrides
5. Template-backed config
6. Safety rails — private commits, immutable heads
7. Snapshot behavior
8. Aliases
9. Full example config

---

## 1. Config file locations and precedence

From lowest to highest precedence (later overrides earlier):

1. **Built-in defaults** — what jj ships with
2. **User config** — `~/.config/jj/config.toml` (or `$XDG_CONFIG_HOME/jj/config.toml`)
3. **Repo config** — managed via `jj config edit --repo`. As of 0.38.0, this no longer lives at
   `.jj/repo/config.toml` (though the old path is auto-migrated); use `jj config path --repo` to
   find the current location.
4. **Workspace config** — similarly, managed via `jj config edit --workspace`; path via
   `jj config path --workspace`.
5. **`--config NAME=VALUE`** — per-command override, repeatable on the CLI.
6. **`--config-file PATH`** — per-command override via file, repeatable.

### Finding paths

```console
jj config path --user
jj config path --repo
jj config path --workspace
```

### Inspecting config with overrides

```console
jj config list                              # effective config
jj config list --include-defaults           # include everything jj ships with
jj config list --include-overridden         # show shadowed values (diagnose override issues)
jj config list <key>                        # one specific key
```

`jj config list --include-defaults --include-overridden` is the canonical one-liner for
auditing effective configuration — it shows every effective value plus anything shadowed by
a higher-precedence source.

---

## 2. The `jj config` command

```console
jj config edit --user                       # open user config in editor
jj config edit --repo                       # open repo config
jj config edit --workspace                  # open workspace config

jj config set --user <key> <value>          # set one key
jj config set --repo <key> <value>
jj config set --workspace <key> <value>

jj config unset --user <key>                # remove a key
```

`jj config set` is idempotent and doesn't open an editor — ideal for automation and agent use.

---

## 3. Essential knobs

### `[user]`

```toml
[user]
name = "Your Name"
email = "you@example.com"
```

Required for any commits. jj refuses to commit without these set.

### `[ui]`

```toml
[ui]
editor = "nvim"                             # Or "code -w", "vim", "hx", "micro"
diff-formatter = ":color-words"             # :color-words | :git | :summary | :stat | external tool
merge-editor = "meld"                       # Or "kdiff3", ":builtin", "vimdiff"
default-command = ["log"]                   # what `jj` with no args does
pager = "less -FRX"
graph.style = "curved"                      # curved | square | ascii
conflict-marker-style = "diff"              # diff (recommended) | snapshot | git
```

`conflict-marker-style = "diff"` (the default) produces the `%%%%%%% diff` format that jj's
conflicts skill documents. `snapshot` gives both sides as full content (easier for simple
3-way merges, clunkier for additive diffs). `git` produces Git-compatible `<<< === >>>` markers.

`default-command = ["log"]` means `jj` with no args runs `jj log`. Useful.

### `[git]`

Git interop — see `references/git-interop.md` for the full breakdown. Most essential:

```toml
[git]
fetch = ["origin"]                          # default remote for fetch (list or string pattern)
push = "origin"                             # default remote for push (single remote)
private-commits = "description(glob:'wip:*')"
```

---

## 4. Revset aliases and overrides

The `revset-aliases` section lets you name any revset expression, and override built-ins like
`trunk()`, `mine()`, `immutable_heads()`.

### Built-in revset aliases worth overriding

```toml
[revset-aliases]
# Anything on a tracked remote bookmark is immutable
# (prevents accidental rewrite of pushed work)
'immutable_heads()' = "builtin_immutable_heads() | remote_bookmarks()"

# Override trunk to match a non-standard name
'trunk()' = 'bookmarks("main") | bookmarks("master") | bookmarks("dev")'
```

### Useful custom aliases

```toml
[revset-aliases]
# Nearest-bookmark-before for tug-style bookmark advancement
'closest_bookmark(to)' = 'heads(::to & bookmarks())'

# Closest commit suitable for push-bookmark-advance
'closest_pushable(to)' = '''
  heads(::to & mutable() & ~description(exact:"") & (~empty() | merges()))
'''

# Closest merge ancestor — useful for megamerge operations
'closest_merge(to)' = 'heads(::to & merges())'
```

Apply:

```toml
[revsets]
bookmark-advance-to = "closest_pushable(@)"
```

### `[revsets]` section — default revsets for commands

```toml
[revsets]
log = "present(@) | ancestors(immutable_heads().., 2) | trunk()"
short-prefixes = "(main..@)::"              # shorter change-ID prefixes for active work
bookmark-advance-from = 'heads(::to & bookmarks())'
bookmark-advance-to = '@'
op-diff-changes-in = "mutable() | immutable_heads()"   # 0.40.0+
```

`log` controls what `jj log` shows by default. `short-prefixes` makes change-ID prefixes shorter
for the revsets you care about (active work), longer for everything else.

---

## 5. Template-backed config

Several config keys accept jj's template language (documented in `references/templates.md`).

### `git_push_bookmark`

Controls the name generated by `jj git push -c <rev>`. Default: `"push-" ++ change_id.short()`.

```toml
[templates]
git_push_bookmark = '"yourname/push-" ++ change_id.short()'
```

### `new_description` (0.39.0+)

Template evaluated by `jj new` when no `-m` is given. Useful for auto-generated merge
descriptions.

```toml
[templates]
new_description = '''
  if(parents.len() >= 2,
    "merge " ++ parents.map(|p| p.change_id().short()).join(" + "),
    ""
  )
'''
```

### `log` and `log_graph`

Full customization of `jj log` output format.

```toml
[templates]
log = '''
  change_id.shortest() ++ " " ++
  if(conflict, label("conflict", "⚠"), " ") ++ " " ++
  description.first_line() ++ "\n"
'''
```

---

## 6. Safety rails — private commits, immutable heads

Described above; worth restating because of how useful they are for agents.

```toml
[git]
# Block pushes of WIP and explicitly-private work
private-commits = "description(glob:'wip:*') | description(glob:'private:*')"

[revset-aliases]
# Anything on a remote is immutable (extension over builtin)
'immutable_heads()' = "builtin_immutable_heads() | remote_bookmarks()"
```

These two together cover:

- Pushing scratch work accidentally: blocked by `private-commits`.
- Rewriting pushed work accidentally: blocked by `immutable_heads()` (unless `--ignore-immutable`
  is explicit).

---

## 7. Snapshot behavior

```toml
[snapshot]
auto-track = "all()"                         # snapshot all files automatically
# auto-track = "none()"                      # explicit tracking only (rare)
max-new-file-size = "1MiB"                   # refuse to snapshot files bigger than this
```

`auto-track = "all()"` is the default and the right setting for most projects. Explicit tracking
(`"none()"`) is useful only in specific cases — for example, huge non-code files that should be
excluded from jj snapshots.

`max-new-file-size` prevents an accidentally-committed large binary from bloating the repo. Keep
the default unless there is a specific reason to raise it (committing large binary artifacts
intentionally, for example).

---

## 8. Aliases

jj aliases are commands composed of other jj commands. Two kinds:

### Simple aliases

```toml
[aliases]
l = ["log"]
d = ["diff"]
s = ["status"]
pc = ["git", "push", "-c", "@"]
fa = ["git", "fetch", "--all-remotes"]
sync = ["git", "fetch", "--remote", "upstream"]
```

Invoked as `jj l`, `jj pc`, etc.

### Complex aliases (for megamerge / parallel-agent patterns)

A working set of aliases for megamerge-style workflows (see `references/workflows/megamerges.md`
for context):

```toml
[aliases]
# Insert a revset as a new parent under the megamerge
stack = ["rebase", "--after", "trunk()", "--before", "closest_merge(@)", "--revision"]

# Dump everything descended from the megamerge into it
stage = ["stack", "closest_merge(@)+:: ~ empty()"]

# Rebase only the commits you own onto trunk()
restack = ["rebase", "--onto", "trunk()", "--source",
           "roots(trunk()..) & mutable()", "--simplify-parents"]
```

These require the supporting `revset-aliases` (see section 4).

### `tug` (pre-0.39.0 users)

For users on older jj without `jj bookmark advance`:

```toml
[revset-aliases]
'closest_bookmark(to)' = 'heads(::to & bookmarks())'

[aliases]
tug = ["bookmark", "move", "--from", "closest_bookmark(@-)", "--to", "@-"]
```

`jj tug` moves the nearest bookmark forward. On 0.39.0+, use `jj bookmark advance` instead.

---

## 9. Full example config

Putting it all together — a reasonable starting config for a developer working with jj against
Git upstreams, with agent-friendly safety rails:

```toml
[user]
name = "Your Name"
email = "you@example.com"

[ui]
editor = "nvim"
diff-formatter = ":color-words"
merge-editor = ":builtin"
default-command = ["log"]
pager = "less -FRX"
graph.style = "curved"
conflict-marker-style = "diff"

[git]
fetch = ["origin"]
push = "origin"
private-commits = "description(glob:'wip:*') | description(glob:'private:*')"

[revsets]
log = "present(@) | ancestors(immutable_heads().., 2) | trunk()"
short-prefixes = "(main..@)::"
bookmark-advance-to = "closest_pushable(@)"

[revset-aliases]
'immutable_heads()' = "builtin_immutable_heads() | remote_bookmarks()"
'closest_bookmark(to)' = 'heads(::to & bookmarks())'
'closest_pushable(to)' = '''
  heads(::to & mutable() & ~description(exact:"") & (~empty() | merges()))
'''
'closest_merge(to)' = 'heads(::to & merges())'

[templates]
git_push_bookmark = '"yourname/push-" ++ change_id.short()'

[snapshot]
auto-track = "all()"

[aliases]
l = ["log"]
d = ["diff"]
s = ["status"]
pc = ["git", "push", "-c", "@"]
pca = ["git", "push", "-c", "@-"]           # when @ is empty; push described parent
sync = ["git", "fetch", "--all-remotes"]

# Megamerge helpers
stack = ["rebase", "--after", "trunk()", "--before", "closest_merge(@)", "--revision"]
stage = ["stack", "closest_merge(@)+:: ~ empty()"]
restack = ["rebase", "--onto", "trunk()", "--source",
           "roots(trunk()..) & mutable()", "--simplify-parents"]
```

---

## Quick reference — the 10 config knobs worth knowing

1. `[user]` — required for commits
2. `ui.editor`, `ui.diff-formatter`, `ui.merge-editor` — tooling hooks
3. `ui.default-command` — what bare `jj` does
4. `ui.conflict-marker-style` — keep the default `diff` (unambiguous for programmatic resolution)
5. `git.fetch`, `git.push` — which remotes for which operations
6. `git.private-commits` — block pushes of WIP
7. `revsets.log` — default `jj log` output
8. `revsets.short-prefixes` — shorter change-ID display for active work
9. `revset-aliases.immutable_heads()` — protect pushed work from rewrite
10. `templates.git_push_bookmark` — bookmark name for `jj git push -c`
