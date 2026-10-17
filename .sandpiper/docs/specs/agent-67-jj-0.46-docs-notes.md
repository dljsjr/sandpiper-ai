# jj 0.46.0 docs site notes

- **Diátaxis mode**: Reference (research notes for the AGENT-67 jj skill rewrite)
- **Source**: the docs site at <https://docs.jj-vcs.dev/latest/> (sitemap dated 2026-10-07, the 0.46.0 release), read from its markdown source at tag `v0.46.0` (`docs/` plus `mkdocs.yml`). A `lightpanda fetch --dump markdown` of a rendered page had identical headings. Three pages are macro-generated: `cli-reference` (= `jj util markdown-help`, covered in the CLI notes), `changelog` (read separately), and `git-command-table` (read from `docs/git-command-table.yml`).
- **Companion**: [agent-67-jj-0.46-cli-notes.md](agent-67-jj-0.46-cli-notes.md) covers every command's flags. These notes avoid repeating it and add concepts, the languages, config, workflows, and gotchas.
- **Skipped, because they're about the project rather than about using jj**: contributing, code of conduct, style guide, design-docs index and blueprint, releasing, governance (both pages), testimonials, paid contributors.
- **Tags**: `[AGENT]` matters for agent use. `[SKILL-STALE]` contradicts or updates what the current skill says. `[DESIGN]` comes from a design doc; check whether it's implemented.

## Getting started

### Installation and setup

- Runtime needs **git ≥ 2.42.0** (Debian 11 and Ubuntu 22.04 must upgrade). Building needs Rust ≥ 1.97.1.
- Set identity: `jj config set --user user.name "…"` and `user.email`.
- Completions:
  - *Standard*: `jj util completion <shell>`.
  - *Dynamic*: `COMPLETE=<shell> jj`, which also completes bookmarks, aliases, revisions, ops and files, and respects `-R` and `--at-op`. The docs recommend it even though clap labels it unstable.
  - Fish ≥ 4.0.2 loads dynamic completions automatically; otherwise use `COMPLETE=fish jj | source`.

### Tutorial

- The page itself says it's dated and points to Steve Klabnik's tutorial and "Jujutsu for everyone".
- `jj git clone` prints remote bookmarks as `[new] untracked` and sets the revset alias `trunk()` automatically (for example to `master@origin`). `jj git init` in an existing Git checkout creates a colocated workspace.
- Change ID vs commit ID: the change ID is stable across rewrites, like Gerrit's Change-Id. Every jj command amends the working-copy commit with any edits made since the last one. Prefer change IDs.
- `jj new` finishes the current change. To keep adjusting, `jj squash` (like `git commit --amend`) or `jj edit <c>`. The tutorial suggests `new` plus `squash` when a change is nearly done, so the adjustments can be reviewed with `jj diff`.
- Log symbols: `@` working copy, `○` mutable, `◆` immutable, `×` conflicted. `~` means parents are elided; "(elided revisions)" marks a gap.
- Revset basics: `@`, `root()` (change ID `zzzzzzzz`, commit `00000000`), `bookmarks()`, `|` `&` `~`, `x-` `x+` `::x` `x::` `x::y` `x..y`. `jj log -r ::` and `jj log -r 'all()'` are equivalent.
- **Conflict marker format in 0.46** `[SKILL-STALE]`: the markers now carry labels. Each side is identified by change ID, commit ID and description, plus its role.
  ```
  <<<<<<< conflict 1 of 1
  %%%%%%% diff from: ovknlmro 7d7c6e6b "B1" (parents of rebased revision)
  \\\\\\\        to: nuvyytnq 5dda2f09 "A" (rebase destination)
  -b1
  +a
  +++++++ puqltutt daa6ffd5 "B2" (rebased revision)
  b2
  >>>>>>> conflict 1 of 1 ends
  ```
  The skill shows the old `%%%%%%% Diff from <base> to <side #2>` form.
- Conflict workflow, as jj's own hints print it: `jj new <first conflicted>`, then edit the markers or run `jj resolve`, check with `jj diff`, and `jj squash` the fix into the conflicted commit. Descendants then resolve automatically if their conflict came from it. `jj st` prints "Hint: Conflict in parent commit has been resolved in working copy".
- `jj squash -i` keeps the child's content state unchanged, so it never conflicts. `jj diffedit` changes content state, so descendants may conflict.
- Without `ui.diff-editor` set, the default diff editor is `:builtin`, a TUI, and jj prints a hint telling you to set it.

### Working with Gerrit

- Remote selection: `--remote`, otherwise `gerrit.default-remote`, otherwise a remote named `gerrit`; it fails if none of those exist. Branch selection: `--remote-branch`, otherwise `gerrit.default-remote-branch`.
- A re-upload with the same `Change-Id` adds a patch set. Without a trailer, the Change-Id comes from the jj change ID. So when you split, keep the part that belongs to the original Gerrit change in the *first* half (the original change), and squash into the change that was uploaded before.
- To attach a jj change to an existing Gerrit change, paste its `Change-Id` trailer into the description.
- With `templates.commit_trailers` adding Change-Id locally, the mapping lives entirely in the trailer: never duplicate one across changes.
- `gerrit.review-url` makes upload use the `Link: <review-url>/id/I<change-id>` trailer (Gerrit ≥ 3.3.1) instead of `Change-Id`.
- Review loop: `jj edit xyz`, change files, `jj gerrit upload -r xyz`.

### Working with GitHub and GitLab

- Two PR workflows:
  - Generated name: `jj commit -m …` a few times, then `jj git push -c @-`. Push `@-` because `@` is the empty working copy.
  - Named: `jj bookmark create bar -r @-`, `jj bookmark track bar`, `jj git push`. (`jj git push --named bar=@-` does all three; see the CLI notes.)
- Bookmarks don't follow new commits; move them yourself.
- There's no `git pull`; see issue #1039. Run `jj git fetch`, then `jj rebase -o main`. The default `-b @` covers one branch; pass several `-b` for more.
- Colocated: Git sits in detached HEAD, and every jj command syncs with Git.
- Review fixes:
  - Add commits: `jj new feat`, edit, `jj commit -m …`, `jj bookmark move feat --to @-`, `jj git push`. Or use `jj describe` plus `--to @`.
  - Rewrite: `jj new feat-`, edit, `jj squash`, `jj git push --bookmark feat`. jj makes the force push itself.
  - `[AGENT]` Once `@` becomes immutable, for example because it was just pushed, jj creates a new working-copy commit on top. Run `jj new` before further edits so they don't amend the pushed commit.
- Other people's bookmarks: clone imports only the default branch, and fetch doesn't create local bookmarks for new remote ones. Use `jj new <bm>@<remote>`, or set `remotes.<name>.auto-track-bookmarks = "*"` (this key replaced `git.auto-local-bookmark`; details under config).
- `gh` in a *non-colocated* repo: `GIT_DIR=$(jj git root) gh …`, or set it in direnv's `.envrc`.
- Useful revsets:
  - Unpushed local bookmarks: `bookmarks() & ~(main | remote_bookmarks())`.
  - Mine and unpushed: `mine() & bookmarks() & ~remote_bookmarks()`.
  - Remote bookmarks I touched: `remote_bookmarks() & (mine() | committer(x))`.
  - Unpushed ancestors of `@`: `remote_bookmarks()..@`.
- Several remotes: `jj git clone --remote upstream …`, then `jj git remote add origin …`. Configure `[git] fetch = "upstream"` (or a list such as `["upstream", "origin"]`) and `push = "origin"`; both default to `"origin"`.
- Push options: `-o` (repeatable), forwarded to the host. GitLab examples: `-o ci.skip`, `-o merge_request.create -o merge_request.target=main -o 'merge_request.title=…'`, plus labels, assignees and auto-merge.

### Working on Windows (brief)

- `working-copy.eol-conversion` acts like `core.autocrlf`, but `.gitattributes` and `core.autocrlf` aren't read; keep them in sync by hand. To repair a working copy that differs only by line endings, set the config and run `jj abandon`.
- Binary files are detected heuristically. The built-in pager is `streampager` unless `ui.pager` is set.
- PowerShell treats `@` specially: quote it, or alias `revset-aliases.HEAD = '@'`.
- WSL on `/mnt/c` sets the exec bit on everything; keep a workspace on the Linux filesystem instead.
- Symlinks need Developer Mode and, when colocated, `core.symlinks=true`.

## FAQ

- **Bookmarks don't follow `jj new` or `jj commit`.** There's no "current bookmark". Use `jj bookmark move` (or `advance`).
- **`jj git push --all` says "Nothing changed".** It pushes *bookmarks*, not revisions. Use `-c`, or create or move a bookmark first.
- **A commit is missing from `jj log`.**
  - The default revset hides most remote commits. Check with `jj log -r 'all()'`.
  - An abandoned or rewritten commit is hidden; `jj log -r <commit_id>` shows it as "hidden", and `jj new <commit_id>` brings it back into view.
- **"(elided revisions)":** use `connected(x|y)` to show the revisions in between. The `git log` equivalent is `jj log -r ..` (everything except root).
- **Watching the log:** `watch --color jj --ignore-working-copy log --color=always`, or `watchexec … --watch=.jj/repo/op_heads/heads -- jj --ignore-working-copy log`. `[AGENT]` Watchers must pass `--ignore-working-copy` so their snapshots don't race the user's commands.
- **Adopting a Git repo:** `jj git init` inside it gives a colocated repo. For a separate jj checkout sharing a Git repo's commits, like a worktree: `jj git init --git-repo=path/to/git-repo path/to/new`.
- **Colocation:**
  - Benefits: Git commands and Git tooling (IDEs, build tools) keep working.
  - Drawbacks:
    - Mixing `git` and `jj` commands can create bookmark conflicts or divergence.
    - Git tools misread commits that contain conflicts, so don't mutate with Git while conflicts exist.
    - Slight slowdown on huge repos.
  - Recommendation: colocate.
- **Working-copy "saves" are in `jj evolog`, not `jj log`.** Earlier versions are "hidden" and can be referenced by commit ID. `jj evolog -p` shows how the content evolved.
- **Change offsets** `[SKILL-STALE]`: hidden and divergent commits show as `<changeid>/<n>` (for example `lnvvtrzo/1`, abbreviated `lnv/1`). That form can be used as a revision, so change IDs work for them too, not only commit IDs.
- **You can't stop jj from recording work.** Snapshot drafts with `jj new` and fold later edits in with `jj squash`.
- **Equivalents:**
  - `git add -p && git commit`: `jj split -i`, or the nearly identical `jj commit -i`.
  - `git commit --amend -p`: `jj squash -i`.
  - `git rebase -i`: usually `jj rebase -r C -B B` with `-A`/`-B`. For complex cases, the `jj arrange` TUI, which is still under development.
- **Scratch files:**
  - `snapshot.auto-track = "none()"` stops auto-tracking new files; already-tracked files are still snapshotted.
  - Or gitignore patterns like `*.scratch` or `scratchpad.*`, a `scratch/` directory in the global gitignore, or a directory whose `.gitignore` is `*`.
- **Local-only changes to tracked files:**
  - Put them in a `private: …` commit branched from trunk, and work in a merge `jj new <work> <private>`.
  - Fold edits back with `jj squash --into <work>`. Add new commits with `jj new --no-edit -A <work>` or `-A <base> -B <merge>`.
  - Guard against pushing it with `git.private-commits = "description('private:*')"` (set with `jj config set --user git.private-commits "'''description('private:*')'''"`).
- **Changes landed in the wrong commit (forgot `jj new`):**
  1. Find the last good version with `jj evolog -p` (or use `<bookmark>@origin` if it was pushed).
  2. `jj new <good-commit> -m featureB`. This creates temporary divergence.
  3. `jj restore --from <bad-commit>`.
  4. `jj bookmark move --from <bad> --to <good>`.
  5. `jj abandon <bad>`.
  6. Check with `jj diff --from … --to …`.
