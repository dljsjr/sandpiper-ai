# jj Template Language

Load this reference when customizing `jj log` / `show` output, writing a script that needs
structured jj output, or setting template-backed config (`templates.git_push_bookmark`,
`templates.log`, `templates.new_description`).

The template language is jj's stable CLI contract for structured data. Unlike parsing log output
with regex — which is brittle — templates produce exactly the fields requested, with predictable
formatting. This makes templates the right tool for any scripting or agent integration.

Topics:

1. Overview
2. Where templates are used
3. Common template patterns
4. Key properties and functions
5. Conditionals and formatting
6. Methods on each object type
7. Example templates
8. Configuring templates

---

## 1. Overview

A template is an expression that, evaluated against a context (a commit, an operation, a
bookmark), produces a string. Templates can include:

- **Property access** — `commit.description`, `commit.change_id`
- **Methods** — `change_id.short()`, `description.first_line()`
- **String concatenation** — `a ++ b`
- **Conditionals** — `if(<pred>, <then>, <else>)`
- **Labels** for colorization — `label("error", "...")`
- **Maps and joins** — `parents.map(|p| p.change_id().short()).join(", ")`

Templates live in one of two places:

1. **`-T <template>`** on the command line: `jj log -T '<template-text>'`
2. **`[templates]` config section**: `templates.log = "..."`

---

## 2. Where templates are used

### Commands with `-T / --template`

- `jj log -T <tmpl>` — format each revision in the log
- `jj show -T <tmpl>` — format a single revision
- `jj bookmark list -T <tmpl>` — format each bookmark
- `jj op log -T <tmpl>` — format each operation
- `jj evolog -T <tmpl>` — format evolution history
- `jj file list -T <tmpl>` — format file listings

### Config-based templates

- `templates.log` — default `jj log` output
- `templates.log_graph` — `jj log` with `--graph` (rarely customized)
- `templates.commit_summary` — the short summary used in various places
- `templates.git_push_bookmark` — name of bookmark created by `jj git push -c`
- `templates.new_description` (0.39.0+) — default description for `jj new` without `-m`
- `templates.op_log` — default `jj op log` output

---

## 3. Common template patterns

### Change ID only

```console
jj log --limit 1 -T 'self.change_id() ++ "\n"'
# qzmzpxyl
```

### Change ID + description first line

```console
jj log --limit 10 -T 'change_id.shortest() ++ " " ++ description.first_line() ++ "\n"'
# qzmzp feat: add widget
# rlvwt fix: widget bug
```

### Conditional conflict indicator

```console
jj log --limit 10 -T '''
  if(conflict, label("conflict", "⚠ "), "  ") ++
  change_id.shortest() ++ " " ++
  description.first_line() ++ "\n"
'''
```

### Operation ID for checkpoints

```console
jj op log --limit 1 -T 'self.id() ++ "\n"'
# d6255cf66413
```

### Custom git_push_bookmark

```toml
[templates]
git_push_bookmark = '"yourname/push-" ++ change_id.short()'
```

---

## 4. Key properties and functions

### On a commit (context for `jj log`, `jj show`, etc.)

| Property | Type | Meaning |
|---|---|---|
| `self` | commit | the commit itself (aliases for the context) |
| `commit_id` | commit-id | the Git SHA |
| `change_id` | change-id | the stable change ID |
| `description` | string | the commit message |
| `author` | signature | author name / email / timestamp |
| `committer` | signature | committer name / email / timestamp |
| `parents` | list<commit> | parent commits (1+ for merges) |
| `mine` | boolean | authored by the configured user |
| `conflict` | boolean | has conflict markers |
| `empty` | boolean | has no file changes vs parent(s) |
| `immutable` | boolean | in the immutable set |
| `bookmarks` | list<bookmark> | bookmarks pointing at this commit |
| `tags` | list<tag> | Git tags at this commit |

### On an operation (context for `jj op log`)

| Property | Type | Meaning |
|---|---|---|
| `self` | operation | the operation itself |
| `id` | op-id | the operation ID |
| `description` | string | the command description |
| `tags` | map | metadata (e.g. workspace name, from 0.40.0+) |
| `time` | signature | when the operation ran |

### On a bookmark

| Property | Type | Meaning |
|---|---|---|
| `name` | string | bookmark name |
| `present` | boolean | exists locally |
| `conflict` | boolean | has a conflict state |
| `normal_target` | commit | current target, if non-conflicted |

### On a string

| Method | Returns | Meaning |
|---|---|---|
| `.first_line()` | string | text before the first newline |
| `.short(N)` | string | first N characters |
| `.upper()`, `.lower()` | string | case change |
| `.starts_with(s)` | boolean | prefix check |
| `.contains(s)` | boolean | substring check |
| `.substr(start, end)` | string | substring (0.40.0+: end is optional) |

### On a change-id / commit-id

| Method | Returns | Meaning |
|---|---|---|
| `.short(N)` | string | first N characters (default N = configured `short-prefixes`) |
| `.shortest()` | string | shortest unambiguous prefix |
| `.normal_hex()` | string | full hex representation |

