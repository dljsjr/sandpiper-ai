# jj 0.46.0 CLI help notes

- **Diátaxis mode**: Reference (research notes for the AGENT-67 jj skill rewrite)
- **Source**: `jj <cmd> --help` for all 125 commands and subcommands of jj 0.46.0, crawled depth-first from `jj --help` (2026-10-17). `help` subcommands skipped.
- **Coverage**: every visible command. Hidden commands (for example `jj debug`) do not appear in help and are not covered.
- **Version**: jj 0.46.0 only. jj 0.47 has been released since and is not covered; check its changelog before relying on a version-specific detail.

## How to read these notes

- One entry per command, in crawl order. Each entry gives the purpose, aliases, arguments, every flag, defaults, config keys, and behavior notes.
- Wording is compressed. Flag text that only restates the flag name is dropped.
- Shared material appears once under [Shared](#shared) and entries point to it.
- Tags:
  - `[EDITOR]` opens `$EDITOR` unless a flag such as `-m` prevents it.
  - `[INTERACTIVE]` opens a diff editor, merge tool, prompt, or TUI. Agents must avoid or neutralize it.
  - `[DESTRUCTIVE]` deletes data outside jj's undoable op log, or has effects `jj undo` cannot reverse (for example a push).
  - `[NET]` talks to a remote.
  - `[AGENT]` marks a non-obvious point that matters for agent use.
  - `[NEW 0.4x]` marks something added since 0.40, from the changelog. Untagged items may still be newer than 0.40.

## Shared

### Global options (identical on every command)

- `-R, --repository <PATH>`: repo to operate on. Default is the nearest ancestor `.jj/`.
- `--ignore-working-copy`: don't snapshot the working copy at the start, and don't update it at the end. Use it to read possibly stale state, for example in a prompt while another process commits the working copy. `--at-operation` implies it.
- `--no-integrate-operation` `[NEW 0.41]`: run normally, but don't integrate the resulting operation(s) into the op log, and don't update the working copy. Prints the new operation ID, which you can pass to `jj --at-op`, `jj op restore`, or `jj op integrate`. External side effects still happen: `jj git push --no-integrate-operation` still pushes. `[AGENT]` Use it for background or speculative tooling.
- `--ignore-immutable`: allow rewriting immutable commits (any except root). Only skips the check. It doesn't change `immutable_heads()` or the `immutable` template keyword.
- `--at-operation <OP>` (alias `--at-op`): load the repo at an operation. Default is the latest op, or a merge of divergent ops. Any unambiguous op-ID prefix works. `--at-op=@` is like the default but never merges divergent ops. Implies `--ignore-working-copy`. Mutating commands at an old op are allowed and act like concurrent commands started there.
- `--debug`: debug logging.
- `--color <always|never|debug|auto>`.
- `--quiet`: silence secondary output (snapshot notices, "rebased N descendants"). Warnings and errors still print.
- `--no-pager`.
- `--config <NAME=VALUE>` (repeatable): TOML dotted key = TOML value. Bare strings can skip quotes.
- `--config-file <PATH>` (repeatable).
- Root also has `-V, --version`. `jj help --help` lists keywords; `jj help -k <kw>` shows one (bookmarks, config, filesets, glossary, revsets, templates, tutorial).
- Every command has `-h` (summary) and `--help` (long). Since 0.44, passing a single-valued flag twice is allowed and the last one wins; repeatable flags collect all values.

### String patterns

Name arguments for bookmarks, tags, remotes, and similar default to **glob** matching unless an entry says otherwise. Other kinds use `kind:pattern` (see the revsets doc, "string patterns").

### Positional revset aliases

Many commands take revsets positionally and accept `-r` as an alias for the positional (shown as `[aliases: -r]`). Entries note this as `(pos, -r)`.

## Commands

### `jj abandon [REVSETS]...` (pos, -r; default `@`)

- Abandons the revisions and rebases their descendants onto the abandoned commits' parents. Like `jj restore --changes-in`, except abandon yields a new change while restore updates the existing one.
- An abandoned working-copy commit is replaced by a new empty commit. This is general jj behavior.
- `--retain-bookmarks`: move bookmarks on abandoned revisions to their parents instead of deleting them.
- `--restore-descendants`: don't change the content of children; their diffs absorb the removed changes.

### `jj absorb [FILESETS]...`

- Splits the source's changes and moves each hunk to the closest mutable ancestor that last modified those lines. Hunks with an ambiguous destination stay in the source.
- The source is abandoned if all changes were absorbed and it has no description.
- Review the result with `jj op show -p`.
- `-f, --from <REVSET>` (default `@`). `-t, --into <REVSETS>` (alias `--to`; default `mutable()`; only ancestors of the source count).
- `-i, --interactive` `[INTERACTIVE]` `[NEW 0.44]`: pick hunks to consider. `--tool <NAME>`: diff editor, implies `-i`.
- FILESETS limits which paths are absorbed.

### `jj arrange [REVSETS]...` (pos, -r) `[INTERACTIVE]` TUI

- Reorders and abandons revisions in a TUI. With no revisions given, uses `revsets.arrange`. Agents can't use it.

### `jj bisect run --range <REVSETS> [COMMAND] [ARGS]...`

- `jj bisect` has only the `run` subcommand.
- Binary search for the first bad revision. Assumes descendants of a bad revision are bad. `--find-good` inverts this to find the first good revision whose parents are bad; COMMAND still exits 0 if and only if the revision is good.
- Each revision checked is **edited** (becomes `@`) before COMMAND runs. `[AGENT]` It moves the working copy.
- Exit codes: 0 = good, 125 = skip, 127 (command not found) = abort, other non-zero = bad. The target commit ID is in `$JJ_BISECT_TARGET`.
- `-r, --range <REVSETS>` (required, repeatable, union): heads of the range are assumed bad; ancestors outside the range are assumed good.
- Pre-checks `[NEW 0.46]`: before bisecting, COMMAND runs on every assumed endpoint and must succeed on `heads(REVSETS)` and fail on `parents(connected(REVSETS)) ~ connected(REVSETS)` (reversed with `--find-good`). `--trust-endpoints` skips these checks.
- Use `--` before ARGS that start with `-`. To test with a fix applied: `jj bisect run --range v1.0..main -- bash -c "jj duplicate xyz -B @ && cargo test"`.
- Since 0.45 it reports when skips prevent an unambiguous answer.

### `jj bookmark` (alias `b`)

Subcommands, with aliases: `advance` (a), `create` (c), `delete` (d), `forget` (f), `list` (l), `move` (m), `rename` (r), `set` (s), `track` (t), `untrack`. See `jj help -k bookmarks`.

#### `jj bookmark advance [NAMES]...`

- Moves the "closest" bookmarks forward to a target.
- `-t, --to <REVSET>`: default `revsets.bookmark-advance-to`, which defaults to `@`.
- With no NAMES, the bookmarks to move come from `revsets.bookmark-advance-from` (default `heads(::to & bookmarks())`; that revset can refer to `to`). NAMES (glob patterns) target specific bookmarks and ignore the from-revset.
- `jj bookmark advance --to x` is equivalent to `jj bookmark move --from 'heads(::x & bookmarks())' --to x`.

#### `jj bookmark create <NAMES>...`

- `-r, --revision <REVSET>` (alias `--to`; default `@`). Names are literal, not patterns.

#### `jj bookmark delete <NAMES>...` (glob)

- Deletes the local bookmark, and the deletion propagates to tracked remotes on the next push. Revisions are kept; to drop a branch's revisions too, use e.g. `jj abandon main..<bookmark>`.
- To avoid propagating the deletion, use `forget`.

#### `jj bookmark forget <NAMES>...` (glob)

- Forgets the local bookmark without recording a deletion to push. Corresponding remote bookmarks become untracked.
- `--include-remotes`: also forget the remote bookmarks (and any Git-tracking bookmark). They come back on the next fetch if they still exist on the remote.

#### `jj bookmark list [NAMES]...` (glob on local name)

- By default a tracked remote bookmark is shown only if it differs from the local one, and untracked remote bookmarks are hidden. In conflicted bookmarks, `-` marks old targets and `+` new ones.
- `-a, --all-remotes`: show all tracked and untracked remote bookmarks, including synced ones.
- `--remote <REMOTE>` (glob, repeatable): show all remote bookmarks of matching remotes. Combines with `--tracked` / `--conflicted`.
- `-t, --tracked`: tracked remote bookmarks only; omits local Git-tracking bookmarks by default.
- `-c, --conflicted`: conflicted bookmarks only.
- `-r, --revision <REVSETS>`: bookmarks whose local targets are in the revsets.
  `-r deleted_bookmark` matches nothing, because a deleted bookmark has no local target.
- `-T, --template <T>`: the template gets every 0-arg `CommitRef` method as a keyword. Default comes from `templates.bookmark_list`.
- `--sort <KEY>` (repeatable; first key is most significant; a `-` suffix means descending): `name`, `author-name`, `author-email`, `author-date`, `committer-name`, `committer-email`, `committer-date`. Default comes from `ui.bookmark-list-sort-keys`.

#### `jj bookmark move <NAMES|--from <REVSETS>>`

- Can't create bookmarks (unlike `set`). With NAMES (glob), moves those bookmarks. With `-f, --from <REVSETS>`, moves the bookmarks currently pointing at those revisions, optionally filtered by NAMES.
- `-t, --to <REVSET>` (default `@`). `-B, --allow-backwards` allows moves backwards or sideways.

#### `jj bookmark rename <OLD> <NEW>`

- NEW points at the same commit. `--overwrite-existing` allows a NEW name that already exists.

#### `jj bookmark set <NAMES>...`

- Creates the bookmark or updates it by name. `-r, --revision` (alias `--to`; default `@`). `-B, --allow-backwards`. To move by current location instead of by name, use `move --from`.

#### `jj bookmark track <BOOKMARK[@REMOTE]>...` / `jj bookmark untrack <BOOKMARK[@REMOTE]>...`

- `BOOKMARK` is a glob pattern by default; `BOOKMARK@REMOTE` names a remote bookmark exactly. Since 0.43, the old `<kind>:<bm>@<remote>` pattern form is gone.
- `--remote <REMOTE>` (glob): remotes to (un)track. Default is every remote that has a matching bookmark.
- Tracking imports the remote bookmark as a same-name local bookmark, and later pulls propagate to it. An untracked remote bookmark is just a pointer to the last fetch and isn't imported.
- To forget the local bookmark and untrack its remotes in one step, use `forget`.

### `jj commit [FILESETS]...` (alias `ci`) `[EDITOR]`

- With no paths and no `-i`, it's `jj describe` followed by `jj new`.
- With paths or `-i`, the selected changes stay in `@` and the rest move to a new working-copy commit on top. That's like `jj split`, with these differences:
  - Not interactive by default.
  - No `-r`; always acts on `@`.
  - `[AGENT]` Doesn't move bookmarks forward. `jj split` without `-o/-A/-B` moves bookmarks from the old change to the child.
  - No choice of destination.
- `-i, --interactive` `[INTERACTIVE]`. `--tool <NAME>` (diff editor; implies `-i`).
- `-m, --message <MSG>`: don't open the editor. `--editor`: open the editor even with `-m`, to edit the message afterwards.
- `[AGENT]` There's no `--stdin`; only `describe` has it (confirmed: `jj commit --stdin` errors). For a message containing metacharacters, use `jj describe --stdin < file`, then `jj new`.
- `--author`/`--reset-author` were removed in 0.42; use `jj metaedit`.

### `jj config` (subcommands: `edit` (e), `gc`, `get` (g), `list` (l), `path` (p), `set` (s), `unset` (u))

Config comes from config files and environment variables; see `jj help -k config`.

- Scope selectors, shared by edit/list/path/set/unset: `--user`, `--repo`, `--workspace`, and `--file <PATH>` (on edit/set/unset; `[NEW 0.45]`).
  - `--file` must point to a location jj recognizes: a user/repo/workspace file, a file in `conf.d/`, a system config, `$JJ_CONFIG`, or a `--config-file`. The global `--config-file` _loads_ an extra file; `--file` _chooses which file on disk to change_. `set` and `edit` create the file and any missing parent directories.
  - `--user` targets the first loaded user file without prompting, since 0.45.
- `jj config edit <--user|--repo|--workspace|--file>` `[EDITOR]` `[INTERACTIVE]`: creates the file even if the editor writes nothing.
- `jj config gc`: finds, and optionally deletes, repo-level config directories under `~/.config/jj/repos` whose repo no longer exists `[NEW 0.43]`.
- `jj config get <NAME>`: prints the raw value with no formatting, for scripts (`jj config get user.name` prints `Martin…`; `list` prints `user.name="Martin…"`).
- `jj config list [NAME]`:
  - `--include-defaults` shows built-in defaults. `--include-overridden` also shows shadowed values. Scope flags filter.
  - `-T`: keywords are `name: String` (dotted key), `value: ConfigValue` (TOML), `overridden: Boolean`, `source: String`, and `path: Option<FsPath>` (an Option since 0.44).
  - Default template comes from `templates.config_list`. `builtin_config_list_detailed` gives a detailed view.
- `jj config path <--user|--repo|--workspace>`: the file may not exist. With `--repo` or `--workspace`, it creates the config directory and prints the path.
- `jj config set <scope> <NAME> <VALUE>`: VALUE is a TOML expression, and bare strings can skip quotes, though the shell may still need its own quoting. For an apostrophe, use a TOML multi-line literal: `jj config set --user foo.bar "'''{don't}'''"` (works in bash and fish). Or use `jj config edit`.
- `jj config unset <scope> <NAME>`.

### `jj converge` `[NEW 0.45]` `[INTERACTIVE]` unless `--no-interactive`

- Resolves divergence by replacing two or more visible revisions of one change ID with a single new revision.
- Evaluates `-r, --revision <REVSETS>` (default `revsets.converge`) and groups the results by change ID; a change ID with more than one revision is divergent. Succeeds as a no-op if nothing is divergent.
- If several changes are divergent, it prompts you to pick one.
- It uses heuristics to build the solution and prompts when they're inconclusive. Prompts can ask you to merge descriptions, choose parents, or (rarely) choose the author.
- `--no-interactive` `[AGENT]`: print a warning and exit with no changes instead of prompting.
- Only divergent revisions inside the revset are replaced; others with the same change ID stay divergent.
- Descendants are rebased onto the solution, and local bookmarks on divergent revisions move to it.
- The solution may have file conflicts even if the inputs had none.
- Review with `jj op show -p` and `jj evolog`; revert with `jj undo`.

### `jj describe [REVSETS]...` (alias `desc`; pos, -r; default `@`) `[EDITOR]`

- Opens `ui.editor` on the description(s).
- `-m, --message <MSG>`: no editor. With several revisions, all get the same description.
- `--stdin`: read the description from stdin, with the same multi-revision rule. `[AGENT]` This is the safe route for messages containing backticks or `$`.
- `--editor`: force the editor even with `-m` or `--stdin`.
- `--no-edit`, `--edit`, `--author`, `--reset-author` were removed in 0.42; author changes go through `jj metaedit`.

### `jj diff [FILESETS]...`

- `-r, --revisions <REVSETS>`: changes in those revisions compared with their parents. A merge commit shows the change from the auto-merge of its parents. Several revisions show the combined diff: `-r B::D` equals `--from A --to D`. Multiple heads and roots work; gaps (`'A|C'` in a linear chain A..C) don't.
- `-f, --from <REVSET>` / `-t, --to <REVSET>`: an omitted side defaults to `@`; `jj diff --from main` shows main to `@`. With no flags at all, the default is `-r @`.
- **Diff Formatting Options** (shared; the same block appears on show, log -p, evolog -p, interdiff, status-like views, op show/diff/log -p, and file annotate-adjacent commands):
  - `-T, --template <T>`: one render per file; keywords are the 0-arg methods of `TreeDiffEntry`.
  - `-s, --summary`: M/A/D per path.
  - `--stat`: histogram. Width limit via `diff.stat.max-bar-width` `[NEW 0.44]`.
  - `--types`: two letters, type before then after. `-` = absent, `F` = file, `L` = symlink, `C` = conflict, `G` = submodule.
  - `--name-only`: paths only, for pipelines like `jj diff -r @- --name-only | xargs …`.
  - `--git`: Git format. `diff.git.show-path-prefix` can drop the a/ and b/ prefixes `[NEW 0.41]`.
  - `--color-words`: word-level diff shown with color only.
  - `--tool <TOOL>`: external diff command; `:name` picks a built-in, so `--tool=:git` equals `--git`.
  - `--context <N>`. `-w, --ignore-all-space`. `-b, --ignore-space-change`.
  - Since 0.46, hunk headers include nearby source symbols.

### `jj diffedit [FILESETS]...` `[INTERACTIVE]`

- Opens the diff editor on `-r <REV>` (default `@`), or on `--from`/`--to`, where an omitted side defaults to `@`. You edit the right side, and the `-r`/`--to` revision is updated. Descendants are rebased, which may conflict.
- `--tool <NAME>`. `--restore-descendants`: preserve the descendants' content instead of their diff.
- FILESETS limits which paths are editable.
- Related: `jj restore` moves whole files between revisions; `jj squash -i` moves changes.

### `jj duplicate [REVSETS]...` (pos, -r; default `@`)

- With no destination flags, each copy goes onto the original's parents, or onto other new copies.
- `-o, --onto <REVSETS>` (aliases `-d`, `--destination`), `-A, --insert-after <REVSETS>` (alias `--after`), `-B, --insert-before <REVSETS>` (alias `--before`). Each is repeatable, and repeating makes a merge.
  - With a destination, the roots of the set are copied there and the rest are copied onto those new roots.
  - `-A` and `-B` rebase the new children onto the heads of the copies.
- Copies keep their descriptions; customize with `templates.duplicate_description`.
- `[AGENT]` Across commands, `-o/--onto` is now the primary name and `-d/--destination` an alias.

### `jj edit <REVSET>` (pos, -r)

- Makes the revision the working copy. The docs recommend `jj new` plus `jj squash` instead (see the FAQ, "resume working on an existing change").

### `jj evolog` (alias `evolution-log`)

- Lists the previous commits a change pointed to; the commit evolves on rewrite, rebase, and so on.
- `-r, --revisions <REVSETS>` (default `@`). `-n, --limit <N>`: applied after topological ordering and before `--reversed`.
- `--reversed`: oldest first. `-G, --no-graph`. `-T`: keywords are the 0-arg methods of `CommitEvolutionEntry`; default comes from `templates.evolog`.
- `-p, --patch`: diff against the previous version. If the previous version had different parents, it's temporarily rebased onto the new parents so unrelated changes don't show.
- Diff Formatting Options as in `jj diff`, minus `-T`. Whitespace flags are long-only here: `--ignore-all-space` and `--ignore-space-change`, with no `-w`/`-b`. The same is true on show, log, interdiff and op commands; check each.
- Legacy predecessors from jj before 0.30 are no longer supported (0.42).

### `jj file` (subcommands: `annotate`, `chmod`, `delete`, `edit`, `list`, `search`, `show`, `track`, `untrack`)

- `jj file annotate <PATH>`: shows the source change of each line (blame). `-r <REV>` is the revision to start at. `-T`: keywords are the 0-arg methods of `AnnotationLine`; default comes from `templates.file_annotate`.
- `jj file chmod <n|x> <FILESETS>...` (aliases `normal`, `executable`): sets or clears the executable bit. Works on Windows, on conflicted files, and on any revision. `-r` (default `@`).
- `jj file delete <FILESETS>...` `[NEW 0.46]`: deletes the matched files or directories from `-r` (default `@`) without touching the working copy; descendants are rebased. `--restore-descendants`: keep the descendants' content.
- `jj file edit <FILE>` `[NEW 0.46]` `[EDITOR]`: opens the file as it is in `-r` (default `@`) in the editor, saves it back, and rebases descendants. Creates the file if it's missing. For a conflicted file, the markers appear in the editor, and editing them can resolve the conflict. `--restore-descendants`.
  - `[AGENT]` It needs an editor. To use it non-interactively, set `JJ_EDITOR` or `--config ui.editor=[...]` to a script. Since 0.46, `ui.editor` supports `$path` and `$line` substitution.
- `jj file list [FILESETS]...`: `-r` (default `@`). `-T`: keywords are the 0-arg methods of `TreeEntry`; default comes from `templates.file_list`.
- `jj file search --pattern <P> [FILESETS]...`:
  - Prints each matching line with its path (since 0.44). `--name-only` prints only paths, the pre-0.44 behavior. `-n, --line-number` prefixes 1-based line numbers. `-r` (default `@`).
  - `-p, --pattern` is a `kind:pattern` string pattern; the default kind is **regex** (since 0.41; it was glob). A glob must match the whole line, so use `'glob:*foo*'`.
  - Not concurrent yet ("early version").
- `jj file show <FILESETS>...`: prints contents, recursing into directories. `-r` (default `@`). `-T`: keywords are the `TreeEntry` methods; default comes from `templates.file_show`.
- `jj file track <FILESETS>...`: new files are auto-tracked by default (`snapshot.auto-track`, default `all()`; for example `"none()"` or `"glob:**/*.rs"`). This command tracks files that don't match. `--include-ignored` also tracks ignored or oversized files.
- `jj file untrack <FILESETS>...`: the paths must already be ignored, via `.gitignore` or, in colocated workspaces, `.git/info/exclude`.

### `jj fix [FILESETS]...`

- Runs each changed file in the target revisions through the configured tools (for example formatters, `sed`, `sort`), and applies the same tools to those files in descendants so the fixes carry through.
- It never creates new conflicts. Conflicted files are fixed on every side, which can change the number of conflict markers.
- Identical content at the same path is processed once and the result reused, so tools must be deterministic.
- Review with `jj op show -p`. Config is in `jj help -k config` under "Code formatting and other file content transformations".
- Example config: `[fix.tools.<name>] command = ["/usr/bin/black", "-", "--stdin-filename=$path"]`, `patterns = ["glob:'**/*.py'"]`. The tool reads stdin and writes stdout.
- Default targets: `reachable(@, mutable())`, or `revsets.fix` if set. Each fixed revision gets the same treatment for its own copy of the files.
- `-s, --source <REVSETS>`: fix these revisions and their descendants.
- `--include-unchanged-files`: also fix unchanged files; with no paths, that's every file in the repo.
- `-a, --all-lines` `[NEW 0.41]`: format whole files. Without it, tools configured with `fix.tools.<name>.line-range-args` get only the modified lines. Since 0.46 that key is an array of string templates and replaces `line-range-arg`. `run-tool-if-zero-line-ranges` controls whether a tool runs when there are no modified lines. A tool with no line-range support always formats every line.

### `jj gerrit upload` `[NET]`

- Creates one Gerrit change per revision in `-r` plus all its mutable ancestors (`-r foo` means `-r 'mutable()::foo'`), and updates existing changes that have the same `Change-Id`.
- Default revision: `@` if it has a description, otherwise `@-`.
- A missing `Change-Id` trailer is generated from the jj change ID, on the uploaded commit only, so the uploaded commit ID differs from your local one. That can cause divergence after you fetch the merged change. Fix it with abandon or `jj rebase --skip-emptied`, or add the trailer locally through `templates.commit_trailers`: `if(!trailers.contains_key("Change-Id"), format_gerrit_change_id_trailer(self))`.
- Flags:
  - `-b, --remote-branch <B>` (default `gerrit.default-remote-branch`).
  - `--remote <R>` (a remote name or full SSH URL; default `gerrit.default-remote`).
  - `-n, --dry-run`.
  - `--reviewer`, `--cc`, `-l/--label` (all repeatable). A label can carry a value such as `Commit-Queue+2`; the default value is +1, and Gerrit silently ignores unknown labels.
  - `--topic`, `--hashtag` (repeatable).
  - `-m, --message` (patch-set description).
  - `--edit` (push as a change edit, which requires an existing change; it isn't a new patch set until published from the web UI).
  - `--wip`/`--ready`, `--private`/`--remove-private`, `--publish-comments`/`--no-publish-comments`.
  - `--notify <none|owner|owner-reviewers|all>` (default all).
  - `--submit` (bypasses review), `--skip-validation` (with `--submit`), `--merged` (create a new change even if already merged), `--ignore-attention-set`, `--deadline`.
  - `--custom` (repeatable keyed values), `-o/--option` (repeatable `git push -o`), `--trace`.
- `-o` arrived in 0.43; `-m`, `--edit`, `--merged` and repeated `--hashtag` in 0.41.

### `jj git` (subcommands: `clone`, `colocation`, `export`, `fetch`, `import`, `init`, `push`, `remote`, `root`)

See the git-comparison doc and the git command table.

#### `jj git clone <SOURCE> [DESTINATION]` `[NET]`

- A local SOURCE path is made absolute. DESTINATION defaults to the last component of the URL and is created if needed.
- `--remote <NAME>` (default `origin`).
- `--colocate` is the default, so the flag only matters when `git.colocate = false`: `.git` sits at the top level and Git tools work. `--no-colocate` hides the Git repo inside `.jj/`; the colocation docs list minor advantages of that.
- `--depth <N>`: shallow clone.
- `-b, --branch <B>` (repeatable): fetch only these branches and use one as the parent of `@`. By default every branch is fetched and the remote's default branch is the parent. **Branch/tag pattern dialect** (also used by fetch): glob, but only `*` expands (`?` doesn't), and only union and negative intersection work. Examples: `push-*`, `(push-* | foo/*) ~ foo/unwanted`. With several matches, the first exact name becomes the parent.
- `-t, --tag <TAG>` (repeatable; same dialect): fetch only some tags `[NEW 0.44]`. It replaced `--fetch-tags=all|none|included`.
- `--object-hash <sha1|sha256>`: must match the remote. The default comes from `git.object-hash`, which defaults to sha1.
- Since 0.41, clone patterns are saved in jj's repo settings rather than `.git/config`.

#### `jj git colocation` (subcommands: `disable`, `enable`, `status`)

- `disable` moves the root `.git` into `.jj/`, after which Git commands stop working. `enable` moves it back out to the workspace root.
- `status` shows the current mode.
- `[NEW 0.46]` (changelog; the help text doesn't say so): all three work in child workspaces. There `enable` creates a Git worktree, `disable` removes it, and `status` includes the workspace name.

#### `jj git export` / `jj git import`

- Both do nothing by default in colocated workspaces, where sync is automatic (disabled by default since 0.44 because of a race). `--ignore-working-copy` forces them.
- `import`: commits no longer reachable from any Git branch are abandoned in jj (`git.abandon-unreachable-commits = false` turns this off). An abandoned `@` gets a new empty commit. Since 0.45, a non-colocated import no longer pulls in commits from a detached Git HEAD.

#### `jj git fetch` `[NET]`

- Remotes: the default is `git.fetch`; otherwise `origin` if there are several remotes. `--remote <R>` is repeatable and glob (`--remote '*'`), named remotes only. `--all-remotes` fetches from all.
- Refs: the default comes from `remotes.<name>.fetch-bookmarks` / `fetch-tags` `[NEW 0.41]`; without fetch-bookmarks, Git's default refspecs. `-b, --branch` and `-t, --tag` (repeatable, clone dialect). `--tracked`: only already-tracked bookmarks and tags.
- Commits that become unreachable on the remote are abandoned locally (`git.abandon-unreachable-commits`).
- Since 0.42/0.43, fetch builds evolution history from change IDs and rebases local descendants of revisions rewritten on the remote (immutable descendants excepted).
- Since 0.44, tags are fetched like bookmarks, as `<name>@<remote>`, and auto-tracked by same-name local tags. The first fetch after upgrading re-fetches all tags. Git's `tagOpt` is ignored; disable tag fetching with `remotes.<name>.fetch-tags = '~*'`.

#### `jj git init [DESTINATION]` (default `.`)

- Run it in an existing Git checkout's root to adopt that checkout; this is the usual way to start using jj in a Git repo.
- `--colocate` is the default unless `git.colocate = false`. It's equivalent to `--git-repo=DESTINATION`, and the two are mutually exclusive. `--no-colocate`.
- `--object-hash <sha1|sha256>` maps to `git init --object-format` and can't be changed later.
- `--git-repo <PATH>`: use an existing Git repo as the backing store. The same path as DESTINATION gives a colocated repo (ignoring `git.colocate`); a path outside it stores a reference to an external Git repo, which isn't colocated.

#### `jj git push` `[NET]` `[DESTRUCTIVE]` (remote side effects can't be undone)

- Default target: tracking bookmarks **and tags** pointing into `remote_bookmarks(remote=<remote>)..@`. Configurable through `revsets.git-push` `[NEW 0.46]`.
- A push sends every commit from the remote's position up to the ref's target, and nothing after it.
- Safety: like `--force-with-lease`, the remote is updated only if it matches what jj last fetched. If a check fails, run `jj git fetch --remote <r>` and/or resolve bookmark conflicts (see the bookmarks docs on safety checks and conflicts).
- The remote isn't inferred from tracking.
  - `--remote <R>` is repeatable and glob (`--remote '*'`); the default is `git.push`, otherwise `origin` when there are several remotes. `git.push` can be a pattern or array.
  - `[AGENT]` Multi-remote push is new in 0.46. The help prose still says "There is no option to push to multiple remotes", which is stale.
- Flags:
  - `-b, --bookmark <B>` (repeatable, glob): starts tracking automatically if untracked. `-t, --tag <T>` (repeatable, glob): likewise.
  - `--all`: every bookmark **and tag**, including new ones (tags since 0.44).
  - `--tracked`: every tracked bookmark and tag.
  - `--deleted`: push deletions. Only tracked refs can be deleted remotely; untracked remote refs with no local counterpart only produce a warning.
  - `--allow-empty-description`.
  - `--allow-private`: private commits come from `git.private-commits` (default `none()`).
  - `--allow-conflicts` `[NEW 0.44]`.
  - `-r, --revision <REVSETS>` (repeatable): bookmarks and tags pointing at these commits.
  - `-c, --change <REVSETS>` (repeatable): push by creating a bookmark named from the change ID (template below).
- Since 0.41, `--all`/`--tracked`/`-r` skip ineligible bookmarks (private or conflicted) instead of failing.
- `--allow-new` was removed in 0.42; `git.push-new-bookmarks` and `git.auto-local-bookmark` too.
  The `-c` bookmark is tracked automatically. Its name comes from `templates.git_push_bookmark` (default `"push-" ++ change_id.short()`).
- `--named <NAME=REVISION>` (e.g. `--named myfeature=@`): creates and pushes a new bookmark in one step, tracking it if new. `[AGENT]` Useful for PR branches.
- `--dry-run`. `-o, --option <OPT>`: Git push options.

#### `jj git remote` (subcommands: `add`, `list`, `remove`, `rename`, `set-url`)

- (The help says the Git repo is "a bare git repo inside `.jj/`", which only applies to non-colocated repos.)
- `add <REMOTE> <URL> [--push-url <URL>]`: local paths are made absolute. Since 0.43 it warns when the URL duplicates an existing remote's fetch or push URL; since 0.42, an empty or whitespace name is an error.
- `list`.
- `remove <REMOTE>`: also forgets the remote's bookmarks. `rename <OLD> <NEW>`. Since 0.41 both update the `trunk()` alias.
- `set-url <REMOTE> [URL] [--push <URL>] [--fetch <URL>]`: a bare URL means `--fetch`.

#### `jj git root`

- Prints the underlying Git directory.

### `jj interdiff <--from <REV>|--to <REV>> [FILESETS]...`

- Compares two revisions' _patches_ rather than their file contents: it rebases `--from` onto `--to`'s parents and diffs the result against `--to`. Unlike `jj diff --from A --to B`, it ignores differences between the parents.
- `-f, --from` and `-t, --to` each default to `@`, and at least one is required.
- Typical use, seeing what changed since the last push: `jj interdiff --from push-xyz@origin --to push-xyz`. For a change's whole evolution, use `jj evolog -p`.
- Full Diff Formatting Options, including `-w`/`-b`.

### `jj log [FILESETS]...`

- Draws the graph children before parents. The default revset is `revsets.log`, which defaults to `builtin_log()` since 0.44: the mutable revisions plus some context.
  - `jj log -r ::` shows everything.
  - Spans left out by `-r` render as "(elided revisions)".
  - Symbols: `@` is the working copy, `◆` is immutable, `○` is anything else. Customizable via node-style config.
- FILESETS: only revisions that modify those paths.
- `-r, --revision <REVSETS>` (repeatable). `-n, --limit <N>`: applied after filtering and topological ordering, before `--reversed`. `-G, --no-graph`.
- `-T, --template <T>`: the default is `templates.log`. `[AGENT]` Running `jj log -T` with no value lists the built-in templates. Keywords are the 0-arg methods of `Commit`.
- `-p, --patch`. `--count`: print only the number of commits.
- Diff Formatting Options without `-T`; whitespace flags are long-only.

### `jj metaedit [REVSETS]...` (pos, -r; default `@`)

- Changes metadata only. Any metadata update also refreshes the committer name, email and timestamp on every rebased commit. The committer identity comes from `JJ_USER`/`JJ_EMAIL` or `--config user.name`/`user.email`.
- Flags:
  - `--update-change-id`: generate a new change ID.
  - `-m, --message <MSG>`: set the description without an editor.
  - `--update-author-timestamp`: set the author date to now.
  - `--update-author`: set the author to the configured user (for example `JJ_USER='Foo Bar' JJ_EMAIL=foo@bar.com jj metaedit --update-author`).
  - `--author "Name <email>"`: keeps the author timestamp for non-discardable commits.
  - `--author-timestamp <DATE>`: RFC2822 or RFC3339.
  - `--force-rewrite`: rewrite even with no other change, which refreshes the committer.
- `[AGENT]` This is where the removed `describe`/`commit` `--author`/`--reset-author` flags went (0.42). `--update-committer-timestamp` was also removed in 0.42; use `--force-rewrite`.

### `jj new [REVSETS]...` (parents; default `@`; aliases `-o`, `-r`)

- Creates an empty change and, unless `--no-edit`, makes it the working copy. Several parents make a merge (`jj new @ main`).
- `-m, --message <MSG>`. `--no-edit`: don't move `@`.
- `-A, --insert-after <REVSETS>` (alias `--after`, repeatable) puts the new change between A and A's children. Repeating it (`-A A -A X`) gives a merge parented on A and X, with all of their children rebased on top.
- `-B, --insert-before <REVSETS>` (alias `--before`, repeatable) puts the new change between C and C's parents. `-A` and `-B` combine: `-A A -B D` inserts between A and D, alongside the existing path.

### `jj next [OFFSET]` / `jj prev [OFFSET]` (default 1)

- `next` creates a new empty working-copy commit on the descendant OFFSET revisions ahead of `@`'s parent. `-e, --edit` edits the target directly, like `jj edit`. `-n, --no-edit` is the inverse. Both flags override `ui.movement.edit`.
- `--conflict`: jump to the next conflicted descendant.
- `prev` details are under its own entry.

### `jj operation` (alias `op`; subcommands: `abandon`, `diff`, `integrate`, `log`, `restore`, `revert`, `show`)

See the operation-log docs.

#### `jj op abandon <OPERATION>`

- Discards op history. `..<op>` abandons that op and its ancestors and reparents its descendants onto the root op.
- To discard _recent_ ops: `jj op restore <op>`, then `jj op abandon <op>..@-`.
- Change predecessors that become unreachable are discarded too, and `jj util gc` removes them later. `[DESTRUCTIVE]` once garbage-collected.

#### `jj op diff`

- `--operation <OP>` (alias `--op`): the op compared with its parent. Or `-f, --from` / `-t, --to`.
- `-G, --no-graph`. `-p, --patch`: diff the modified changes, with the evolog-style temporary rebase.
- Diff Formatting Options; whitespace flags are long-only.
- `--show-changes-in <REVSETS>`: default `revsets.op-diff-changes-in`. Since 0.40 only "interesting" revisions are shown by default.

#### `jj op integrate <OPERATION>` `[NEW 0.41]`

- Adds an operation left unintegrated (by `--no-integrate-operation` or an internal error) to the op log. A no-op if it's already there.

#### `jj op log`

- `[AGENT]` Like other commands, it snapshots the working copy and reconciles divergent ops. For a non-mutating look, use `jj --at-op=@ --ignore-working-copy op log`.
- `-n, --limit`, `--reversed`, `-G, --no-graph`.
- `-T`: keywords are the 0-arg methods of `Operation`; default `templates.op_log`. Since 0.40 the default output includes the workspace an op came from. `Operation.tags()` is deprecated in favor of `.attributes()` (0.41).
- `-d, --op-diff`: show the repo change at each op. `-p, --patch` implies `-d`.
- Diff Formatting Options and `--show-changes-in`.

#### `jj op restore <OPERATION>`

- Restores the repo to the state at OPERATION by creating a new op, which undoes everything after it. Preview with `jj --at-op=<op> log`.
- `--what <repo|remote-tracking>` (repeatable; EXPERIMENTAL; default both). `repo` covers the jj repo state and local bookmarks. `remote-tracking` covers remote-tracking bookmarks; leave it out if you want to push after the undo.

#### `jj op revert [OPERATION]` (default `@`)

- Applies the inverse of one op as a new op. `--what` as for restore.

#### `jj op show [OPERATION]` (default `@`)

- The op's changes compared with its parent(s).
- `-G`, `-T` (default `templates.op_show`), `-p, --patch`, `--no-op-diff`.
- Diff Formatting Options and `--show-changes-in`.

### `jj parallelize [REVSETS]...` (pos, -r)

- Makes the revisions siblings ("these are independent"). Outside ancestors and descendants keep their relationships: `jj parallelize 1::2` on 0-1-2-3 gives 0 → {1, 2} → 3, a merge.
- `jj parallelize '1 | 3'` is a no-op, because the 2 between them stays in place.

### `jj prev [OFFSET]` (default 1)

- Creates a new empty working-copy commit on the ancestor OFFSET revisions behind `@`'s parent. `-e, --edit`: edit the parent directly. `-n, --no-edit`. Both override `ui.movement.edit`.
- `--conflict`: jump to the previous conflicted ancestor.

### `jj rebase` (default `-b @`)

Moves revisions to new parents and keeps their diffs. A working-copy revision that gets abandoned is replaced by an empty one.

- **Which revisions:**
  - `-s, --source <REVSETS>` (repeatable): the revisions plus their descendant trees. Each `-s` root becomes a **direct child** of the destination, even when one source descends from another. `-s 'M|N'` makes both direct children.
  - `-b, --branch <REVSETS>` (repeatable): the whole branch relative to the destination, meaning `(dst..X)::`. `-b br -o dst` equals `-s 'roots(dst..br)' -o dst`.
  - `-r, --revision <REVSETS>` (repeatable): only these revisions. Descendants fill the hole by moving onto the revisions' parents, and edges inside the set are preserved. Unlike `-s`/`-b`, `-r` can move A onto one of A's own descendants.
  - `-s X` behaves like `-r X::` for a single X. For several revisions, `-s` flattens them to direct children, while `-r` keeps their internal structure.
- **Where to:**
  - `-o, --onto <REVSETS>` (aliases `-d`, `--destination`; repeatable, and repeating makes a merge, for example `-s L -o K -o M`): existing descendants of the target aren't affected.
  - `-A, --insert-after`: also rebases the target's descendants onto the moved revisions. `-r M -A J` reorders a stack.
  - `-B, --insert-before`: moves onto the target's parents, then rebases the target and its descendants onto the moved revisions.
  - `-A` and `-B` combine: `-r K -A J -B M` creates a merge, and `-r O -A K -B M` inserts a commit inside an existing merge.
- `--skip-emptied`: abandon commits that become empty from the rebase. Commits already empty stay, and merges with several non-empty parents are never skipped.
- `--keep-divergent`: without it, a divergent commit is abandoned when the destination already has another commit with the same change ID and identical changes.
- `--simplify-parents` (since 0.39): drop parents that are ancestors of other parents, like `jj simplify-parents`.
- `[AGENT]` One of `-o`, `-A`, `-B` is required.

### `jj redo` / `jj undo`

- `redo` reverses the most recent undo; repeated undo and redo walk back and forth like an editor's. `jj op log` shows the undo/redo history, and `jj op restore` jumps by op ID.
- `--allow-cross-workspace` `[NEW 0.46]` `[AGENT]`: by default both `undo` and `redo` refuse to act on an operation made in **another workspace**. Pass this flag, or use `jj op revert <op>` on a specific op. This matters for agents sharing a repo through several workspaces. (`undo` details are under its own entry.)

### `jj resolve [FILESETS]...` `[INTERACTIVE]` unless `--list` or a built-in tool

- Runs a 3-way merge tool on each conflicted file in turn; only conflicts that a 3-way merge can resolve are supported. To stop, exit the tool without changes. You can also edit the conflict markers directly.
- `-r, --revision <REV>` (default `@`). `-l, --list`: list conflicts instead of resolving them.
- `--tool <NAME>`: the built-ins `:ours` (side #1) and `:theirs` (side #2) are non-interactive. `[AGENT]`

### `jj restore [FILESETS]...`

- Gives the paths in `--into` the content they have in `--from`. If only one is given, the other defaults to `@`. With neither, restores `@` from its parents: a bare `jj restore` is like abandon but keeps the empty revision with its description and metadata.
- `-f, --from <REV>`, `-t, --into <REV>` (alias `--to`).
- `-c, --changes-in <REV>`: undoes the changes `jj diff -r REV` shows, relative to the merged parents. For a single parent it equals `--into REV --from REV-`. The default behavior is `--changes-in @`.
- `-i, --interactive` `[INTERACTIVE]`, `--tool <NAME>` (implies `-i`), `--restore-descendants`.
- For parts of files, use `jj diffedit`.

### `jj revert --revision <REVSETS> <-o|-A|-B>`

- Applies the inverse of each revision, in reverse topological order, at the destination. A destination is required.
- `-r, --revision <REVSETS>` (required). `-o, --onto` (aliases `-d`, `--destination`), `-A, --insert-after` (`--after`), `-B, --insert-before` (`--before`); each is repeatable, and repeating makes a merge.
- Description template: `templates.revert_description`.

### `jj root`

- Same as `jj workspace root`.

### `jj run <COMMAND> [ARGS]...` `[NEW 0.43]`

- Checks each revision out in an **isolated** working copy, runs COMMAND there, and amends the revision with the result. Descendants are rebased so the diff propagates. Since 0.44, revisions run oldest to newest; each starts only after the previous one has started, even with `-j > 1`.
- The command sees `JJ_CHANGE_ID`, `JJ_COMMIT_ID` and `JJ_WORKSPACE_ROOT`. Use `--` before ARGS that start with `-`. Example: `jj run -j 4 -- pre-commit run .github/pre-commit.yaml`.
- Flags:
  - `-r, --revision <REVSETS>`. (No default appears in the help; check.)
  - `-j, --jobs <N>`: default `run.jobs`, otherwise 1.
  - `--root`: run from each working copy's root instead of the invoking subdirectory.
  - `--clean`: start every commit from a fresh checkout. Working copies are reused by default to keep build artifacts.
  - `--restore-descendants`: keep the descendants' content.
  - `--passthrough` `[NEW 0.44]`: connect stdout and stderr to the terminal (stdin isn't inherited); allows only one job.
  - `--ignore-changes` `[NEW 0.44]` `[AGENT]`: read-only. Changes are discarded, and immutable commits are allowed without `--ignore-immutable`. Good for running tests or linters on every commit in a stack.
  - `--ignore-errors` `[NEW 0.44]`: keep going after failures. Failed commands' changes aren't saved, successful ones are applied atomically at the end, and the exit code ignores the failures. Without it, a non-zero exit stops the remaining revisions (0.45 fix).
  - `--sparse-patterns <copy|full|empty>` `[NEW 0.46]` (default `copy`, which uses the invoking workspace's patterns). The help text calls it `--sparse-args` in one place, a typo. After a sparse run, `full` without `--clean` reuses the previous artifacts.

### `jj show [REVSETS]...` (pos, -r; default `@`)

- Shows each revision's metadata and diff against its parents. Several revisions are shown one after another (0.42).
- `--reversed` (0.43). `-T`: default `templates.show`, `Commit` keywords. `--no-patch`.
- Full Diff Formatting Options, including `-w`/`-b`.

### `jj sign` / `jj unsign`

- `sign`: needs a commit-signing backend configured. `-r, --revision <REVSETS>`: default `revsets.sign`. Always re-signs (see #5786). `--key <KEY>`. (`unsign` details are under its own entry.)

### `jj simplify-parents` (since 0.23)

- Removes parents that are also indirect ancestors through another parent: if A has parents (B, C) and C is an ancestor of B, A ends up with only B. Content, including the working copy, is unchanged.
- `-s, --source <REVSETS>` (with descendants) and `-r, --revision <REVSETS>`, both repeatable. The default is `revsets.simplify-parents`, otherwise `reachable(@, mutable())`.

### `jj sparse` (subcommands: `edit`, `list`, `reset`, `set`)

- `edit` `[EDITOR]`: edit the patterns.
- `list`: a new repo has the single pattern `.` (everything).
- `reset`: back to everything.
- `set`: `--add <P>`, `--remove <P>`, `--clear`. Example: `jj sparse set --clear --add README.md --add lib`.
  `--clear` empties the pattern list; combine it with `--add`.

### `jj split [FILESETS]...` `[EDITOR]` and, without FILESETS, `[INTERACTIVE]`

- Splits one revision into two. Without FILESETS, `-i` is the default and opens the diff editor; you edit the right side down to what the _first_ commit should contain. With FILESETS, the matching files form the "selected" part and no diff editor opens.
- Layout:
  - Default: selected K' becomes the parent, remaining K" the child, and L is rebased onto K".
  - `-p, --parallel`: K' and K" become siblings, and L merges them.
  - `-o/-A/-B`: the selected part is extracted into a new commit at that location, and the remaining part stays where it was.
  - `[AGENT]` Without `-o/-A/-B`, bookmarks move forward to the child.
- Descriptions:
  - It asks for descriptions of both commits; since 0.46 that's a single editor session.
  - `-m, --message <MSG>` sets the _selected_ commit's description; the other keeps the original. `[VERIFY]` whether `-m` alone suppresses the editor entirely in 0.46.
  - `--editor`: force the editor even with `-m`.
- `-r, --revision <REV>` (default `@`). `--tool <NAME>`. `-o, --onto` (aliases `-d`, `--destination`), `-A`, `-B` (each repeatable, making a merge).
- An empty commit can't be split; use `jj new`.

### `jj squash [FILESETS]...` `[EDITOR]` when both descriptions are non-empty

- No options: move `@`'s changes into its parent.
- `-r, --revision <REV>`: move REV into its parent. Fails on a merge, and is incompatible with `-o/-A/-B`.
- `-f, --from <REVSETS>` (default `@`) and `-t, --into <REV>` (alias `--to`; default `@`). Example: `jj squash --into @--`.
- An emptied source is abandoned unless `-k, --keep-emptied`. Without `-i` or paths, the source is always emptied.
- If the abandoned source and the destination **both** have descriptions, it prompts for a combined one. `[AGENT]` Avoid the prompt with `-m <MSG>` or `-u, --use-destination-message`, which keeps the destination's description and drops the source's.
- `--editor`. `-i, --interactive` `[INTERACTIVE]`. `--tool`.
- EXPERIMENTAL: `-o, --onto` (aliases `-d`, `--destination`), `-A`, `-B` create a _new_ commit at that location from one or more `--from` sources (default `--from @`).

### `jj status [FILESETS]...` (alias `st`)

- Shows the working-copy commit and its parents, a summary of changes against the merged parents, conflicts in the working copy, and conflicted bookmarks. FILESETS restrict it (path filters respected since 0.41).
- For another revision's file list, use `jj diff --summary -r <rev>`.

### `jj tag` (subcommands: `delete` (d), `list` (l), `set` (s), `track`, `untrack`) `[NEW 0.44: track/untrack, remote tags]`

- `delete <NAMES>...` (glob): the revisions are kept.
- `list [NAMES]...` (glob):
  - Shows tags like `bookmark list` does.
  - `-a, --all-remotes`, `--remote <R>` (glob, repeatable), `-t, --tracked`, `-c, --conflicted`.
  - `-r, --revision <REVSETS>`: for example, `-r 'REV::'` acts like `git tag --contains REV` and `-r '::REV'` like `git tag --merged REV`.
  - `-T` (`CommitRef` keywords; default `templates.tag_list`). `--sort` (same keys as bookmarks; default `ui.tag-list-sort-keys`).
- `set <NAMES>...`: `-r, --revision` (alias `--to`; default `@`). `--allow-move` is needed to move an existing tag.
- `track` / `untrack <TAG[@REMOTE]>...` with `--remote <R>`: the same semantics as the bookmark equivalents. Fetched tags are tracked by default.
- `undo`: the first call after a normal op restores that op's parent; repeated calls go further back. Same `--allow-cross-workspace` rule as `redo`.
- `unsign`: `-r, --revision <REVSETS>`; no default appears in the help.

### `jj util` (subcommands: `backend`, `completion`, `config-schema`, `diff`, `exec`, `gc`, `install-man-pages`, `markdown-help`, `snapshot`)

- `util backend name` `[NEW 0.42]`: prints the commit backend.
- `util completion <bash|elvish|fish|nushell|power-shell|zsh>`. Fish: `jj util completion fish | source`. Bash: `source <(jj util completion bash)`.
- `util config-schema`: prints the JSON schema for the config.
- `util diff <PATH1> <PATH2>` `[NEW 0.46]`: diffs two files on disk. Accepts `--git`, `--color-words`, `--tool`, `--context`, `-w`, `-b`.
- `util exec <COMMAND> [ARGS]...`: runs an external command with `JJ_WORKSPACE_ROOT` set; it exists for aliases. Example: `[aliases] my-script = ["util", "exec", "--", "my-jj-script"]`. For an inline bash alias, add a trailing `""` so it becomes `$0`. The help warns this may be replaced by embedded scripting. Since 0.46 aliases can be disabled with `aliases.<name>.enabled = false`.
- `util gc [--expire now]`: by default prunes obsolete objects and ops older than 2 weeks; `now` is the only other value accepted. To collect old ops, run `jj op abandon ..<op>` first. `[DESTRUCTIVE]`
- `util install-man-pages <PATH>`: appends `man1` and so on.
- `util markdown-help`: the whole CLI help as Markdown. `[AGENT]` A cheap, version-exact reference.
- `util snapshot`: snapshots the working copy if it changed, for scripts.
  - Wrap a script in `jj util snapshot` calls so its jj ops stay separate from the user's file edits.
  - It doesn't print an op ID. For before/after checks, use `jj op log -G -n 1 -T id`. The help's example: compare op IDs around `jj git fetch`, then `jj rebase -r 'mutable()' -o 'trunk()'`.

### `jj version`

- Prints version information.

### `jj workspace` (subcommands: `add`, `forget`, `list`, `remove`, `rename`, `root`, `update-stale`)

- Each workspace has its own working-copy commit, shown as `<name>@` in `jj log`, and its own sparse patterns. A typical use is running a slow build in one workspace while editing in another.
- `workspace add <DESTINATION>`:
  - `--name <NAME>` (default: the destination's basename).
  - `-r, --revision <REVSETS>` gives any number of parents, as `jj new r1 r2 …` would. With none, the new working-copy commit shares the current workspace's `@`'s parents.
  - `-m, --message`.
  - `--colocate` / `--no-colocate` `[NEW 0.46]`: create a Git worktree for the workspace or not. The default colocates when the current workspace is colocated and `git.colocate = true`. Needs git 2.42 or later (`git worktree add --orphan`).
  - `--sparse-patterns <copy|full|empty>` (default `copy`).
- `workspace forget [WORKSPACES]...` (default: the current workspace):
  - Stops tracking that workspace's working-copy commit. The help says the directory "will not be touched on disk".
  - Per the 0.46 changelog, it also removes the Git worktree if there is one. Verified on 0.46 with git 2.56: forgetting a colocated workspace prints `Removed Git worktree for "<path>"`, deletes the workspace's `.git` file and the main repo's `.git/worktrees/<name>` entry, and leaves the working files and the workspace's `.jj/` in place.
  - Since 0.46, undoing a forget keeps the path metadata.
- `workspace list`: since 0.44 it shows workspace roots. `-T`: keywords are the 0-arg methods of `WorkspaceRef`; default `templates.workspace_list`. `WorkspaceRef.root()` returns `Option<FsPath>`. Since 0.46, unreachable paths are listed too, and template labels are `workspace name`, `workspace root`, and so on.
- `workspace remove <WORKSPACES>...` `[NEW 0.46]` `[DESTRUCTIVE]`: snapshots each working copy into a commit, then deletes the workspace directory from disk. The main workspace can't be removed. `[AGENT]` This replaces the "forget, then `rm -rf`" routine.
- `workspace rename <NEW>`: renames the current workspace.
- `workspace root [--name <NAME>]`: since 0.46 it warns about unreachable paths.
- `workspace update-stale`: see the stale-working-copy docs. Since 0.45, in colocated workspaces it resets Git HEAD to the parent of the fresh working-copy commit.

## Cross-cutting findings

### Editor and interactive hazards, with non-interactive escapes

| Command                                                                    | Hazard                                        | Escape                                                                               |
| -------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------ |
| `commit`                                                                   | editor                                        | `-m` (no `--stdin`)                                                                  |
| `describe`                                                                 | editor                                        | `-m`, `--stdin`                                                                      |
| `split`                                                                    | diff editor (no FILESETS); description editor | give FILESETS; `-m` (`[VERIFY]` it suppresses the editor)                            |
| `squash`                                                                   | combined-description prompt; `-i`             | `-m`, `-u`; no `-i`                                                                  |
| `converge`                                                                 | prompts                                       | `--no-interactive`                                                                   |
| `resolve`                                                                  | merge tool                                    | `--tool :ours` / `:theirs`; `--list`                                                 |
| `absorb -i`, `commit -i`, `restore -i`, `squash -i`, `diffedit`, `arrange` | diff editor / TUI                             | none; avoid                                                                          |
| `file edit`, `config edit`, `sparse edit`                                  | editor                                        | `JJ_EDITOR` / `ui.editor` script; for config, `config set`; for sparse, `sparse set` |

### Flag naming

- Destinations: `-o/--onto` is primary and `-d/--destination` an alias, on rebase, duplicate, revert, split, and squash (experimental there). `jj new` takes parents positionally, with `-o`/`-r` as aliases.
- Positional revsets with an `-r` alias: abandon, arrange, describe, duplicate, edit, metaedit, new, parallelize, show.
- Long name `--revision` (singular) on most commands; `--revisions` on diff and evolog. jj accepts either through `-r`.
- Whitespace short flags `-w`/`-b` exist on diff, interdiff, show, and util diff. On evolog, log, and op diff/log/show only the long forms exist.

### Agent-useful primitives found in help

- Read without side effects: `--ignore-working-copy`, `jj --at-op=@ --ignore-working-copy op log`. Speculative changes: `--no-integrate-operation`, then `jj op integrate`.
- Script op IDs with `jj op log -G -n 1 -T id`. Batch markers with `jj util snapshot`.
- Messages with metacharacters: `jj describe --stdin`.
- Bookmarks for PRs: `jj git push --named <name>=<rev>`, `jj git push -c <rev>`, `jj bookmark advance`.
- Per-commit checks: `jj run --ignore-changes -r <stack> -- <test cmd>`. Bisection: `jj bisect run`, which moves `@`.
- Edit without moving `@`: `jj file delete`, `jj file chmod`, `jj restore --into`, and `jj file edit` (needs an editor script).
- Workspace lifecycle: `workspace add --colocate`, `workspace list -T`, `workspace remove`, plus `undo --allow-cross-workspace` awareness.
- Divergence: `jj converge --no-interactive -r <revs>`.

### Config keys named in help

- `revsets.`: `log` (default `builtin_log()`), `arrange`, `converge`, `fix`, `sign`, `simplify-parents`, `git-push`, `bookmark-advance-to`, `bookmark-advance-from`, `op-diff-changes-in`.
- `templates.`: `log`, `show`, `evolog`, `op_log`, `op_show`, `bookmark_list`, `tag_list`, `config_list`, `file_list`, `file_show`, `file_annotate`, `workspace_list`, `git_push_bookmark`, `duplicate_description`, `revert_description`, `commit_trailers`.
- `ui.`: `editor`, `bookmark-list-sort-keys`, `tag-list-sort-keys`, `movement.edit`.
- `git.`: `colocate`, `fetch`, `push`, `private-commits`, `abandon-unreachable-commits`, `object-hash`.
- `remotes.<name>.`: `fetch-bookmarks`, `fetch-tags`.
- Others: `run.jobs`, `snapshot.auto-track`, `fix.tools.<name>.{command,patterns,line-range-args}`, `gerrit.default-remote`, `gerrit.default-remote-branch`, `aliases.<name>.enabled`.

### Environment variables named in help

- Read by jj: `JJ_EDITOR`, `JJ_PAGER` (0.41), `JJ_USER`, `JJ_EMAIL`, `JJ_CONFIG`.
- Set by jj for the commands it runs: `JJ_BISECT_TARGET`; for `jj run`, `JJ_CHANGE_ID`, `JJ_COMMIT_ID`, `JJ_WORKSPACE_ROOT`; for `util exec`, `JJ_WORKSPACE_ROOT`.

### Template types named in help (for the docs crawl)

`Commit`, `CommitRef`, `CommitEvolutionEntry`, `TreeDiffEntry`, `TreeEntry`, `AnnotationLine`, `Operation`, `WorkspaceRef`, `ConfigValue`. `jj log -T` with no value lists the built-in templates.

### Help text that is wrong or stale

Two items conflict with the 0.46 changelog, one is an omission, and two are errors inside the help itself.

- **Changelog conflict:** `jj git push` prose says there's no way to push to several remotes. The same page says `--remote` is repeatable, and multi-remote push is new in 0.46.
- **Changelog conflict, verified:** `jj workspace forget` says the workspace isn't touched on disk. On a colocated workspace it deletes the workspace's `.git` file (and the `.git/worktrees/<name>` entry). Working files and `.jj/` stay.
- **Omission:** `jj git colocation enable`/`disable` describe only moving the repo's `.git` between the root and `.jj/`. They don't mention child workspaces, which they support since 0.46 by creating or removing a Git worktree.
- **Help-internal error:** `jj run --sparse-patterns` refers to `--sparse-args full`, a flag that doesn't exist.
- **Help-internal error:** `jj git remote` says the Git repo "will be a bare git repo stored inside the `.jj/` directory". That's only true for non-colocated repos, and colocation is the default.

### To verify in a scratch repo before writing the skill

1. Whether `jj split <FILESETS> -m <msg>` opens an editor for the remaining commit (0.46 single-session change).
2. ~~Whether `jj workspace forget` on a colocated workspace leaves its files on disk~~. Done: files and `.jj/` stay; the workspace's `.git` file and `.git/worktrees/<name>` are removed.
3. The default revset of `jj run` and `jj unsign` with no `-r`.
4. `jj workspace remove` on a colocated worktree: does it also clean up the Git worktree entry?
5. That `undo` across workspaces refuses as documented (multi-agent recovery guidance depends on it).