- **Resuming a change:** `jj new <rev>` plus `jj squash` is recommended. `jj edit` amends directly, which makes the change hard to review; don't `edit` a conflicted revision, because you might break the conflict annotations. `jj edit` is what to use where Git users would stash.
- **Clean merges show as "(empty)":** a commit's changes are relative to the auto-merged parents. The same definition drives `diff -r`, `log -p`, rebase, `empty`, `files()` and `jj log <path>`.
- **Reverting a merge:** `jj revert -r <merge>` usually does nothing, because the merge is empty. Instead: `jj new C`, `jj restore --from <first parent>`, `jj desc -m "Revert merge of D"`, and optionally `jj rebase -r @ -o main`.
- **Conflicted bookmark** (`??` after the name): `jj bookmark move <name> --to <id>`. `jj bookmark list` shows every target.
- **Vite and Vitest** `[AGENT]` (this repo uses Vitest): watching `.jj/` causes slow startup, jj timeouts and corrupted `working_copy.lock`. Add `server.watch.ignored: ["**/.jj/**"]`.
- **Manual snapshot:** `jj util snapshot` (with `--quiet` to silence it). For the op ID, `jj op log --limit 1` snapshots anyway.
- **Library or CLI for tools?** Neither `jj-lib` nor the CLI is a stable API. The CLI also works with custom backends, like Google's build.

## Community tools (community-maintained; jj doesn't endorse them)

- GUIs and TUIs: GG (cross-platform GUI), JayJay (macOS SwiftUI), jj-fzf, jj_tui (OCaml), lazyjj, jjui, LightJJ (browser), vjj (fzf).
- Editors and diff tools: Diffedit3 (web replacement for Meld), hunk.nvim (Neovim diff editor), VS Code (Jujutsu Kaizen `jjk`, VisualJJ (closed source), JJ View (has Gerrit support)), JetBrains (Selvejj, jj-idea), PSCompletions.
- `[AGENT]` **jj-hunk** (github.com/laulauland/jj-hunk): selects hunks from the command line, so it can split, commit or squash chosen hunks without an interactive diff editor. The docs call it out as useful for scripts and AI agents. It's the only route to partial-hunk operations without `-i`; check before relying on it.
- **jj-stack** (serpentine.com): turns a linear jj stack into GitHub PRs with `jj-stack submit`. PRs follow change IDs, so comments survive rewrites.
- More tools are listed in the jj wiki (including its GUI-and-TUI page).

## Concepts

### Working copy

- Snapshotting: most commands commit working-copy changes automatically and replace the working-copy revision. New files are tracked implicitly and deleted files untracked implicitly.
- `snapshot.auto-track` is a fileset deciding what new files get tracked. Ignored files are never auto-tracked.
  - `jj file untrack` keeps the file on disk, but you must ignore it (or exclude it from auto-track) first, or it's re-tracked immediately.
  - With a non-default auto-track, `jj file track` tracks files manually.