### On a signature

| Property | Type | Meaning |
|---|---|---|
| `.name` | string | author/committer name |
| `.email` | string | email |
| `.username` | string | local-part of email |
| `.timestamp` | timestamp | when |

### On a list

| Method | Returns | Meaning |
|---|---|---|
| `.len()` | number | length |
| `.map(|x| <tmpl>)` | list | transform |
| `.filter(|x| <pred>)` | list | keep elements |
| `.join(sep)` | string | concatenate with separator |

---

## 5. Conditionals and formatting

### `if`

```
if(<predicate>, <then>)
if(<predicate>, <then>, <else>)
```

Example:

```
if(empty, "(empty) ", "") ++ description.first_line()
```

### `coalesce`

Returns the first non-empty value:

```
coalesce(description.first_line(), "(no description)")
```

### Labels for colorization

```
label("conflict", "⚠ conflict")
label("error", "oops")
```

Labels are defined in `colors` config:

```toml
[colors]
conflict = "red"
error = "bold red"
```

### String formatting and escapes

- `"\n"` — newline
- `"\t"` — tab
- `\"` — literal quote inside a string
- Concatenation with `++`
- No `printf`-style formatting; compose with concatenation and methods

---

## 6. Methods on each object type (expanded)

See jj's docs at `docs.jj-vcs.dev/latest/templates/` for the complete reference. The ones above
are the 80/20.

---

## 7. Example templates

### Minimal log

```console
jj log -T 'change_id.shortest() ++ " " ++ description.first_line() ++ "\n"'
```

### Log with conflict indicator and bookmarks

```console
jj log --limit 20 -T '''
  if(conflict, label("conflict", "⚠ ")) ++
  change_id.shortest() ++ " " ++
  if(bookmarks, bookmarks.map(|b| b.name()).join(",") ++ " ", "") ++
  description.first_line() ++ "\n"
'''
```

### Change IDs only (for piping to xargs)

```console
jj log -r 'conflicts()' --no-graph -T 'self.change_id() ++ "\n"'
```

### Op log with workspace annotation (0.40.0+)

```console
jj op log --limit 20 -T '''
  self.id().short() ++ " [" ++
  coalesce(self.tags["workspace"], "?") ++ "] " ++
  description ++ "\n"
'''
```

### Custom `git_push_bookmark`

```toml
[templates]
git_push_bookmark = '''
  "yourname/" ++
  if(description.first_line().starts_with("feat:"), "feat/", "") ++
  if(description.first_line().starts_with("fix:"), "fix/", "") ++
  "push-" ++ change_id.short()
'''
```

### `new_description` for merge commits

```toml
[templates]
new_description = '''
  if(parents.len() >= 2,
    "merge " ++ parents.map(|p| p.change_id().short()).join(" + "),
    ""
  )
'''
```

---

## 8. Configuring templates

### Inline `-T`

For one-off custom output:

```console
jj log -T '<template-expression>'
```

### Config templates

For default output of a command, set in config:

```toml
[templates]
log = '''
  if(current_working_copy, "@ ", "  ") ++
  change_id.shortest() ++ " " ++
  if(author.email == "you@example.com", label("mine", ""), "") ++
  description.first_line() ++ "\n"
'''
```

### Overriding per-command

Command-line `-T` always overrides config defaults.

---

## 9. Agent tip: templates as stable CLI contract

Templates are the stable contract for scripted jj integration. Human-readable output (`jj log`
without `-T`) is subject to UI polish and formatting changes; templates produce exactly the
fields requested in exactly the requested order.

**Pattern:** any agent-written script that needs to extract fields from jj should use `-T` with a
template targeting the exact fields needed, rather than parsing `jj log` human output with regex.

Example — getting a list of change IDs for all conflicted commits:

```console
jj log -r 'conflicts()' --no-graph -T 'self.change_id() ++ "\n"' | while read cid; do
    echo "Processing $cid"
done
```

Example — getting the op ID of the last mutation:

```console
LAST_OP=$(jj op log --limit 1 -T 'self.id()')
```

These constructions are forward-compatible across jj versions — the template language is stable
and changes very rarely, while the human-readable output format is subject to UI polish that can
break regex scraping.

---

## Quick reference — the templates worth memorizing

```console
# Change ID only, one per line:
jj log -r '<revset>' --no-graph -T 'self.change_id() ++ "\n"'

# Op ID only (for checkpoints):
jj op log --limit 1 -T 'self.id()'

# Log with conflict flag + first line of description:
jj log -T 'if(conflict, "⚠ ") ++ change_id.shortest() ++ " " ++ description.first_line() ++ "\n"'

# Commit ID (full SHA) for a specific rev:
jj log --no-graph -r <rev> -T 'commit_id ++ "\n"'

# Bookmarks at @:
jj log --no-graph -r '@' -T 'bookmarks.map(|b| b.name()).join(",") ++ "\n"'
```
