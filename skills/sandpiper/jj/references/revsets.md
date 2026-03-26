# jj Revset Language — Complete Reference

Revsets are a functional language for selecting sets of revisions, used with `-r` flags
throughout jj. This is an exhaustive reference.

## Table of Contents
- [Symbols](#symbols)
- [Operators](#operators)
- [Functions](#functions)
- [String Patterns](#string-patterns)
- [Date Patterns](#date-patterns)
- [Built-in Aliases](#built-in-aliases)
- [Practical Examples](#practical-examples)
- [Template Language](#template-language)

---

## Symbols

| Symbol | Meaning |
|--------|---------|
| `@` | Working-copy commit |
| `<workspace>@` | Working-copy commit in another workspace |
| `<name>@<remote>` | Remote-tracking bookmark/tag (e.g., `main@origin`) |
| `root()` | Virtual root commit (all-zeros ID) |
| Any commit ID prefix | Specific commit (hex digits 0-9, a-f) |
| Any change ID prefix | Visible commit(s) with that change ID (letters k-z) |
| `<change_id>/<offset>` | Specific version of divergent/hidden change (`/0` = latest) |

**Resolution priority:** Tag → Bookmark → Git ref → Commit/Change ID.

Override with explicit functions: `commit_id(abc)` or `bookmarks(exact:name)`.

Quote symbols that could be parsed as expressions: `"x-"` (so it's the literal string
`x-` rather than variable `x` with parent operator `-`).

---

## Operators

Ordered from strongest to weakest binding:

| Prec | Operator | Description | Example |
|------|----------|-------------|---------|
| 1 | `f(x)` | Function call | `heads(trunk()..@)` |
| 2 | `x-` | Parents of x | `@-` (parent of @) |
| 2 | `x+` | Children of x | `trunk()+` |
| 3 | `p:x` | String/date pattern prefix | `exact:"main"` |
| 4 | `::x` | Ancestors of x (inclusive) | `::@` |
| 4 | `x::` | Descendants of x (inclusive) | `trunk()::` |
| 4 | `x::y` | DAG range: descendants of x ∩ ancestors of y | `trunk()::@` |
| 4 | `x..y` | Range: ancestors of y minus ancestors of x | `trunk()..@` |
| 4 | `x..` | Not ancestors of x (equivalent to `~::x`) | `trunk()..` |
| 4 | `..x` | Ancestors of x excluding root | `..@` |
| 5 | `~x` | Complement (everything not in x) | `~immutable()` |
| 6 | `x & y` | Intersection | `mine() & trunk()..` |
| 6 | `x ~ y` | Difference (in x but not in y) | `trunk().. ~ empty()` |
| 7 | `x \| y` | Union | `bookmarks() \| tags()` |

**Key distinction: `..` vs `::`**
- `x..y` is like Git's `x..y` — ancestors of y that are NOT ancestors of x
- `x::y` is the DAG range — descendants of x that are also ancestors of y
- `::x` includes x itself and all ancestors
- `x..` means "everything NOT reachable from x" (complement of ancestors)

**Parent/child chaining:**
- `@-` = parent of @
- `@--` = grandparent of @
- `@---` = great-grandparent
- `@+` = children of @

---

## Functions

### Navigation

**`parents(x, [depth])`** — Parents at given depth. `parents(x)` ≡ `x-`. With depth,
returns ancestors at exactly that depth.

**`children(x, [depth])`** — Children at given depth. `children(x)` ≡ `x+`.

**`ancestors(x, [depth])`** — Ancestors with optional depth limit. `ancestors(x)` ≡ `::x`.
`ancestors(x, 3)` returns x and up to 3 generations of ancestors.

**`descendants(x, [depth])`** — Descendants with optional depth limit. `descendants(x)` ≡ `x::`.

**`first_parent(x, [depth])`** — Only the first parent (for merge commits, this follows
the mainline). Useful for traversing linear history through merges.

**`first_ancestors(x, [depth])`** — Traverse only first parents (mainline history).

### Graph Traversal

**`reachable(srcs, domain)`** — All commits reachable from srcs within domain, following
both parent AND child edges. Crucial for finding connected components.
Example: `reachable(@, mutable())` finds your entire working stack.

**`connected(x)`** — Same as `x::x`. Connects a potentially disconnected set via ancestry.

**`all()`** — All visible commits.

**`none()`** — Empty set.

### Topology

**`heads(x)`** — Commits in x with no descendants also in x. The "tips" of the set.

**`roots(x)`** — Commits in x with no ancestors also in x. The "bases" of the set.

**`fork_point(x)`** — Common ancestor(s) of all commits in x.

**`latest(x, [count])`** — Latest commits by committer timestamp. Default count: 1.

**`visible_heads()`** — All visible head commits in the repo.

### Refs

**`bookmarks([pattern])`** — Commits pointed to by local bookmarks matching pattern.

**`remote_bookmarks([name_pattern], [remote=pattern])`** — Remote bookmark targets.
Example: `remote_bookmarks(exact:"main", remote=exact:"origin")`

**`tracked_remote_bookmarks([name], [remote=pattern])`** — Only tracked remote bookmarks.

**`untracked_remote_bookmarks([name], [remote=pattern])`** — Only untracked remote bookmarks.

**`tags([pattern])`** — Tag targets.

**`remote_tags([name], [remote=pattern])`** — Remote tag targets.

### Content and Metadata Filtering

**`description(pattern)`** — Match against full commit description.

**`subject(pattern)`** — Match against first line of description only.

**`author(pattern)`** — Match against author name OR email.

**`author_name(pattern)`** / **`author_email(pattern)`** — Match specific author field.

**`author_date(pattern)`** — Filter by author date.

**`committer(pattern)`** / **`committer_name(pattern)`** / **`committer_email(pattern)`**
/ **`committer_date(pattern)`** — Same as author equivalents but for committer.

**`mine()`** — Author email matches configured `user.email`.

**`empty()`** — Commits with no file changes (tree matches parent).

**`merges()`** — Merge commits (two or more parents).

**`files(expression)`** — Commits that modify paths matching the fileset expression.
Example: `files("src/")`, `files(glob:"**/*.rs")`

**`diff_lines(text, [files])`** — Commits whose diffs contain text matching the pattern.
Searches actual diff content, not just file names.

**`conflicts()`** — Commits with unresolved conflicts.

**`divergent()`** — Divergent changes (same change ID, multiple visible commits).

**`signed()`** — Cryptographically signed commits.

### Utility Functions

**`present(x)`** — Same as x but returns `none()` if any referenced commits don't exist.
Useful in aliases that reference bookmarks that may not exist.

**`coalesce(revsets...)`** — Returns the first non-empty revset in the list.

**`working_copies()`** — Working-copy commits across all workspaces.

**`at_operation(op, x)`** — Evaluate revset x at a specific operation. Allows querying
historical repo states.

---

## String Patterns

Used in function arguments to match text. Default is `substring` for most functions,
`glob` for bookmark/tag functions.

| Pattern | Description | Example |
|---------|-------------|---------|
| `exact:"string"` | Exact match | `bookmarks(exact:"main")` |
| `glob:"pattern"` | Unix-style glob | `bookmarks(glob:"feature/*")` |
| `substring:"text"` | Substring match | `description(substring:"fix")` |
| `regex:"pattern"` | Regular expression | `description(regex:"fix.*bug")` |

**Case-insensitive:** Append `-i` to any pattern type:
- `glob-i:"Fix*"` — case-insensitive glob
- `substring-i:"error"` — case-insensitive substring
- `regex-i:"fix.*bug"` — case-insensitive regex

**Bare strings:** A bare unquoted string like `main` uses the default pattern type for
the function (usually `substring` for content functions, `glob` for ref functions).

---

## Date Patterns

Used with `author_date()` and `committer_date()`:

- `after:"2024-01-01"` — After a specific date
- `before:"2024-06-01"` — Before a specific date
- `after:"3 days ago"` — Relative dates work
- `before:"yesterday"` — Natural language dates

Combine with `&`:
```
author_date(after:"2024-01-01") & author_date(before:"2024-07-01")
```

---

## Built-in Aliases

These are defined by default and can be overridden in config:

**`trunk()`** — Head commit of the default bookmark (main/master/trunk) on the
upstream/origin remote. This is the "base" of your local work.

**`immutable_heads()`** — Default: `trunk() | tags() | untracked_remote_bookmarks()`.
Configurable via `revset-aliases."immutable_heads()"`.

**`immutable()`** — `::(immutable_heads() | root())`. All commits that should not
be rewritten. jj prevents rewriting these unless `--ignore-immutable` is used.

**`mutable()`** — `~immutable()`. All commits that can be freely rewritten.

**`builtin_immutable_heads()`** — The built-in default for `immutable_heads()`, available
even after overriding. Useful for extending: `immutable_heads() = "builtin_immutable_heads() | bookmarks(glob:'release/*')"`.

### Customizing immutability

```toml
[revset-aliases]
# Also protect release branches
"immutable_heads()" = "builtin_immutable_heads() | bookmarks(glob:'release/*')"

# Only protect main
"immutable_heads()" = "trunk()"
```

---

## Practical Examples

### Common queries
```bash
jj log -r '@-'                                    # Parent of working copy
jj log -r '::@'                                   # All ancestors of @
jj log -r 'trunk()..@'                            # Local work not on trunk
jj log -r 'heads(trunk()..)'                      # All branch tips above trunk
jj log -r 'mine() & trunk()..'                    # My local work
jj log -r 'conflicts()'                           # All conflicted commits
jj log -r 'empty()'                               # All empty commits
jj log -r 'merges()'                              # All merge commits
```

### Search and filter
```bash
jj log -r 'description(regex:"fix.*bug")'         # Search descriptions
jj log -r 'author("steve") & files("src/")'       # Steve's changes to src/
jj log -r 'author_date(after:"1 week ago")'       # Recent commits
jj log -r 'diff_lines("TODO")'                    # Commits adding/removing TODOs
```

### Topology
```bash
jj log -r 'ancestors(@, 5)'                       # Last 5 ancestors
jj log -r 'reachable(@, mutable())'               # Current working stack
jj log -r 'fork_point(@ | main)'                  # Where @ diverged from main
jj log -r 'heads(all())'                           # All repo heads
```

### Rebase patterns
```bash
jj rebase -s 'all:roots(trunk()..@)' -o trunk()   # Rebase all branches onto trunk
jj rebase -r 'description("wip")' -o main         # Move WIP commits onto main
```

### Bookmark queries
```bash
jj log -r 'bookmarks()'                           # All bookmarked commits
jj log -r 'remote_bookmarks(remote=exact:"origin")' # All origin bookmarks
jj log -r 'tracked_remote_bookmarks()'             # All tracked bookmarks
```

### Using `present()` safely in aliases
```bash
# Won't error if "main" bookmark doesn't exist:
jj log -r 'present(main)..@'
```

---

## Template Language

Templates customize output of `jj log`, `jj show`, etc. via `-T`/`--template`.

### Key commit keywords
`description`, `change_id`, `commit_id`, `parents`, `author`, `committer`, `mine`,
`working_copies`, `current_working_copy`, `bookmarks`, `local_bookmarks`,
`remote_bookmarks`, `tags`, `divergent`, `hidden`, `immutable`, `conflict`, `empty`,
`root`, `diff`, `files`

### Types and methods

**ChangeId / CommitId:**
- `.short([len])` — Short hex (default: 12 chars)
- `.shortest([min_len])` → ShortestIdPrefix — Shortest unambiguous prefix
- `.normal_hex()` — Full hex

**ShortestIdPrefix:**
- `.prefix()` — The unique prefix part
- `.rest()` — The remaining disambiguating part
- `.upper()` / `.lower()` — Case conversion

**String:**
`.len()`, `.contains(needle)`, `.first_line()`, `.lines()`, `.upper()`, `.lower()`,
`.starts_with(p)`, `.ends_with(p)`, `.trim()`, `.substr(start, end)`,
`.replace(pat, repl)`, `.split(sep)`

**List:**
`.len()`, `.join(sep)`, `.map(|item| expr)`, `.filter(|item| expr)`,
`.any(|item| expr)`, `.all(|item| expr)`, `.first()`, `.last()`, `.get(index)`,
`.reverse()`, `.skip(n)`, `.take(n)`

**Signature:** `.name()`, `.email()`, `.timestamp()`

**Timestamp:** `.ago()`, `.format(fmt)`, `.utc()`, `.local()`, `.after(date)`, `.before(date)`

### Global functions

- `fill(width, content)` — Word-wrap content
- `indent(prefix, content)` — Indent each line
- `pad_start(w, content)` / `pad_end(w, content)` — Pad to width
- `truncate_start(w, content)` / `truncate_end(w, content)` — Truncate to width
- `label(label, content)` — Apply color label
- `stringify(content)` — Convert to string
- `json(value)` — JSON-encode
- `if(cond, then, [else])` — Conditional
- `coalesce(content...)` — First non-empty
- `concat(content...)` — Concatenate
- `separate(sep, content...)` — Join non-empty with separator
- `surround(prefix, suffix, content)` — Wrap if non-empty

### Operators
`++` (concatenation), `&&`, `||`, `!`, `==`, `!=`, `+`, `-`, `*`, `/`, `%`,
comparison operators (`<`, `>`, `<=`, `>=`)

### Template examples

```bash
# Compact custom log
jj log -T 'separate(" ", change_id.shortest(8), description.first_line()) ++ "\n"'

# Machine-readable IDs
jj log --no-graph -T 'commit_id ++ " " ++ change_id ++ "\n"'

# Show bookmark names on each commit
jj log -T 'if(bookmarks, label("bookmark", bookmarks.join(", ")), "(no bookmark)")'

# Parents' short IDs
jj log -r @ -T 'parents.map(|c| c.commit_id().short(8)).join(",")'
```

### Template configuration

```toml
[templates]
log = "builtin_log_compact"              # or builtin_log_compact_full_description
show = "builtin_log_detailed"

[template-aliases]
'format_short_id(id)' = 'id.shortest(12)'
'format_timestamp(timestamp)' = 'timestamp.ago()'
```