- Conflicts in the working copy:
  - Marked files are parsed back on each snapshot, so you can resolve a conflict partially by editing parts of the markers.
  - Workflow: `jj new <c>`, resolve, `jj diff`, `jj squash`. `jj edit <c>` also works but is harder to review.
  - `jj resolve` handles only 2-sided conflicts with a base. Conflicts between a directory, file and symlink have no good tool (#19); `jj restore` can pick a side blindly.
- Ignores: `.gitignore` in any directory, `$XDG_CONFIG_HOME/git/ignore`, `$GIT_DIR/info/exclude`. There's no `.jjignore`. Tracked files stay tracked even when they match an ignore pattern.
- Workspaces:
  - A workspace is a working copy plus a `.jj/` that links to the main repo; each can check out a different commit.
  - `workspace root --name X` prints that workspace's path. `workspace list` shows each workspace with its root.
  - `forget` leaves the directory and its files on disk; use it when the path is gone or the files should stay. (Verified: on a colocated workspace it does delete the `.git` file; see the CLI notes.)
  - `remove` `[DESTRUCTIVE]` `[AGENT]`: snapshots tracked changes, then deletes the directory, **including ignored files** (`.env`, build output, `node_modules`). The main workspace can't be removed. Removing the *current* workspace works on Unix; on Windows run it from elsewhere with `jj -R`.
- **Stale working copy.** Commands run in three steps: snapshot (an op), rewrite (an op), update the files.
  - If step 3 doesn't happen, the workspace is "stale"; `.jj/working_copy/` records the last op it was updated to. Fix it with `jj workspace update-stale`.
  - Causes:
    - `[AGENT]` Rewriting workspace A's `@` from workspace B, which is common with parallel agents.
    - `^C` or an error mid-command.
    - The op being lost (for example to `jj op abandon`). Then update-stale creates a **recovery commit** with the working-copy contents, parented on the current op's `@`.

### Bookmarks

- A bookmark is a named pointer that **follows rewrites**: rebase, describe and so on move it along, roughly following the change ID. Abandoning the commit **deletes** its bookmarks. There's no active or current bookmark. Bookmarks map to Git branches; push `foo` and you get Git branch `foo`, and a Git branch `bar` is imported as bookmark `bar` (automatic when colocated).
- `name@remote` is the last-seen remote position. It updates on fetch and on push of that bookmark, and you can't edit it by hand.
- **Tracked remote bookmark:** pulling it propagates to the same-name local bookmark, creating it if needed. Fetch merges the two updates: if one side is ahead, it wins; otherwise the local bookmark becomes **conflicted**. One local bookmark can track the same name on several remotes, and the names must match. It's the counterpart of Git's upstream branch.
- Terms:
  - *Remote bookmark*: the ref on the remote, as last seen.
  - *Tracked bookmark*: a remote bookmark that has been associated with the same-name local one.
  - *Tracking bookmark*: the local side of that pair.
- Log decorations:
  - `main*`: the local target differs from some remote; consider pushing.
  - `main??`: conflicted, shown on every candidate target. The name resolves to *all* candidates, so `jj new main` errors.
- Auto-tracking:
  - `jj git clone` tracks the default branch.
  - Pushing a new bookmark tracks the newly created remote one.
  - Everything else fetched arrives untracked, unless `remotes.<name>.auto-track-bookmarks = "*"`. Then each fetch tracks *newly fetched* bookmarks (existing ones are unaffected), and new local bookmarks are tracked at creation, ready for the next push.
- Track by hand: `jj bookmark list --all`, `jj bookmark track <bm> --remote=<r>`, then `jj git fetch --remote <r>`, then `jj new <bm>`. `jj bookmark list -t [name]` checks whether something is tracked.
- **Push safety checks:**
  1. The actual remote state must equal jj's record (like `--force-with-lease`). Exception: an unexpected position is accepted when a fetch wouldn't conflict, for example when it equals the local target.
  2. The local bookmark must not be conflicted. That keeps background `jj git fetch` on a timer safe, unlike some forms of `git --force-with-lease`.
  3. A bookmark that already exists on the remote must be tracked.
  On failure: `jj git fetch --remote <r>`, resolve, push again.
- Resolving conflicts:
  - Local: `jj bookmark move` to the intended target, optionally merging first (`jj new main`) or rebasing one side.
  - Remote (`main@origin` conflicted after concurrent ops): `jj git fetch`, which also fixes the local bookmark.
- One-letter aliases: `jj b c NAME -r@` = `jj bookmark create`.

### First-class conflicts

- A conflict is stored in the commit as a *logical* representation, not as markers, and the operation creating it (rebase, merge) succeeds. Conflicted commits can be rebased, merged or backed out again without nesting markers.
- Consequences:
  - There's no `--continue`. The single workflow is: check out the conflict, resolve it, amend.
  - Descendants rebase automatically.
  - A merge's change is relative to its merged parents, so resolutions inside merges survive rebases (rerere-like) and "evil merges" behave.
  - Resolution can wait. Criss-cross and octopus merges are easy.
  - Conflicts can be shared for collaborative resolution, but not with Git users.
- Markers appear in the working copy (after `jj new` or `jj edit` on a conflict) and in diffs (`jj show` of a commit that adds or resolves one).
- **Default "diff" style** `[SKILL-STALE: confirmed; SKILL.md:302 and references/mental-model.md:231 show the old `%%%%%%% Diff from <base> to <side #2>` form]`:
  ```
  <<<<<<< conflict 1 of 1
  %%%%%%% diff from: vpxusssl 38d49363 "merge base"
  \\\\\\\        to: rtsqusxu 2768b0b9 "commit A"
   apple
  -grape
  +grapefruit
   orange
  +++++++ ysrnknol 7a20f389 "commit B"
  APPLE
  GRAPE
  ORANGE
  >>>>>>> conflict 1 of 1 ends
  ```
  - `+++++++` starts a snapshot, and `%%%%%%%` starts a diff to apply to it. `\\\\\\\` only continues the label onto a second line.
  - **To resolve, apply each diff to the snapshot**, giving `APPLE / GRAPEFRUIT / ORANGE`.
  - An N-sided conflict has one snapshot and several diffs.
- **`ui.conflict-marker-style`:**
  - `"diff"` is the default.
  - `"snapshot"`: `+++++++` for each side and `-------` for the base.
  - `"git"`: diff3-style `<<<<<<<`, `|||||||` (base), `=======`, `>>>>>>>`, labelled with change ID, commit ID and description. It's 2-sided only and falls back to snapshot style for more sides.
- **Long markers:** when file content contains marker-like lines (such as `=======`), jj uses longer runs, for example 15 characters. `[AGENT]` Parsers must match by marker character and position, not by an exact length of 7.
- **No terminating newline:** jj adds a newline to each term and leaves it off the `>>>>>>>` line. Labels show `(no terminating newline)`.

### Operation log

- Each op stores a *view*: where each bookmark, tag and Git ref points, the heads, and each workspace's `@`. It also records its parent op(s) and metadata (time, user, host, description).
- `jj undo` goes back one step; `jj op revert` reverts an arbitrary op; `jj op restore` returns to a whole earlier state. Op revsets: `@` is the current op, plus `x-` and `x+`.
- **Lock-free concurrency:** concurrent jj commands, even on different machines over a shared filesystem with ordered writes, never corrupt the repo. Each command loads the latest op and doesn't see concurrent writes. Divergence then shows up in later `jj st` and `jj log` output, for example a change edited in an editor while its content also changed.
- `--at-op`: no snapshot is taken, and `@` resolves to the working-copy commit recorded in that op's view. Read-only commands (log, st, diff) are the sensible use. A mutating command there acts as if it had been started at that op, which is only useful for simulating concurrency.

### Glossary (only what adds precision)

- **Anonymous branch:** a chain of commits with no bookmark. jj keeps it until it's abandoned explicitly; the view stores the anonymous heads.
- **Author date vs committer date:** the author date is set once and usually survives rewrites. The committer date updates on every rewrite (rebase, describe, squash).
- **Backend:** the Git backend is the only production backend. Google runs its own cloud backend, and the op store is pluggable too.
- **Change:** a commit evolving over time. Only the change ID exists in the data model, as a property of commits.
- **Change ID:** usually 16 random bytes, shown as 12 letters `k`–`z`. It's hex written with the "digits" z–k in place of 0–9a–f.
- **Change offset:** `xyz/0` is the most recent commit with change ID `xyz`, `xyz/1` the one before, and so on. It's needed for hidden and divergent commits.
- **Commit ID:** 20 bytes (Git SHA-1), shown as 12 hex digits at the end of the log line.
- **Revision** is a synonym for commit. A commit is a snapshot (tree) plus metadata, but it's usually treated as the diff from its (merged) parents.
- **Colocated:** `.git/` is a sibling of `.jj/`, so `jj` and `git` can be used interchangeably.
- **Conflict kinds:**
  - File conflict: shown in `jj st` and with the red "conflict" label in the log.
  - Bookmark conflict: moved both locally and on the remote.
  - Divergent change: more than one visible commit for one change ID, labelled "divergent".
- **Head:** a commit with no descendants within some set (`heads(X)`). This isn't Git's HEAD.
- **Operation:** a view plus metadata. The op log is a DAG, and concurrent ops form forks and merges.
- **Repository:** everything under `.jj/`.
- **Rewrite:** a new commit with a new commit ID and, usually, the same change ID. Editing the working copy rewrites `@`.
- **Root commit:** the virtual commit `00000000…` / `zzzzzzzz…`, reachable as `root()`. Git's root commits are `root()+`.
- **Visible commits:** what `jj log -r 'all()'` shows, meaning commits reachable from an anonymous head in the view. Rewritten and abandoned commits become "hidden" but stay reachable by commit ID or change ID plus offset.
- **Workspace:** a working copy plus the repo. Every workspace has a `.jj/`, but commits and ops live in the *initial* workspace; the others point to it. Git calls this a worktree.
- **Working copy** is Git's working tree. It's snapshotted at the start and updated at the end of nearly every command. There's one working-copy commit per workspace, tracked in the op log.

## Guides

### CLI options for specifying revisions (the conventions behind every command)

- **Sources:**
  - `-r/--revision(s)`: exactly the set.
  - `-s/--source`: the set plus descendants (`-s X` ≈ `-r X::`). Commands that must touch descendants, like `jj fix -s`, accept only `-s`.
  - `-f/--from`: the *contents* of a revision, or the bookmarks on it.
  - `-b/--branch`: the whole branch relative to the destination.
- **Destinations:**
  - `-o/--onto`: children of the target.
  - `-A/--insert-after`: between REV and `REV+`.
  - `-B/--insert-before`: between `REV-` and REV.
  - `-t/--to` and `--into`: where contents go, where bookmarks move, or what to compare against. **Every command that accepts `--into` also accepts `--to`.**
- `-r` on a content command means "compared with the parent" (`jj diff -r R`).
- Positional revisions are allowed (no `-r` needed) on abandon, describe, duplicate, metaedit, new, parallelize and show. (The 0.46 help also lists arrange and edit; see the CLI notes.)
- Odd ones out: `git push -c` creates a bookmark and pushes it. `restore -c/--changes-in` removes a revision's changes; it isn't `-r`, so it doesn't read as "restore from".
- All of these are the same rebase: `jj rebase -o main -b @`, `-r (main..@)::`, `-s roots(main..@)`, and plain `jj rebase -o main` (`-b @` is the default).

### Divergent changes

- Shown with a change offset and the "divergent" label: `mzvwutvl/0 … (divergent)`.
- **How it happens:**
  - A hidden commit becomes visible again, via `jj new REV` on it, `jj edit REV`, putting a bookmark on it, or fetching others' descendants of a commit you'd pushed and then rewritten.
  - Or two successors are made concurrently:
    - Someone else modifies your branch.
    - **The same change is rewritten from two workspaces** `[AGENT]`.
    - **Two programs run at once**, for example an IDE fetching and rebasing while `jj describe` is open.
- Refer to divergent commits by commit ID or `<change>/<offset>`.
- **Resolutions:**
  1. `jj converge`, experimental and heuristic. Review with `jj op show -p`, revert with `jj undo`.
  2. `jj abandon <unwanted>`. Several at once works: `jj abandon a b c` or `abc::`.
  3. Keep both: `jj metaedit --update-change-id <commit>`.
  4. Combine: `jj squash --from <a> --into <b>`.
  5. Ignore it. It isn't an error, and immutable divergence may be impossible to fix; the only cost is ambiguous change IDs.

### Multiple remotes

- Names: `origin` is writable (your fork); `upstream` is canonical and possibly read-only.
- **GitHub-style fork:**
  - `jj config set --repo git.fetch '["upstream", "origin"]'` and `git.push origin`.
  - `jj bookmark track main` tracks it on both remotes.
  - `jj config set --repo 'revset-aliases."trunk()"' main@upstream`.
- **Independent repo that integrates upstream:**
  - `git.fetch '["origin"]'` (or both) and `git.push origin`.
  - `jj bookmark track main --remote=origin` and `jj bookmark untrack main --remote=upstream`.
  - `trunk() = main@origin`.
- Rules of thumb: set `trunk()` to whatever you rebase onto, because it also drives immutability. Track a remote bookmark only if it and the local bookmark should move together. Bookmark-tracking changes are being discussed in issue #7072.

## Reference: configuration (`config.md`, 2,622 lines)

### Layers and TOML

- **Load order** (later layers win): built-in (`cli/src/config/`) → user (`jj config path --user`) → repo → workspace → environment-variable overrides (such as `JJ_USER`/`JJ_EMAIL`) → command line (`--config` / `--config-file`).
  - **Repo and workspace config live outside the repo, for security.** `[AGENT]` A cloned repo can't inject config.
  - `jj config {edit,set,unset} --file <PATH>` targets one file. A `#:schema` line at the top enables JSON Schema validation in editors.
- TOML notes:
  - Dotted keys and headings are equivalent: `template-aliases."format_short_id(id)" = …` and `colors."commit_id prefix".bold = true`. **Dotted keys must come before the first heading.**
  - Strings are parsed twice, first by TOML and then by jj's languages. Prefer TOML *literal* strings (`'…'`, `'''…'''`) for templates and revsets, so TOML doesn't consume `\n`. The jj languages follow the same rule: `"` allows escapes, `'` doesn't.

### User and UI basics

- `user.name`, `user.email`. `JJ_USER`/`JJ_EMAIL` override config files but not `--config`. Conditional config switches identity by directory (details later in these notes).
- `ui.color = always|never|debug|auto` (default `auto`; it overrides `NO_COLOR`). `debug` shows labels.
- `[colors]`:
  - Values: named colors (`bright red`, `default`), `#rrggbb`, or `ansi-color-N`.
  - A table form sets fg/bg/bold/dim/italic/underline/reverse/crossed-out (crossed-out since 0.43).
  - Labels combine like CSS selectors: `"working_copy commit_id"`. The defaults are in `cli/src/config/colors.toml`.
- `ui.default-command` (default `"log"`) can be an array, e.g. `["log", "--reversed"]`.
- **Description templates:**
  - `templates.draft_commit_description` fills the editor; `self` is a Commit. It can extend `builtin_draft_commit_description`, for example with `"\nJJ: ignore-rest\n"` and `diff.git()`. To change just the default text, override the alias `template-aliases.default_commit_description`.
  - `templates.duplicate_description` for `jj duplicate`, e.g. a "(cherry picked from commit …)" footer. `description` usually ends in `\n`; use `.trim_end()`.
  - `templates.new_description`: the description `jj new` uses without `-m` (empty by default). The docs' example auto-names merges using `try(p.bookmarks().first().name(), p.change_id().shortest(8))`. `[AGENT]` It makes a good use of `try()`.
  - `templates.commit_trailers`: one trailer per line. Exact duplicate lines are skipped; deduplicate by key with `trailers.contains_key(k)`. Built-ins: `format_signed_off_by_trailer(commit)` (uses the committer) and `format_gerrit_change_id_trailer(commit)`. Existing trailers are in `commit.trailers()`.
- `ui.bookmark-list-sort-keys` / `ui.tag-list-sort-keys` (default `["name"]`); `--sort` overrides them.
- `revsets.bookmark-advance-from = 'heads(::to & bookmarks())'` and `bookmark-advance-to = '@'`.
  - `@-` suits squash-heavy workflows.
  - Recipe for advancing to the closest pushable revision: `bookmark-advance-to = 'closest_pushable(@)'` with `'closest_pushable(to)' = 'heads(::to & mutable() & ~description(exact:"") & (~empty() | merges()))'`.
- Diff styling labels: `"diff removed token"`, `"diff added token"`, `"diff token"`, `"diff context line_number"`, `"diff context"`, and per-format variants such as `"diff color_words added token"` (since 0.40).

### Diffs

- `ui.diff-formatter`: `":color-words"` (default), `":git"`, `":summary"`, `":stat"`, `":types"`, `":name-only"`, a tool name, or an argv array. `[AGENT]` Setting `":git"` gives stable, parseable output.
- `[diff.color-words]`:
  - `max-inline-alternation` (default 3; 0 = like git; -1 = inline everything; experimental).
  - `conflict = "materialize"` (default) or `"pair"` (experimental).
  - `context = 3`.
  - Without color, changed words always go on separate lines (since 0.42).
- `[diff.git]`: `context = 3`, `show-path-prefix = true`.
- `[diff.stat]`: `max-bar-width` (default unbounded, minimum 30% of the width).
- External diff tools:
  - Set `ui.diff-formatter = ["difft", "--color=always", "$left", "$right"]`, or name a tool configured as `[merge-tools.<name>] diff-args = [...]`.
  - Variables: `$left`, `$right`, `$width`. The default args are `["$left","$right"]`; `diff-args = []` marks a tool as unusable for diffs.
  - `diff-invocation-mode = "file-by-file"`. `diff-expected-exit-codes = [0, 1]` silences the non-zero-exit warning.

### Conflicts and immutability

- `ui.conflict-marker-style = "diff" | "snapshot" | "git"` (see the conflicts section above).
- **Immutable set:**
  - `revset-aliases."immutable_heads()"` defaults to `builtin_immutable_heads()`, which is `trunk() | tags() | untracked_remote_bookmarks() | untracked_remote_tags()` (`untracked_remote_tags()` was added in 0.45). Ancestors are immutable too, and `root()` always is.
  - Recipes: `"builtin_immutable_heads() | release@origin"`. To protect others' commits: `"builtin_immutable_heads() | (trunk().. & ~mine())"` (the `trunk()..` part is an optimization).
  - `--ignore-immutable` rewrites anything, without warning. Remember `jj undo`.
- `ui.movement.edit = true` makes `prev` and `next` default to `--edit`.

### Listing and log

- `templates.config_list` (`"builtin_config_list_detailed"` shows origins) and `templates.workspace_list`.
- **`revsets.log`** defaults to `builtin_log()`, which is `present(@) | ancestors(immutable_heads().., 2) | trunk()`.
  - Warning: `revsets.short-prefixes` defaults to `revsets.log`, so changing the log revset can lengthen the ID prefixes jj needs. Set it explicitly, for example `short-prefixes = "(main..@)::"`.
- `revsets.op-diff-changes-in` defaults to `mutable() | immutable_heads()`; revisions outside it are elided into a count.
- `revsets.log-graph-prioritize`: puts this revset on the left of the graph instead of `@`. The docs' megamerge example is `'coalesce(description("megamerge\n"), trunk())'`. `[AGENT]` Relevant to the megamerges reference.
- Default templates:
  - `templates.log` (`builtin_log_compact`, or `builtin_log_compact_full_description`).
  - `show` (`builtin_log_detailed`), `evolog` (`builtin_evolog_compact`), `op_log` and `op_show` (`builtin_op_log_compact`).
  - Node symbols: `templates.log_node` (`Option<Commit>` keywords: `current_working_copy`, `root`, `immutable`, …) and `templates.op_log_node` (`current_operation`).
- `ui.graph.style`: `curved` (default), `square`, `ascii`, `ascii-large`. `ui.log-word-wrap = true` wraps log, evolog and op log output.
- **Template aliases that drive the default output:**
  - `format_short_id(id)` (default `id.shortest(12)`), `format_short_commit_id`, `format_short_change_id` (IDs are case-insensitive), `format_short_operation_id`.
  - `format_timestamp(timestamp)` (`timestamp` or `timestamp.ago()`). `format_time_range(time_range)` for op log, which is relative by default.
  - `format_short_signature(signature)` (default `signature.email()`; also `signature`, `signature.email().local()`).
  - `commit_timestamp(commit)`: the committer timestamp by default; `commit.author().timestamp()` switches it.
  - Crypto signatures: `ui.show-cryptographic-signatures = true` and `format_{short,detailed}_cryptographic_signature(sig)`, where sig is `Option<CryptographicSignature>`.

### Pager

- Default `less -FRXK` (`-K` since 0.45, so ^C exits cleanly); on Windows the built-in streampager (`:builtin`).
- **`JJ_PAGER` overrides `ui.pager`; `PAGER` is ignored.** To defer to `$PAGER`: `["sh", "-c", "exec ${PAGER:-less -FRXK}"]`.
- `ui.paginate = "auto" | "never"`, where never equals `--no-pager`. `[AGENT]` Agents can set `JJ_PAGER=cat` or `--no-pager`; output is paginated only when it's a terminal anyway.
- `ui.streampager.{wrapping = anywhere|word|none, interface = quit-if-one-page|full-screen-clear-output|quit-quickly-or-clear-output, show-ruler}`.
- Formatters before the pager need a subshell, `["sh","-c","diff-so-fancy | less -RFX"]`. For delta, set `pager = "delta"` with `diff-formatter = ":git"`.

### Aliases

- `[aliases] l = ["log", "-r", "(main..@):: | (main..@)-"]`. The table form `{definition = [...], doc = "…"}` makes the `doc` show up in completions (0.42).
- Aliases run one jj command. For anything more, use `jj util exec` (see the CLI notes).
- Since 0.46, `aliases.<name>.enabled = false` disables built-in or earlier-layer aliases (for example `desc.enabled = false`, which fixes `jj des<tab>` completion). Only `aliases` can be disabled, not template, revset or fileset aliases.

### Editor

- **Priority:** `$JJ_EDITOR` > `ui.editor` > `$VISUAL` > `$EDITOR`. Default is nano (Notepad on Windows).
- GUI editors need a wait flag: `code -w`, `subl -n -w`, `idea --temp-project --wait`. Substitutions: `$path` and `$line`, e.g. `["nvim", "+$line"]`.
- `[AGENT]` For agents: `JJ_EDITOR=true` leaves the editor's file unchanged, which makes editor-only commands non-interactive. A script that writes the file gives scripted edits, which is what `jj file edit` needs. `[VERIFY]` how each command treats an unchanged buffer.

### Diff editor (split, squash -i, diffedit, commit -i, restore -i, absorb -i)

- `ui.diff-editor` defaults to `:builtin`, the scm-diff-editor TUI.
- `[merge-tools.<t>] edit-args = ["$left", "$right"]` (the default). `$left` is the original; **edits are read back from `$right`**. `edit-args = []` disables the tool. `program` sets the binary path. `edit-invocation-mode = "file-by-file"` (0.42) is independent of `diff-invocation-mode`.
- 3-pane editors: `meld-3` and `diffedit3` (web-based, `diffedit3-ssh` uses ports 17376-17380). For custom 3-pane tools, add `$output` (initially a copy of `$right`).
- A synthetic `JJ-INSTRUCTIONS` file appears in the diff; edits to it are ignored. Suppress it with `ui.diff-instructions = false`.
- `[AGENT]` **This is the non-interactive escape hatch for partial selection:** `--tool <name>` with `merge-tools.<name>.edit-args` pointing at a script that rewrites `$right` to the desired content. That makes `split`, `squash -i`, `commit -i`, `restore -i` and `absorb -i` scriptable. Delete `$right/JJ-INSTRUCTIONS` or ignore it. `[VERIFY]` with a scratch script.

### Merge tools (`jj resolve`)

- `ui.merge-editor`. Tools available out of the box when installed: kdiff3, meld, **mergiraf**, smerge, vimdiff, vscode, vscodium.
  - `[AGENT]` mergiraf is a syntax-aware automatic merger, a candidate for non-interactive resolution: `jj resolve --tool mergiraf`. It has no diff support (`diff-args = []`).
- `merge-args` is **required** for custom tools. Variables:
  - `$output` (required): the file jj reads back.
  - `$left`, `$right`, `$base`.
  - `$marker_length`: usually 7, sometimes longer.
  - `$path`: repo-relative, using `/`.
- Exit-code semantics:
  - The output starts empty, exit 0 means resolved, and non-zero means cancelled.
  - `merge-conflict-exit-codes = [1]` means "the output contains markers", so jj parses it as a partial resolution. Git diff3 markers parse too, so many Git merge drivers work.
  - `merge-tool-edits-conflict-markers = true` pre-fills the output with markers (vimdiff does this). Leftover markers mean partially resolved.
  - `merge-tools.<t>.conflict-marker-style` is per tool.

### `jj fix` tools

- Tools read the content on stdin and write the result to stdout. The working copy is never used. A file is rewritten only if the tool exits successfully.
- `[fix.tools.<id>]`:
  - `command` (argv; `$root` is the workspace root, `$path` the repo-relative path).
  - `patterns` (list of filesets; empty affects nothing; a file is processed once even if several patterns match it).
  - `enabled` (default true; lets the user config define a tool that individual repos switch on).
  - `line-range-args` (template strings with `$first`/`$last`, 1-based; deletions are skipped).
  - `run-tool-if-zero-line-ranges` (default false; set it to true for import sorters, or with `--include-unchanged-files`).
- With `line-range-args`, the args repeat for each modified range (`--lines=10-20 --lines=30-40`). `--all-lines` overrides that.
- For workspace-local binaries, use `$root`: `command = ["$root/node_modules/@biomejs/biome/bin/biome", "format", "--stdin-file-path=$path"]`. `[AGENT]` That's this repo's case.
- **Order:** tools that touch the same file run in lexicographic order of name, each feeding the next. Zero-pad numeric prefixes.
- Define disabled tools in the user config and switch them on per repo with `jj config set --repo fix.tools.rustfmt.enabled true`.

### `run.jobs`

- A positive integer (default 1). `-j` overrides it.

### Signing

- `[signing] backend = "gpg" | "gpgsm" | "ssh" | "none"` and `key` (anything `gpg -u` accepts, an SSH public key, or a path to one). The default key is the one associated with `user.email`.
- `backends.{gpg,gpgsm,ssh}.program`. `backends.gpg(sm).allow-expired-keys`. `backends.ssh.allowed-signers` (needed to verify) and `backends.ssh.revocation-list`.
- **`signing.behavior`:**
  - `drop`: don't sign, and drop old signatures on modification.
  - `keep`: re-sign your own commits that were signed before.
  - `own`: sign every commit you author when it's modified.
  - `force`: sign everything, even others' commits.
- Sign only at push time: `behavior = "drop"` plus `git.sign-on-push = true`. That signs your unsigned mutable commits at push, which suits slow or interactive keys. `[AGENT]` With hardware-key signing, an agent's rewrites would otherwise prompt.
- Verification and display are off by default for speed: `ui.show-cryptographic-signatures`. In templates, `commit.signature()` returns a `CryptographicSignature`.

### Git settings

- `git.colocate` (default true) applies to init and clone. `git.object-hash` is `sha1` (default) or `sha256`, chosen only at init, and the two formats don't interoperate.
- **Default remotes:** with one remote, it's used. With several, `origin` is assumed. `git.fetch` and `git.push` accept a single name, a list, or string patterns, e.g. `"regex:'^(remote|upstream)'"` or `'["remote*", "upstream*"]'`. A list or pattern for `push` means a multi-remote push (0.46).
- `remotes.<name>.fetch-bookmarks` / `fetch-tags` take a string pattern, e.g. `fetch-bookmarks = "~gh-pages"` and `fetch-tags = "v*"`. Only `*` globs, union, and negative intersection are supported. If unset, Git's refspecs are used.
- **`remotes.<name>.auto-track-bookmarks`** (pattern) applies to *new* bookmarks, both fetched and created locally:
  - Use a personal prefix (`"alice/*"`) when sharing a remote.
  - For a fork, `origin` gets `"*"` and `upstream` gets `"main"`.
  - **`remotes.<name>.auto-track-created-bookmarks`** applies only to bookmarks you create with `create`/`set`; you then have to track your own bookmarks fetched from other machines by hand.
  - Per-repo conventions can use conditional config.
- `revsets.git-push` (default `'remote_bookmarks(remote=exact:remote)..@'`, where `remote` expands to the remote's name).
- `git.track-default-bookmark-on-clone = false`: don't create the local `main`.
- `git.abandon-unreachable-commits` (default true). `git.record-synthetic-predecessors = false` speeds up big imports by skipping evolution reconstruction from change IDs.
- `templates.git_push_bookmark`, e.g. `'"martinvonz/push-" ++ change_id.short()'`. It must include something stable and unique, like `change_id`.
- **`git.private-commits`** (revset; default: nothing private), e.g. `"description('wip:*') | description('private:*')"`.
  - Commits already on the remote and immutable commits don't count as private.
  - **Descendants of private commits can't be pushed either.**
  - `[AGENT]` Doug's config makes `wip:` commits private; a 2026-08 push was blocked by one, according to the standup.
- `git.executable-path`: jj spawns `git` subprocesses for remote operations.

### Gerrit, merge, converge, fsmonitor

- `gerrit.default-remote`, `gerrit.default-remote-branch`, `gerrit.review-url` (Link trailer). No trailer is added if a `Change-Id` or `Link` already exists.
- `merge.hunk-level = "line"` (default) or `"word"`.
- `merge.same-change = "accept"` (default; resolves conflicts where every side made the same change, as Git does) or `"keep"`. Merge order can then affect results; see the same-change rule under technical conflicts.
- **`revsets.converge = "mutable() & divergent()"`** (default). `[AGENT]` A `divergent()` revset function exists.
- `fsmonitor.backend = "none" | "watchman"`. `fsmonitor.watchman.register-snapshot-trigger = true` snapshots automatically on changes. Check with `jj debug watchman status`, and tune inotify limits on big repos.

### Snapshot and working copy

- `snapshot.auto-track` (fileset; default `all()`).
- **`snapshot.max-new-file-size`** (default `1MiB`; accepts `"10MiB"` or a byte count; 0 = no limit). New files over the limit **aren't added to the snapshot**; existing files aren't subject to it. `[AGENT]` A large generated or binary file can silently stay untracked; `jj file track --include-ignored` overrides it.
- **`snapshot.auto-update-stale = true`**: update stale working copies automatically instead of asking for `jj workspace update-stale`. `[AGENT]` Useful for multi-workspace agent setups.
- `working-copy.eol-conversion = none | input | input-output`. Binary means "contains a NUL byte", which differs from Git and won't be aligned.
- `working-copy.exec-bit-change = respect | ignore | auto` (default auto; it detects filesystem support, and permission-denied means ignore). After switching to respect, `touch` files whose exec bit changed earlier. `jj file chmod` always works.

### Where config comes from

- **User config, in load order:** `~/.jjconfig.toml` → `<platform>/jj/config.toml` (preferred) → `<platform>/jj/conf.d/*.toml` (lexicographic). The platform directory is `$XDG_CONFIG_HOME` or `~/.config` on Linux and macOS, `%APPDATA%` on Windows. `--user` edits the primary file, or the first in `conf.d/`.
- **System:** `/etc/jj/config.toml` then `/etc/jj/conf.d/*.toml` (0.43). User config overrides it.
- **`JJ_CONFIG`** replaces user *and* system config when set, *even to an empty string*. It can be a file, a directory, or a `:`-separated list. It doesn't affect repo or workspace config, and nothing can disable those.
  - `JJ_CONFIG= jj log` runs with no user config. `[AGENT]` Good for reproducible runs (this repo's `test:vitest` already points it at a fixture).
- JSON schema: `#:schema https://docs.jj-vcs.dev/latest/config-schema.json` (or `jj util config-schema`).
- **Environment overrides** beat files but lose to `--config`:
  - `JJ_USER` → `user.name`, `JJ_EMAIL` → `user.email`, `JJ_EDITOR` → `ui.editor`, `JJ_PAGER` → `ui.pager`.
  - **`JJ_OP_HOSTNAME` → `operation.hostname` and `JJ_OP_USERNAME` → `operation.username`.** `[AGENT]` Lets an agent label its own ops in the op log.
  - `VISUAL`/`EDITOR` and `NO_COLOR` are fallbacks only.
- Command line: `--config k=v` (no spaces around `=`) and `--config-file`. Quoting example: `--config 'template-aliases."format_timestamp(timestamp)"="""timestamp.format("%Y-%m-%d %H:%M %:::z")"""'`.
- **Conditional config:**
  - Write `[[--scope]]` tables with `--when.*` conditions (several conditions intersect) and settings under `[--scope.<table>]`. A top-level `--when.*` applies to a whole file, which suits `conf.d/`.
  - **Conditions:**
    - `repositories` (path prefixes; `~` expands; case-sensitive; with several workspaces, the *main* workspace's path).
    - `workspaces` (path prefixes).
    - `hostnames` (exact match against `operation.hostname`).
    - `commands` (space-separated prefix match: `"file"` matches `file show`).
    - `platforms` (`windows`, `unix`, `linux`, `macos`, …).
    - **`environments`** (`"NAME=VALUE"` or `"NAME"`, OR-ed together, e.g. `["CI=true", "CI=1"]`).
  - `[AGENT]` `--when.environments = ["SANDPIPER_SESSION_ID"]` (or `PI_SESSION_ID`) could give agent sessions their own jj settings (`ui.editor`, `ui.paginate = "never"`, `snapshot.auto-update-stale`, `operation.username`) without touching Doug's interactive defaults.
  - Example: `--when.commands = ["status"]` with `ui.paginate = "never"`.

## Reference: fileset language

- **Quoting:** paths with whitespace or metacharacters must be quoted *inside* the expression, unless the expression has no operators or function calls. So `jj diff 'Foo Bar'` works, but `'~"Foo Bar"'` and `'"Foo(1)"'` need both quote layers. Glob characters aren't metacharacters, but the shell still needs quotes: `'~glob:**/*.rs'`.
- **A bare `"path"` parses as `prefix-glob:`**, a cwd-relative path prefix *with glob expansion*. The skill doesn't currently describe the default fileset kind; worth adding.
- Patterns (`cwd-` is the default anchor; `root-` anchors at the workspace root):
  - `cwd:"p"`: prefix, recursive.
  - `file:"p"` or `cwd-file:"p"`: exact file.
  - `glob:"pat"` or `cwd-glob:"pat"`: not recursive; `glob:"*.c"` matches only the current directory.
  - `prefix-glob:"pat"` or `cwd-prefix-glob:"pat"`: a glob plus everything under matching directories; `prefix-glob:"*.d"` = `glob:"*.d" | glob:"*.d/**"`.
  - `root:`, `root-file:`, `root-glob:`, `root-prefix-glob:`.
  - Case-insensitive globs append `-i`: `glob-i:"*.TXT"`. Glob syntax follows the globset crate.
- **Operators, tightest first:** `f(x)`, then `p:x`, then `~x` (complement), then `x & y` and `x ~ y` (difference; left to right), then `x | y`. So `x | y & z` = `x | (y & z)` and `x ~ y & z` = `(x ~ y) & z`.
- **Functions:** `all()`, `none()`.
- **Aliases:** `[fileset-aliases]` can define symbols, functions overloaded by arity, and **custom `name:value` patterns**:
  - `LOCK = '**/Cargo.lock | **/package-lock.json | **/uv.lock'`; `'not:x' = '~x'`.
  - An alias shadows a built-in function with the same name.
  - The table form with `doc` shows up in completions.
- Examples:
  - `jj diff '~Cargo.lock'`.
  - `jj file list 'src ~ glob:"**/*.rs"'`.
  - `jj split '~foo'` puts `foo` in the *second* commit. `[AGENT]` A FILESETS complement makes `split` non-interactive for a whole-file partition.

## Reference: revset language

### Resolution rules

- Commands that need a single revision (such as `jj edit`) error on zero or several matches.
- **Hidden revisions:** searches cover visible commits only, unless a hidden commit is named explicitly (by commit ID, `name@remote`, or `at_operation()`). Then its ancestors join the search space too: they're in `all()`, `x..` and `~x`, but not in `..visible_heads()`. For example, `hidden | all()` = `hidden | ::(hidden | visible_heads())`.
- **Symbols:**
  - `@` is this workspace's working-copy commit; **`<workspace>@`** is another workspace's; `<name>@<remote>` is a remote bookmark or tag.
  - A full or unique-prefix commit ID. A full or unique-prefix change ID, which must refer to a *visible* commit and isn't allowed when divergent. Use `<change>/<offset>` for hidden or divergent commits.
  - Quote a symbol to stop it being parsed as an operator: `jj log -r '"x-"'` means the bookmark literally named `x-`.
- **Priority:** tag name, then bookmark name, then commit or change ID. To force one, use `commit_id(abc)`, `change_id(abc)`, `bookmarks(exact:abc)` and so on. `[AGENT]` Scripts should pass IDs through `commit_id()` / `change_id()` so a same-named bookmark or tag can't hijack them.

### Operators (tightest first; same-level infix operators are left-associative)

1. `f(x)`.
2. `x-` (parents) and `x+` (children); either may be empty.
3. `p:x` (string, date or pattern alias).
4. The range operators:
   - `x::` (descendants including x), `x..` (= `~::x`, everything that isn't an ancestor), `::x` (ancestors including x), `..x` (`::x ~ root()`).
   - `x::y` (= `x:: & ::y`; Git's `--ancestry-path`).
   - `x..y` (= `::y ~ ::x`; Git's `x..y`; x and y needn't be related).
   - `::` (= `all()`) and `..` (everything except root).
5. `~x`.
6. `x & y`, `x ~ y`.
7. `x | y`.

- **`..` doesn't distribute over a union on its left:** `(A|B)..` = `A.. & B..`, not `A.. | B..`.
- Worked examples on D(merge of B, C) → A → root:
  - `D-` = {C, B}; `A+` = {B, C}.
  - `B..` = {D, C} (it includes C, unlike `B::` = {D, B}).
  - `B::D` = {D, B}, but `B..D` = {D, C}.
  - `B::C` = {}, but `B..C` = {C}.

### Functions (`[arg]` is optional; `name=` labels allow skipping earlier arguments)

- **Graph:**
  - `parents(x,[depth])`: `parents(x,3)` = `x---`. `children(x,[depth])`. `ancestors(x,[depth])`, `descendants(x,[depth])`.
  - `first_parent(x,[depth])` (follows only the first parent at merges) and `first_ancestors(x,[depth])`, which leave out side branches as `git log --first-parent` does.
  - **`reachable(srcs, domain)`:** follows parent *and* child edges while staying inside `domain`. `reachable(@, mutable())` = "my current stack".
  - `connected(x)` = `x::x`.
  - `heads(x)` = `x ~ ::x-` and `roots(x)` = `x ~ x+::`. Both differ from Mercurial's definitions.
  - `visible_heads()`, `root()`, `all()`, `none()`.
  - `latest(x,[count=1])`, by committer timestamp.
  - `fork_point(x)` = `heads(::x1 & … & ::xN)`.
  - **`merge_point(x)`** = `roots(x1:: & … & xN::)` (0.44).
  - `bisect(x)`: about half of x are its descendants; weak on non-linear history.
  - **`exactly(x, count)`:** errors unless x has exactly `count` commits. `[AGENT]` Use `exactly(x, 1)` to guard script targets.
  - `merges()`, **`forks()`** (more than one child; 0.43).
- **IDs:** `change_id(prefix)` (resolves to several commits if divergent; a non-unique prefix errors; no match is fine) and `commit_id(prefix)`.
- **Refs**, all taking string patterns:
  - `bookmarks([pat])`, e.g. `bookmarks(*push*)`; conflicted bookmarks include every target.
  - `remote_bookmarks([name], [[remote=]pat])`, `tracked_remote_bookmarks(…)`, `untracked_remote_bookmarks(…)`.
    - Git-tracking bookmarks (`@git`) are excluded unless `remote="git"` or `remote="*"`.
    - Example: `remote_bookmarks(*push*, *ri*)`.
  - `tags([pat])`, `remote_tags(…)`, `tracked_remote_tags(…)`, `untracked_remote_tags(…)`.
- `description(pattern)` (continued in the next section).
- **Text and metadata:**
  - `description(pat)`: a non-empty description usually ends in `\n`. So `description("")` = no description, and `description("foo\n")` matches exactly "foo\n".
  - **`subject(pat)`**: the first line, without the newline.
  - `author(pat)` = `author_name(pat) | author_email(pat)`. `author_date(datepat)`.
  - `mine()` = `author_email(exact-i:<user.email>)`.
  - `committer(pat)`, `committer_name`, `committer_email`, `committer_date(datepat)`.
  - `signed()`.
- **Content:**
  - `empty()` (no file changes; includes clean merges and root).
  - `files(fileset)`: cwd-relative; a directory matches recursively; `files(foo)` matches `foo/bar` but not `foobar`. The argument must also parse as a revset, so `.` needs quotes: `files(".")`.
  - **`diff_lines(text, [files])`**, `diff_lines_added(…)` and `diff_lines_removed(…)` (the latter two since 0.40). Example: `diff_lines("*TODO*", "src")`. The skill's `references/revsets.md` already uses these names correctly.
  - `conflicts()`, **`divergent()`**.
- **Control:**
  - `present(x)`: none() instead of an error for unknown names.
  - **`coalesce(a, b, …)`**: the first one that isn't empty.
  - **`working_copies()`**: every workspace's `@`.
  - **`at_operation(op, x)`**: evaluate x at an operation, e.g. `at_operation(@-, visible_heads())`. It brings that op's visible commits into the search space; 0.46 also allows non-ancestor, sibling ops.
- Function examples (graph: E→B, D merges B and C, B and C → A):
  - `reachable(E, A..)` = {E, D, C, B}; `reachable(E, B..)` = {E}; `reachable(C, B..)` = {D, C}.
  - `connected(E|A)` = {E, B, A}.
  - `heads(E|B)` = {E}; `roots(E|B)` = {B}.
  - `fork_point(E|D)` = {B}; `fork_point(B|C)` = {A}.

### String patterns

- **A bare string defaults to `glob:`** `[SKILL-STALE: confirmed]`. The skill's `references/revsets.md:187` says "Default is `substring` for most functions". Verified on 0.46 in a scratch repo: `description(base)` matched nothing, while `description(*base*)` and `description(substring:base)` matched "base commit". (`ui.revsets-use-glob-by-default` was removed in 0.43.) So `description(fix)` matches only a description that is exactly "fix". **Write `*fix*` or `substring:fix`.** The docs' examples use `author(*martinvonz*) & description(*reset*)`.
- Kinds: `exact:`, `glob:` (globset syntax), `regex:` (matches *substrings*; regex crate syntax), `substring:`. Append `-i` for case-insensitive (`glob-i:"fix*jpeg*"`).
- Combine with `~x`, `x & y`, `x ~ y`, `x | y`, e.g. `bookmarks(~glob:"ci/*")`.
- **Date patterns:** `after:"…"` (inclusive) and `before:"…"` (exclusive). Accepted forms: `2024-02-01`, `2024-02-01T12:00:00(-08:00)`, `2024-02-01 12:00:00`, `2 days ago`, `5 minutes ago`, `yesterday`, `yesterday 5pm`, `yesterday 10:30`.

### Aliases

- `[revset-aliases]` supports symbols (`HEAD = '@-'`), functions overloaded by arity (`'user()'`, `'user(x)' = 'author(x) | committer(x)'`), and **custom patterns** (`'grep:x' = 'description(regex:x)'`). The `{definition, doc}` table form shows the doc in completions. An alias shadows a built-in with the same name.
- **Built-in aliases** (defined in `cli/src/config/revsets.toml`):
  - **`trunk()`**: the default remote's default bookmark, or `upstream`'s or `origin`'s, set per repo at init. Otherwise it tries `main`, `master` and `trunk` on `upstream` and `origin` and takes the newest, falling back to `root()`. If you override it, it must resolve to exactly one commit: `'trunk()' = 'bm@remote'`.
  - `builtin_log()` = `present(@) | ancestors(immutable_heads().., 2) | trunk()`.
  - `builtin_immutable_heads()` = `trunk() | tags() | untracked_remote_bookmarks() | untracked_remote_tags()`. Don't redefine it; redefine `immutable_heads()`.
  - **`immutable_heads()`** is the *heads of* the immutable set, not the immutable heads.
  - `immutable()` = `::(immutable_heads() | root())`.
  - `mutable()` = `~immutable()`.
  - **Redefining `immutable()` or `mutable()` doesn't change what is immutable; edit `immutable_heads()`.**
  - `visible()` = `::visible_heads()`.
  - `hidden()` = `~visible()`. It's empty unless hidden commits are named, so it's *not* "every previously visible commit" (#2623).
- Examples:
  - `jj log -r @-` (like `git log -1 HEAD`); `-r ::@` (plain `git log`).
  - `'remote_bookmarks()..'` (unpushed); `'remote_bookmarks(remote=origin)..'`.
  - `'root()+'` (Git's root commits); `'tags() | bookmarks()'` (like `--simplify-by-decoration`).
  - `'(remote_bookmarks()..@)::'` (local work plus descendants).

## Reference: template language

### Basics

- Templates are passed with `-T`. `self` is the top-level object, and its type depends on the command:
  - `Commit` for log and show; `Operation` for op log; `TreeEntry` for file list.
  - The rest are listed in the CLI notes.
  - Every 0-argument method of `self` is also available as a bare keyword (`commit_id` = `self.commit_id()`).
- **Operators, tightest first:**
  1. `x.f()` and `f(x)`.
  2. `-x` and `!x`.
  3. `p:x` (string pattern).
  4. `* / %` (Integers).
  5. `+ -`.
  6. `>= > <= <`.
  7. `== !=` (Boolean, ByteString, Integer, String).
  8. `&&` (short-circuit).
  9. `||`.
  10. `++` (concatenate).
- **Global functions:**
  - Layout: `fill(width, content, [break_words])` (`break_words` since 0.46), `indent(prefix, content)`, `pad_start` / `pad_end` / `pad_centered(width, content, [fill_char])`, `truncate_start` / `truncate_end(width, content, [ellipsis])`.
  - Strings and formatting: `hash(Stringify) -> String`, `label(label, content)` (custom color label), `hyperlink(url, text, [fallback])` (OSC 8 when color is on), `raw_escape_sequence(content)` (zero-width content only).
  - **`replace(pattern, content, |RegexCaptures| -> Template)`** (0.41): keeps the formatting of unreplaced parts. Captures are read with `.get(i)`, `.name(n)`, `.len()`.
  - `stringify(x)` strips labels.
  - **`json(Serialize)`** `[AGENT]`; since 0.46 it takes map literals: `json({"commit_id" => commit_id, "tags" => tags})`.
  - Control flow:
    - `if(cond, then, [else])`.
    - **`try(expr, fallback…)`** (0.44): the first expression that succeeds; runtime errors are suppressed, parse and type errors aren't.
    - `coalesce(…)`: the first *non-empty* value.
    - `concat(…)`; `join(sep, …)`; `separate(sep, …)` (only non-empty parts); `surround(prefix, suffix, content)` (only if non-empty).
  - `config(name: Stringify) -> Option<ConfigValue>`; dynamic names allowed since 0.40.
  - `git_web_url([remote="origin"])`: best-effort HTTPS URL, empty string on failure, no SSH alias resolution.

### Types (part 1)

- Each type lists its conversions: to Boolean, to Serialize (needed for `json()`), to Template (printable).
- **AnnotationLine** (no conversions): `.commit()`, `.content() -> ByteString` (includes the newline), `.line_number()`, `.original_line_number()`, `.first_line_in_hunk()`.
- **Any**: everything converts to it. **AnyList**: `.join(sep)`.
- **Boolean**: the `true` and `false` literals.
- **ByteString** (0.41; converts to Bool, Serialize and Template): not guaranteed UTF-8.
  - `.len()` (bytes), `.contains()`, `.match(StringPattern)` (first match, or empty).
  - `.starts_with`, `.ends_with`, `.remove_prefix`, `.remove_suffix`, `.trim`, `.trim_start`, `.trim_end`.
  - `.substr(start, [end])`: 0-based, exclusive end, negative counts from the end.
  - `.first_line`, `.lines()`, `.split(StringPattern, [limit])`, `.replace(pattern, repl, [limit])` (`$0`, `$1` captures), `.upper`, `.lower` (ASCII only).
- **ByteStringify**: a String or anything printable (labels stripped).
- **ChangeId** (Serialize, Template): `.normal_hex()` (0-9a-f rather than the canonical z-k), `.short([len])`, `.shortest([min_len]) -> ShortestIdPrefix`.
- **Commit** (Serialize; not printable):
  - Identity and metadata: `.description()` (ends in `\n` when not blank), `.trailers() -> List<Trailer>` (in order; keys may repeat), `.change_id()`, `.commit_id()`, `.parents()`, `.author()`, `.committer()`, `.signature() -> Option<CryptographicSignature>`, `.mine()`.
  - Workspaces: `.working_copies() -> List<WorkspaceRef>`, `.current_working_copy()`.
  - Refs:
    - `.bookmarks()` (local plus remote; a tracked remote bookmark only if it differs), `.local_bookmarks()`, `.remote_bookmarks()`.
    - `.tags()`, `.local_tags()`, `.remote_tags()`.
  - State: `.divergent()`, `.hidden()`, **`.change_offset() -> Option<Integer>`**, `.immutable()`, **`.contained_in(revset: StringLiteral)`**, `.conflict()`, `.empty()`, `.root()`.
  - Content:
    - `.diff([files]) -> TreeDiff`, relative to the parents.
    - `.files([files]) -> List<TreeEntry>`: the files *present* in the commit. For *changed* files, use `.diff().files()`.
    - `.conflicted_files()`.
- **CommitEvolutionEntry** (Serialize): `.commit()`, `.operation()`, `.predecessors()`, `.inter_diff([files]) -> TreeDiff` (the same view as `evolog -p`).
- **CommitId** (Serialize, Template): `.short([len])`, `.shortest([min_len])`.

### Types (part 2)

- **CommitRef** (Serialize, Template), a bookmark or tag:
  - Identity: `.name() -> RefSymbol`, `.remote() -> Option<RefSymbol>`, `.present()`, `.conflict()`.
  - Targets: `.normal_target() -> Option<Commit>`, `.removed_targets()`, `.added_targets()`.
  - Tracking:
    - `.tracked()` (true even if the local ref was deleted but the deletion isn't pushed yet), `.tracking_present()`.
    - **`.tracking_ahead_count()` / `.tracking_behind_count()`** return a `SizeHint`, ahead or behind relative to the tracking local ref.
    - **`.synced()`**: a local ref synced with every tracked remote, or a remote ref synced with its local one. `[AGENT]` Use it to check "pushed or not" in a template.
- **ConfigValue** (Serialize, Template; prints as TOML): `.as_boolean()`, `.as_integer()`, `.as_string()` (doesn't convert other types), `.as_string_list()`.
- **CryptographicSignature** (no conversions): `.status()` (`good`/`bad`/`unknown`/`invalid`), `.key()` (fingerprint), `.display()` (GPG UID or SSH principal).
  - These are **slow**, because they verify (cached after the first call). Checking presence through Boolean coercion is fast: `if(commit.signature(), …)`.
- **DiffStatEntry**: `.bytes_delta()`, `.lines_added()`, `.lines_removed()`, `.path() -> RepoPath` (the target for copies and renames), `.display_diff_path()`, `.status()` (`modified|added|removed|copied|renamed`), `.status_char()` (`M A D C R`).
- **DiffStats** (printable as a histogram): `.files()`, `.total_added()`, `.total_removed()`.
- **Email** (Bool, Serialize, Template): may not contain an `@`. `.local()` and `.domain()`.
- **FsPath** (0.44; Serialize, Template): non-UTF-8 bytes survive display, but `json()` may reject them. `.absolute()`, `.relative()` (relative to cwd).
- **Integer** (Serialize, Template).
- **List** (converts to Bool):
  - Basic: `.len()`, `.join(sep)`.
  - Lambdas: `.filter(|x| …)`, `.map(|x| …) -> AnyList`, `.any(|x| …)`, `.all(|x| …)`.
  - **`.first()`, `.last()`, `.get(i)`** return `Option<T>` and never error (changed in 0.46; the skill's templates reference doesn't cover List access yet).
  - `.reverse()`, `.skip(n)`, `.take(n)`.
  - Examples: `description.lines().filter(|s| s.contains("#"))`, `parents.map(|c| c.commit_id().short())`, `parents.all(|c| c.mine())`.
- **List<Trailer>**: `.contains_key(key)`.
- **Operation** (Serialize; not printable): `.current_operation()`, `.description()`, `.id() -> OperationId`, `.attributes()` (replaces the deprecated `.tags()`), `.time() -> TimestampRange`, `.user()`, `.snapshot()`, **`.workspace_name()`** (empty if none), `.root()`, `.parents()`.
- **OperationId**: `.short([len])`.
- **Option** (converts to Bool, meaning "is set"):
  - Methods of the inner value can be called directly; calling one on an unset value is an error reported inline.
  - In comparisons, unset is less than any set value and isn't an error.
  - Types that already convert to Bool, such as String and List, never become `Option`. Unset values of those types come back as empty instead.
- **RefSymbol**: a String rendered as a revset symbol, quoted and escaped as needed. It doesn't convert to Bool.
- **RegexCaptures**: `.len()` (including group 0), `.get(i) -> ByteString` (errors when out of range), `.name(n)`.
- **RepoPath** (Serialize, Template): slash-separated and relative to the repo root. `.absolute() -> FsPath` (since 0.44 `RepoPath.absolute()` returns FsPath, not String), `.display()` (native separators, relative to cwd), `.parent() -> Option<RepoPath>`.
- **Serialize**: field names and types are *usually* stable but not guaranteed. `[AGENT]` A script parsing `json()` output should tolerate added fields.
- **ShortestIdPrefix**: `.prefix()`, `.rest()`, `.upper()`, `.lower()`.
- **Signature** (Serialize, Template): `.name()`, `.email() -> Email`, `.timestamp() -> Timestamp`.
- **SizeHint** (Serialize): `.lower()`, `.upper() -> Option`, `.exact() -> Option`, `.zero()`.
- **String** (UTF-8; Bool, Serialize, Template):
  - The same methods as ByteString, with byte-based `substr` that never splits a codepoint (a codepoint straddling `start` is included, one straddling `end` is dropped).
  - **`.escape_json()`**, for hand-built JSONL such as `'{ "foo": ' ++ foo.escape_json() ++ ' }'`.
  - `.first_line()` = `.lines().first()`.
- **Stringify**: anything printable, with labels stripped. Invalid UTF-8 is rejected.
- **StringLiteral**: known at parse time, required by things like `contained_in(revset)` so the revset can be checked early.
  - `"…"` supports these escapes: `\" \\ \t \r \n \0 \e \xHH`. Any other backslash sequence is an error.
  - `'…'` has no escapes and can't contain `'`.
- **StringPattern**:
  - The same syntax as revset string patterns, but **the quotes are mandatory**.
  - **In templates, a plain literal string matches as a case-sensitive *substring*** `[AGENT]`. In revsets a bare string is a *glob*, so the two languages default differently; `.match("foo")` is a substring match.
  - Patterns can't be stored or passed as values, only written at the call site.
- **Template**: no methods; most types convert to it.
- **Timestamp** (Serialize, Template): `.ago()`, `.format(strftime)` (chrono syntax), `.utc()`, `.local()`, `.after(datelit)`, `.before(datelit)`, `.since(start) -> TimestampRange`.
- **TimestampRange**: `.start()`, `.end()`, `.duration()`.
- **Trailer** (Template): `.key()`, `.value()`.
- **TreeDiff** (not printable): `.files() -> List<TreeDiffEntry>`, `.color_words([ctx])`, `.git([ctx])`, `.stat([width], [max_bar_width]) -> DiffStats`, `.summary()`.
- **TreeDiffEntry**: `.path()` (the target), `.display_diff_path()`, `.status()`, `.status_char()`, `.source() -> TreeEntry`, `.target() -> TreeEntry`.
- **TreeEntry**: `.path()`, **`.normal_value() -> Option<TreeValue>`** (0.46; unset when absent or conflicted), `.conflict()`, `.conflict_side_count()`, `.file_type()` (`file|symlink|tree|git-submodule|conflict`), `.executable()`.
- **TreeValue** (Template): prints the full object ID. For a submodule, that's the recorded commit.
- **WorkspaceRef** (Serialize, Template): `.name() -> RefSymbol`, `.target() -> Commit`, **`.root() -> Option<FsPath>`**. It's an Option because workspaces created before jj 0.38 didn't record their root.

### Color labels, aliases and examples

- Output is labelled automatically with the command, the context and the method names, so `jj op log -T 'self.id().short()'` is labelled `op_log operation id short`. Discover labels with `--color=debug`, and add your own with `label("…", content)`.
- `jj config list --include-defaults --include-overridden colors` shows the effective colors. The defaults live in `colors.toml` and `templates.toml`.
- `[template-aliases]`: keywords (`sh = "commit_id.short()"`), functions overloaded by arity (`'format_field(key, value)'`), and **custom patterns** (`'json:x' = 'json(x) ++ "\n"'`). The `{definition, doc}` form shows the doc in completions. Aliases shadow built-ins.
- **Examples** `[AGENT]` (machine-readable output; `-G` turns off the graph):
  - `jj log -G -T 'commit_id ++ " " ++ change_id ++ "\n"'`.
  - `jj log -G -r @ -T 'parents.map(|c| c.commit_id().short()).join(",")'`.
  - `jj log -G -r @ -T 'coalesce(description, "(no description set)\n")'`.
  - `jj log -T 'try(bookmarks.first().name(), change_id.shortest(8)) ++ "\n"'`.
  - `jj diff -T 'path ++ " " ++ self.source().normal_value() ++ " -> " ++ self.target().normal_value() ++ "\n"'`.

## Comparisons

### Git comparison (concepts)

- The working copy is committed automatically, and there's no index. Index-style workflows become real commits: `jj split` replaces `git add -p; git commit`, and `jj squash -i` or `jj squash <file>` replaces `git add -p; git commit --amend`.
- Branch names are optional. Detached HEAD is the normal state, and jj tracks every visible head, so nothing is lost or garbage-collected.
- There's no current branch; bookmarks are moved by hand.
- Conflicts can be committed, so no command fails on conflicts. That covers most `rerere` use cases.
- Descendants rebase automatically, along with bookmarks and the working copy.
- "Evil merges" aren't evil: a merge's changes are relative to its auto-merged parents everywhere.
- Bookmarks are identified by name across remotes.
- The op log replaces reflogs, with atomic multi-ref history.
- A single virtual root commit means there's no unborn-branch state and no `--root` or `--orphan` flags.

### Git command table (from `git-command-table.yml`; only the less obvious rows)

| Git | jj |
| --- | --- |
| `git init` | `jj git init [--no-colocate]` |
| `git push --all` | `jj git push --all` (the yml notes it "only affects tracked branches now") |
| `git diff HEAD` | `jj diff` |
| `git diff R^ R` | `jj diff -r R` |
| `git diff R` | `jj diff --from R` |
| `git diff A...B` | `jj diff -r A..B` |
| `git rm --cached f` | `jj file untrack f` (it must match an ignore pattern to stay untracked) |
| `git commit -a` | `jj commit` |
| `git log --oneline --graph` | `jj log -r ::@` |
| `git log --all` | `jj log -r ::` (Git's `--all` also shows jj-hidden commits kept under `refs/jj/*`; use `--exclude refs/jj/* --all`) |
| `git log --branches --not upstream/main` | `jj log` |
| `git log -G stuff` (pickaxe) | `jj log -r 'diff_lines(regex:stuff)'` |
| `git ls-files` | `jj file list` |
| `git grep foo` | `jj file search --pattern=foo` or `rg --no-require-git foo` |
| `git reset --hard` | `jj abandon` (new change) or `jj restore` (empty the current one); both can be undone |
| `git reset --soft HEAD~` | **`jj squash --from @-`** |
| `git restore <paths>` | `jj restore <paths>` |
| `git commit --amend --only` | `jj describe @-` |
| `git commit --fixup=reword:X; git rebase --autosquash X^` | `jj describe X` |
| `git stash` | **`jj new @-`** (the old working copy stays as a sibling; get it back with `jj edit X`) |
| `git switch -c topic main` | `jj new main` |
| `git merge A` | `jj new @ A` |
| `git checkout v1.0.1` | `jj new v1.0.1` |
| `git rebase B A` | `jj rebase -b A -o B` |
| `git rebase --onto B A^ <desc>` | `jj rebase -s A -o B` |
| reorder A-B-C-D to A-C-B-D | `jj rebase -r C --before B` (for several, `jj arrange`) |
| `git commit --amend -a` | `jj squash` |
| `git commit --fixup=X; git rebase --autosquash X^` | `jj squash --into X` |
| move part of X into Y | `jj squash -i --from X --into Y` (Git can't) |
| `git commit -p` | `jj split` (`jj split -r R` for any revision) |
| resolve, then `--continue` | `echo resolved > f; jj squash` |
| `git cherry-pick S` onto D | `jj duplicate S -o D` |
| `git rev-parse --show-toplevel` | `jj workspace root` |
| `git branch -f n R` | `jj bookmark move n --to R` (`jj b m n -t R`; `--allow-backwards` for moves backwards or sideways) |
| `git tag n R` | `jj tag set n -r R` |
| `git tag --contains R` | `jj tag list -r 'R::'` |
| `git tag --merged R` | `jj tag list -r '::R'` |
| `git revert R` | **`jj revert -r R -B @`** |
| `git blame f` | `jj file annotate f` |

### Git compatibility

- **Feature matrix:**
  - Git config: only `[remote "<name>"]` (simple fetch refspecs, used when no branches are given) and `core.excludesFile` are read. Authentication goes through the `git` subprocess.
  - Branches: yes. Tags: partial (lightweight tags can be created; annotated tags can't).
  - `.gitignore`, `.git/info/exclude`, `core.excludesFile`: yes, natively. Newly ignored files may need `jj file untrack`.
  - **`.gitattributes`: no** (#53). **Hooks: no** (#405).
  - Merges, including octopus merges: yes. Detached HEAD and orphan branches: natural.
  - Staging area: ignored; `jj diff` shows Git HEAD to the working copy.
  - `git gc`: probably safe but untested (back up first). jj's own data has no GC or repack yet (#12).
  - Bare repos: `jj git init --git-repo=<bare>`.
  - **Submodules: no**. They're invisible but not lost.
  - Partial clones: no. Shallow clones: kind of (shallow commits get the root as parent; deepening breaks things). Git LFS: no (#80).
  - Signing: yes.
  - **git-worktree: "No"**, per the page; `[DOCS-STALE]` 0.46's colocated workspaces *are* Git worktrees.
  - Sparse: jj's own (`jj sparse`).
- **Ways to set up a repo:**
  - `jj git init <name>` (colocated).
  - `cd git-repo && jj git init`, which adopts the repo in place.
  - `jj git init --git-repo=path` from a fresh directory gives a separate working copy sharing the Git repo's commits; sync manually with `jj git import`/`export`.
  - `jj git clone URL [dest] [--remote name]`.
- **Colocated workspaces:**
  - Import and export happen automatically on every jj command. jj and git can be mixed, but **prefer read-only `git` and mutating `jj`**.
  - jj leaves Git in detached HEAD, so run `git switch` before mutating Git commands.
  - Undo Git's effects with `jj undo` or `jj op restore`; Git changes appear as an "import git refs" op.
  - **Disadvantages:**
    - Interleaving jj and git invites bookmark conflicts and divergence. `[AGENT]` IDEs running `git fetch` in the background cause this unnoticed.
    - Many refs slow every command; `jj util gc` packs refs and helps.
    - Git tools see conflicted files in their stored, unreadable form.
    - A conflicted jj bookmark shows up in Git as `branch@git`.
    - Git's staging area, Git-style conflicts and an unfinished `git rebase` aren't understood.
    - Less safe on NFS or Dropbox.
    - Rare pointer bugs when mutating with both.
  - Non-colocated: the Git repo sits inside `.jj/` with no or stale branches unless you import and export.
- **`jj git colocation enable`** automates this manual process:
  1. `echo '/*' > .jj/.gitignore`.
  2. `mv .jj/repo/store/git .git`.
  3. `echo -n '../../../.git' > .jj/repo/store/git_target`.
  4. `git config --unset core.bare`.
  5. `jj new && jj undo`.
  On Windows, use `Set-Content … -NoNewLine` instead of `echo -n`.
- **Format mapping:**
  - Paths are UTF-8. jj-created commits get `refs/jj/…` refs so Git won't GC them.
  - **A conflicted commit's Git tree** holds `.jjconflict-base-*/` and `.jjconflict-side-*/` directories; the truth is in a `jj:trees` commit header. `[AGENT]` If someone `git switch`es onto one, a `jj st` snapshot "adds" those directories. Recover with `jj abandon`.
  - **The change ID is stored in a `change-id` Git commit header** (reverse hex; written since 0.30; disable with `git.write-change-id-header`). `git commit --amend` keeps it, `git rebase` drops it, and most forges keep it. See it with `git cat-file -p <ref>`; `git log` and `git show` don't print it.

### Jujutsu for Git experts (new points only)

- Index replacements: `jj split file1 file2` puts the named files in the *first* commit. `jj squash file3` moves one file into the parent.
- Fixup without the autosquash dance: `jj squash --into abc file1 file2`; descendants rebase automatically.
- The op log replaces reflog: `jj undo` repeatedly, `jj op log -p` for diffs, `--at-operation`.
- Find an old version with `jj evolog`, then `jj restore --from <old>` to restore it fully or partially.
- **`jj absorb`** moves each working-copy hunk into the commit that last changed those lines (`-i` lets you choose hunks). Lines that several commits touched stay where they are.

### Sapling comparison and related work (brief)

- Undoing `jj commit` brings the working-copy changes back in `jj diff`, because the working copy itself is snapshotted. Sapling's undo leaves the working copy clean.
- Forge workflow: jj has no forge integration. Use `jj git push --change X --change Y …` for stacks; later pushes can be `jj git push -r main..@`, which pushes every bookmark on the current stack. Base branches are set in the forge UI. (Community: jj-stack.)
- Related tools: git-branchless, Sapling (ISL web UI), GitUp, Gitless, Breezy, GitButler.

## Technical details

### Core tenets (the ones relevant to guidance)

- The repo, not the working copy, is the source of truth; commands operate on the commit graph.
- Be modeless. Make it "incredibly hard to lose work". Concurrent modifications must be safe, concurrent edits are allowed on any commit, and stacked diffs should be as easy as possible.

### Architecture (what's useful for a mental model)

- `jj-lib` (no terminal I/O and no user config, so it can run in servers or GUIs) plus `jj-cli`.
- Pluggable backends, each recorded in a type file: commit (`.jj/repo/store/type`), op store, op heads, index, working copy.
- **GitBackend:**
  - Uses gitoxide.
  - Keeps every commit referenced by the op log alive via **`refs/jj/keep/*`**.
  - Data Git has no field for (change ID, predecessors) goes in `.jj/repo/store/extra/`.
  - **A commit created by `git` has no predecessors, and its change ID is its bit-reversed commit ID.**
  - Two commits that differ only in change ID would hash to the same Git ID, so writing the second is an error.
- Key types:
  - `ReadonlyRepo`: the state at one op. It knows each workspace's intended `@`, but not where on disk the workspaces are.
  - `MutableRepo` and `Transaction`: commit a transaction and you get a new view plus op.
  - `RepoLoader` points at `.jj/repo/`.
  - `TreeState`: per-file mtime and size; `snapshot()` and `checkout()`. **Every working copy is sparse**; most just track everything.
  - `WorkingCopy`: TreeState plus workspace name plus the op it was last updated to, which is how staleness is detected.
- Revset evaluation: parse and expand aliases → resolve symbols → optimize → resolve visibility (`visible_heads()`, `all()`) → evaluate in the index.
- `StackedTable`: lock-free key-value storage with parent tables and O(log N) amortized operations; there's no GC yet.
- Templates come from Mercurial, but the top level is an expression, with no `"{node}"` interpolation.
- **Diff editing** creates two very sparse working copies holding only the files being edited, lets the user change the right side, then snapshots it. `[AGENT]` A scripted diff editor only has to write the final content into `$right`.

### Concurrency

- **No lock files.** jj treats local concurrency like remote concurrency and surfaces conflicts instead of preventing them.
- rsync, NFS and Dropbox sync are allowed in principle: commits aren't lost, and conflicts show as `??` and in `jj st`.
  - **Known bug:** the Git backend isn't fully lock-free, so corruption is possible (#2193). Recover with **`jj debug reindex`**.
  - This setup is lightly tested, especially colocated. Bookmark pointers might be lost, but commits won't be.
- **Op log mechanics:**
  - A command loads the latest op, sees a frozen view from then on, and writes its op with that start op as parent. **It can't fail to commit**, short of disk errors.
  - The *next* command notices several op heads and **3-way-merges the views**. Conflicts are recorded in the view, for example "main moved A→B or A→C", giving `main??`. Work continues; only commands that need the conflicted ref fail, e.g. `jj new main` with "resolved to multiple revisions".
  - `[AGENT]` So parallel agents in one repo never block each other or corrupt it. Their races appear afterwards as conflicted bookmarks or divergent changes, and the next jj command reconciles them.
- **Storage:** ops and views are content-addressed. Each op head is an empty file named by its ID in `.jj/repo/op_heads/heads/` (the path the FAQ's watchexec example watches). Add the new head file, then remove the old one: the new file makes the op visible, and readers clean up any stale ones.

### Conflicts (technical)

- A conflicted commit stores an **odd-length ordered list of trees**, read as A+(C−B)+(E−D). A 3-way merge is A+(C−B). Merges are computed lazily and recurse only into subtrees and hunks that can't be resolved trivially.
- **Simplification:** nested conflicts flatten and cancelling terms drop out.
  - Rebasing an unresolved conflict B (on A) from C to D gives D+((C+(B−A))−C) = **D+(B−A)**, so no recursive markers pile up. That's why stale conflicted stacks can be kept rebased onto head.
  - Reverting a conflicted commit simplifies back to the clean state.
- **Same-change rule:** when all sides made the same change, jj resolves to it (like Git and Mercurial; unlike Darcs). It loses information: rebasing onto a commit containing the same change and back again can drop changes (#6369). Disable with `merge.same-change = "keep"`.

### Revset evaluation (only the agent-relevant parts)

- **Aliases expand like macros.** A parameter used twice evaluates its argument twice, which costs time when the argument is expensive.
- Symbols, IDs, bookmarks and tags resolve early, and **an unresolved symbol errors immediately**. Wrap it in `present()` when it may be missing.
- **Filter predicates scan commit by commit**, so they're expensive without a base set: `merges()`, `empty()`, `files()`, `description()`/`subject()`, `mine()`, `author_*()`/`committer_*()`, `diff_lines()`, `conflicts()`, `signed()`, `divergent()`. `[AGENT]` Always intersect them with a bounded range, e.g. `trunk()..@ & conflicts()`, not `conflicts()` alone, on large repos.
- `heads(::@ ~ empty())`-style queries are optimized into `heads_range` and stop early, so "most recent non-empty ancestor" is cheap.
- Negations (`~x`) mean "every visible commit minus x" unless they fold into a range. Prefer `x..y` and `x ~ y` over bare `~`.

## Design docs (`[DESIGN]`: proposals; the shipped behavior may differ)

### `jj converge` (shipped in 0.45, experimental)

- **Ways divergence arises, from the design doc** (more than the guide lists):
  - `jj describe` left open in an editor while another terminal snapshots (**any interactive command can do this**).
  - **Two workspaces:** w2 fetches and rebases while w1 is stale, then w1 snapshots after a file edit.
  - Fetching a commit whose `change-id` header matches a local one.
  - Concurrent snapshots on a distributed filesystem.
- **Algorithm:**
  - Build the *truncated evolution graph* back to the most recent common predecessor (the "evolution fork point").
  - For author, description, parents and tree, merge fork point + Σ(successor − predecessor), counting duplicate edges once (`try_resolve_deduplicating_same_diffs`). That lets the solution pick, for example, description "v3" when both sides went v1→v2 and one then went v2→v3.
  - The description falls back to the user's **merge tool**; the author falls back to a choice prompt.
- **Parents:**
  - They're computed as P⁻ + Σ(Bᵢ⁻ − P⁻). If that doesn't resolve trivially, or the candidate would create new divergence or cycles, the user picks one of the Bᵢ's parent sets.
  - The solution is always a **new commit** whose predecessors are all the Bᵢ.
  - Descendants are rebased and local bookmarks moved.
- Handles one divergent change per run.
- Errors out if the visible graph up to the immutable heads is too large, or the evolution chain is too long (around 50).
- The design proposes a `jj resolve-divergence` alias, but **0.46 doesn't have it** (verified: "unrecognized subcommand").

### `jj run` (design from 2022; shipped in 0.43)

- Design intent:
  - Temporary working copies live under `.jj/` and are reused between runs. Ignored files such as `target/` are kept for incremental builds; `--clean` removes them.
  - The user's working copy is untouched, so editing can continue during a run.
  - Changes are squashed into each revision and descendants rebased (or reparented).
  - Immutable commits are refused.
  - Topological order.
  - Failure strategies continue, stop and fatal (shipped as `--ignore-errors`, with stop-on-failure the default).
  - Operations made inside the run's working copies were to be ignored or isolated.
- The design says the default target is `@` and that **running `jj` inside the temporary working copies won't work** in early versions (TreeState only). `[VERIFY]` Both in 0.46; the CLI notes' to-verify list already includes the default revset.
- Example targets from the design: `jj run 'cargo clippy' -r $revset` and `jj run 'sed …' -r 'mine() & ~remote_bookmarks("origin")'`.

### Tracking branches (design from the 0.8 era; shipped long ago; mostly background)

- Each remote ref has a state, *new* (untracked) or *tracking*. `@git` is a pseudo-remote that mirrors the backing Git repo's `refs/heads`.
- Import merges `[local, new_remote] − [known_remote]` only for tracking refs. Export copies jj's view to Git, but **won't overwrite a Git ref changed since the last import**.
- `jj op restore` **never rolls back `git_refs`** (the record of last-imported refs). `[AGENT]` After undoing a fetch in a colocated repo, the Git-side refs can lag until the next export.
- A deleted bookmark can't be pushed to an untracked remote, because it's a no-op (track it first). Fetching a branch deleted remotely abandons its commits only when it was tracked.
- Still open in the design: pushing to every tracking remote (#1278), tracking under a different local name, and a "private" state (now covered by `git.private-commits`).

### Secure config (implemented: repo and workspace config live outside the repo)

- The threat is the "zip file problem": a repo whose config contains a malicious `fix.tools` command runs it on `jj fix`.
- **Layout:**
  - `.jj/repo/config-id` and `.jj/workspace-config-id` hold random IDs.
  - The config itself lives in `~/.config/jj/repos/<id>/config.toml` (and `workspaces/<id>/`), next to `metadata.binpb`, which records the repo's path.
  - Any in-repo `config.toml` is unused, apart from legacy migration (symlinked or read-only).
- **Copy vs move:**
  - If the recorded path no longer exists, it's a move, and the path is updated.
  - Otherwise jj writes a probe file to see whether this is the same directory reached by a link or mount. If it isn't, it's a **copy**, which gets a *new* ID and a copy of the config the next time jj runs there.
  - `[AGENT]` A `cp -r` of a repo carries the repo config forward, frozen at copy time.
- `jj config gc` prunes entries for deleted or moved repos. It asks first, can't tell a delete from a move, and removes only the files it manages.
- Remaining hole: a replay attack that reuses a known config ID; deliberately not handled.

### Repo-managed config (status: **pending implementation**; not in 0.46)

- Proposal: an in-repo `.config/jj/config.toml` read from `@` on the filesystem, with a per-repo trust level (`ignored`, `trusted`, `notify` (warn when the managed file is newer), and later `review`) set by `jj config managed --ignore/notify/trust`. Untrusted, non-TTY runs would ignore it with a warning.
- Today's workaround, as in Chromium: symlink the repo config to a file in the repo. With secure config that means `jj config path --repo`, then a symlink.
- Idioms from the doc:
  - Run a trunk-pinned script via `util exec`: `jj file show -r 'trunk()' upload.py`.
  - Point formatter commands at in-repo config files (`.rustfmt.toml`), not flags.

### Sparse patterns v2 (design; check the status before relying on it)

- Today (per the design, as of 0.13; the current CLI notes show the same surface): sparse patterns are an unordered list of path prefixes stored in working-copy state, so they aren't in the op log.
- The proposal: patterns become ordered `(include|exclude):(dir|files|exact):<path>` rules, "last match wins", canonicalized and **stored in the op store**. That would make sparse changes undoable and cause staleness to be reported through `update-stale`. It also proposes path remapping (`jj map …`, like Perforce client views).
- `[VERIFY]` Whether any of it shipped: the 0.46 `jj sparse set` help shows only `--add`, `--remove` and `--clear`. Treat it as unimplemented.

### Git submodules (aspirational, not implemented)

- Status in 0.46: **submodules aren't supported**. They're invisible in the working copy but not lost (see git compatibility). Since 0.41, pre-existing submodule directories no longer count as checkout conflicts. `TreeEntry.file_type()` can be `git-submodule`, and `TreeValue` prints the recorded commit.
- Plan:
  - Phase 1, read-only: clone, fetch, view, populate the working copy, and update or resolve gitlinks to existing commits.
  - Phase 2: snapshot changes and push.
  - Phase 3: content-aware merges and rebases.
- Storage proposal: each submodule is a **full jj repo** with its own op log, reached only through the superproject. `op restore` in the superproject creates new submodule ops instead of restoring them recursively. Colocated support would need a Git change (`submodule.<name>.gitdir`).
- `[AGENT]` In a repo with submodules, jj won't update or show them. Use `git submodule` commands in a colocated repo, with care.

### Copy tracking (design; mostly unimplemented)

- jj **doesn't record copies**. In the Git backend, renames are detected on the fly where diffs report them, which is where `TreeDiffEntry.status()` `copied`/`renamed` come from.
- The design proposes a per-file `copy_id` pointing into a copy-history DAG stored in trees, so that diff, merge, rebase, log and annotate can follow renames losslessly.
  - Changes would *not* propagate across copies automatically; `jj resolve` would ask.
  - A conflict in the copy ID would hide the file until it's resolved.
- Its 9-step implementation plan is open-ended. The Git representation is unresolved; backfilling would be expensive (13 hours for Nixpkgs with `git --find-copies-harder`).
- `[AGENT]` Consequences for today:
  - Rebasing an edit onto a commit that renamed the file doesn't follow the rename (the design's motivating case, which Mercurial handles).
  - `jj log <path>` doesn't follow renames.
  - A rename in a merge is reported per side.

## Roadmap (no dates; spare-time project)

- Copy and rename tracking, left to each backend to record or detect.
- **Forge integrations** (`jj github submit` / `jj gitlab submit`, possibly built in). None exist in 0.46.
- Submodules (#494).
- A better Rust API for UIs.
- **An RPC API** (`jj api`, giving tools an address to talk to), so tools work with unknown builds and backends. None in 0.46, so tooling parses the CLI.
- An open-source cloud server and caching daemon, a VFS (would make `jj run` working copies cheap), and content-defined chunking for large files.

---

## Synthesis for the skill rewrite

### What the current skill likely gets wrong or misses `[SKILL-STALE]` (confirm in the claim audit)

1. **Revset string patterns default to glob.** `description(foo)` is an exact-match glob; you need `*foo*` or `substring:`. Template `StringPattern` literals are substring matches, so the two languages differ.
2. **Conflict markers are labelled** (`%%%%%%% diff from: <change> <commit> "<desc>"` plus a `\\\\\\\ to:` line), can be longer than 7 characters, and have three styles (`ui.conflict-marker-style`).
3. **Change offsets** (`xyz/0`, `xyz/1`) address hidden and divergent commits; `Commit.change_offset()`.
4. **The `diff_lines*()` family** (and `diff_lines_added`/`removed`), `subject()`, `merge_point()`, `forks()`, `divergent()`, `working_copies()`, `exactly()`, `first_parent()`, `first_ancestors()`.
5. **Workspaces:** `<name>@`, `workspace add --colocate`, `workspace remove` (deletes ignored files too), `forget` (removes the worktree's `.git`), `snapshot.auto-update-stale`, `undo --allow-cross-workspace`. A rewrite from another workspace makes a workspace stale.
6. Config facts the skill should state: repo config lives outside the repo; `JJ_CONFIG=` disables user config; `--when.environments` scoping; `JJ_OP_USERNAME`; `JJ_EDITOR` priority; `ui.diff-formatter = ":git"`; `snapshot.max-new-file-size` (1 MiB new-file limit).
7. **`-o/--onto`** is canonical, with `-d` as an alias. Every command that takes `--into` also takes `--to`.
8. The divergence guide has 5 strategies, and `converge` exists.
9. Templates: `json({k => v})`, `try()`, `replace()`, `.escape_json()`, `.synced()`, `.tracking_ahead_count()`, `List.get/first/last` returning Option, `WorkspaceRef.root()` returning Option, `config()`, `git_web_url()`.
10. Git compatibility: no hooks, no `.gitattributes`, no submodules, no LFS. The change ID lives in a `change-id` Git header that `git rebase` drops. Conflicted commits show `.jjconflict-*` directories to Git.

### Agent primitives to put in the skill `[AGENT]`

- **Non-interactive escapes:**
  - `describe --stdin`; `squash -u` / `-m`; `converge --no-interactive`; `resolve --tool :ours|:theirs|mergiraf`.
  - `split <filesets>` or `split '~foo'`.
  - A scripted `--tool` diff editor that writes `$right` (`[VERIFY]`); `JJ_EDITOR` / `ui.editor` scripts (`[VERIFY]`); the community tool jj-hunk.
- **Safe reads:** `--ignore-working-copy`, `--at-op=@ --ignore-working-copy`, `-G -T` with `json()` or `escape_json()`, `commit_id()`/`change_id()` to dodge symbol priority, `exactly(x,1)` guards, `present()`.
- **Agent environment:** a conditional config scope keyed on `--when.environments`, plus `JJ_OP_USERNAME`, `--no-pager` or `JJ_PAGER`, `ui.diff-formatter=":git"`.
- **Concurrency model:** no locks and no corruption; races surface as `??` bookmarks or divergence, and the next command reconciles. Stale workspaces come from cross-workspace rewrites. Undo is workspace-scoped.
- **Performance:** bound filter predicates with a range (`trunk()..@ & conflicts()`).

### Items for the scratch-repo verify list (combined with the CLI notes' list)

1. `JJ_EDITOR=true` behavior on each editor-opening command.
2. A scripted `--tool` diff editor with `split`, `squash -i` and `commit -i`.
3. Whether `jj run` works inside its temporary working copies, and its default revset.
4. Whether sparse v2 syntax is accepted (expected: no).
5. `snapshot.max-new-file-size`: a warning, or silence?

### Coverage

- Read in full: every page in the nav except the skip list in the header, including all 9 design docs, the roadmap and `git-command-table.yml`. Changelog and CLI reference are covered elsewhere.
- Not read: the `web/docs/` directory in the source tree, an apparently separate Astro/Starlight site that isn't the live "latest" site; it holds its own copies of `config.toml` and `git-command-table.yml`.
