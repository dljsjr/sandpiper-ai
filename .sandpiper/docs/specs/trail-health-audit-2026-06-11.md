# Trail health audit - 2026-06-11

Mode: Explanation / working audit notes.

Task: `TCL-138` - Audit Trail code health with anti-slop lens.

## Aim

Audit Trail as its own cone of attention. The goal is not a line-count target. `12k LoC` is smoke, not a gate. The goal is to make Trail small, simple, clean, and dumb in the good sense: necessary complexity may stay; ornamental complexity is cut.

Additional steering from Doug: Trail is expected to be rewritten in Rust eventually, informed by `~/git/tasks-storage-spike`. Bug finding still matters, but the primary audit goal is port-enabling simplification: make concepts, invariants, and boundaries clean enough to carry into Rust. Rank cleanup candidates by how much they reduce conceptual baggage, not by how much TypeScript furniture they polish before replacement. Every cleanup candidate should answer: does this make the future Rust port easier to reason about?

Port target contrast from the spike/PRD: current TypeScript Trail is state-file canonical - Markdown files are the source of truth, with activity log and diff history as audit accessories. The Rust target is op-log canonical - typed ops are the source of truth, Markdown is a materialized projection, storage lives on an invisible side ref, and Trail owns sync/drift/import/locking. Cleanups that clarify today's state-file rules are valuable when they expose tomorrow's op-log/projection boundaries.

## Scope

In scope:

- `packages/trail/src/**/*.ts`
- `packages/trail/vitest.config.ts` if test setup or package shape matters
- package-local docs/tests only when they explain or constrain source behavior
- `TCL-130/131/132/133` as context inputs, not as the headline

Out of scope:

- generated `packages/trail/dist/**` artifacts unless a generated declaration exposes source drift
- Shell Relay, Chorus/Tattler, standalone bootstrap, extension inventory SSOT
- code edits before the audit ledger has ranked candidates

## Audit rule

Reading is the work. Tools are compression aids.

Dora, `scc`, `lizard`, dead-export scans, duplication scans, churn history, and structural search help aim attention. They are not gospel and they do not carry the verdict. A metric-clean file can still be rotten if it owns a private engine, duplicates a concept, hides a mode barnacle, or fossilizes implementation in tests.

A proper Trail audit eventually reads every source TypeScript file in scope. If we do not do that, call it sampling, not an audit.

The Rust-port lens changes the weighting. Prefer findings that clarify domain concepts and lifecycle invariants over findings that merely polish TypeScript furniture. A bug that exposes an invariant is important. A refactor that makes task identity, storage terrain, or audited writes easier to port is more valuable than a local beautification.

## Concept map seed

| Concept | Likely files | Question |
|---|---|---|
| Task shape / identity | `core/types.ts`, `core/schema.ts`, `core/frontmatter.ts`, `core/patterns.ts` | Is task identity represented once, or split among key strings, paths, parent metadata, tombstones, and index records? |
| Storage / filesystem worldview | `core/fs.ts`, `core/storage-config.ts`, `core/storage-backend.ts`, `core/index-update.ts`, `core/consistency.ts`, `core/archive.ts` | Do traversal and task-store assumptions live in one place or several? |
| Mutation lifecycle | `core/mutate.ts`, `core/move.ts`, `core/archive.ts`, `core/activity-log.ts`, `core/history.ts` | Are validation, content rendering, index refresh, history writes, and activity logs cleanly sequenced or braided? |
| Query/search/filter | `core/query.ts`, `core/search.ts`, `commands/task-list.ts`, `commands/task-show.ts` | Are filtering/searching/rendering separate, or does CLI display leak into query semantics? |
| CLI command surface | `commands/*.ts` | Are commands thin wrappers over core behavior, or do they carry policy? |
| Output/rendering | `core/output.ts`, `core/format.ts`, command files | Is output shape a pure presentation layer? |
| Project metadata | `core/project-metadata.ts`, `commands/project-cmd.ts` | Is project registry behavior coherent with task semantics? |
| Version-control storage | `core/vcs.ts`, `core/auto-commit.ts`, `core/storage-backend.ts`, `commands/storage-cmd.ts` | Are inline/separate/external storage modes explicit enough, or mode-barnacled? |
| Tests | `*.test.ts` | Do tests guard behavior, or fossilize implementation layout? |

## Architect invariant map

These are the load-bearing rules to judge findings against. If a cleanup does not simplify or enforce one of these, it is probably scenery.

| Invariant | Current pressure | Audit question |
|---|---|---|
| Canonical task shape | `Task` is the domain shape; `IndexedTask` should be `Task` plus index metadata. `frontmatter.ts` claims the canonical frontmatter → `Task` mapper, while `index-update.ts` hand-builds the same shape. | Is there exactly one place where parsed frontmatter becomes a domain task, with explicit parent/index adornment after? |
| Task-file terrain | Active tasks live in uppercase project dirs as top-level task files or one-level subtask dirs. Tombstones count for allocation but are not active tasks; `archive/` is preserved but excluded. | Can Trail answer "what counts as a task file?" once, without flag-barnacle traversal code? |
| Dry-run contract | Root `--no-save` says "skip writing to disk and index," but mutation commands do not all honor that equally. | Is dry-run semantics either global and enforced, or explicitly narrowed so the help text tells the truth? |
| Audit/history contract | Ordinary field updates append activity entries and history diffs; move/reference/interactive paths write around that pipeline. | Does every task modification preserve the audit trail promised by the spec, or are some writes invisible except in VCS history? |
| Mutation lifecycle | The healthy shape is: resolve targets → validate intent → compute content/path/reference changes → write through one audited path → update derived index → emit/auto-commit. | Which modules are core lifecycle and which are CLI presentation? Where has policy leaked sideways? |

## Ledger

| Finding | Human judgment | Evidence | Tool signal | Cheapest dumb form | Risk | Gate | Status |
|---|---|---|---|---|---|---|---|
| Index task-shape mapping is parallel to the claimed canonical mapper | Semantic lie / parallel representation. `frontmatter.ts` says `taskFromFrontmatter` is the single canonical mapping, but index construction hand-builds the same task shape and casts raw values. | `core/frontmatter.ts` `taskFromFrontmatter`; `core/index-update.ts` `scanTaskFiles` builds `IndexedTask` manually. | `scanTaskFiles` CC 25; Dora shows `index-update.ts` depends on `frontmatter.ts` but uses only `parseFrontmatter`. | Use `taskFromFrontmatter(taskKey, fm)` and add index-only metadata/parent, or create one explicit indexed-task constructor. | Behavior may shift for malformed frontmatter because the canonical mapper normalizes/canonicalizes values. That may be good; test it deliberately. | Focused `index-update` tests for malformed enum defaults, freeform assignee/reporter canonicalization, optional arrays, and parent injection; existing Trail package tests. | **ADDRESSED.** `scanTaskFiles` now calls `taskFromFrontmatter` + parent + lastIndexedAt. `arrayValue` fixed to wrap scalars. Dead code removed. Three characterization tests added (enum validation, scalar arrays, misfiled project derivation). 359/359 green. |
| Task-file traversal worldview appears duplicated | Same filesystem concept is reimplemented in several modules: find task files, infer parent, scan subtasks, count task files, collect search docs, update references, scan tombstones. This is likely the `walkTaskDirs` seam, but it must be earned from the map. | `patterns.ts` `resolveTaskFile`/`scanHighestNumber`; `index-update.ts` `updateIndex`/`scanTaskFiles`; `consistency.ts` `countTaskFilesOnDisk`; `search.ts` `collectTaskDocumentsInto`; `move.ts` `updateReferencesByScanningTaskFiles`; `archive.ts` project walk. | `scanTaskFiles` CC 25; `countTaskFilesOnDisk` CC 13; Dora shows `patterns.ts` depended on by 14 files. | Extract a deep task-file walker that yields `{ key, project, path, parent? }` and optionally tombstone records, or leave smaller helpers if one abstraction would grow flags. | Wrong abstraction risk: a walker that serves indexing/search/archive/move by mode flags would be worse. | Characterization tests around index, consistency, search scoping, move references, archive exclusion. |
| `search.ts` owns a private BM25 engine | Shelf-miss smoke. This may be justified by tiny dependency-free search, but it is exactly the `history.ts` class of question: why do we own this engine? | `core/search.ts` implements `Bm25SearchIndex`, tokenization, IDF, saturation, scoring, regex, and ripgrep fallback. | `search.ts` is 200 SLOC by `scc`; low per-function CC except traversal and BM25 internals. Tool quiet is not innocence. | Not decided. Options: keep and name why, replace with a shelf dependency, simplify to ripgrep/literal search, or move BM25 behind a clearer boundary. | Search behavior/ranking is user-visible. Do not cut without deciding whether ranking quality matters. | Existing `search.test.ts` plus new rank/scoping tests if behavior changes. |
| Frontmatter parsing is a private YAML subset | Shelf-miss smoke, not yet verdict. It may be acceptable because the task format is intentionally narrow; it may also be a future bug farm because package identity says YAML frontmatter. | `parseFrontmatter` handles simple scalars, quoted strings, arrays, duplicate keys, and ignores full YAML. Package keywords include `yaml-frontmatter`; no YAML parser dependency. | `parseFrontmatter` CC 14; `frontmatter.ts` has 16 reverse dependents. | Either keep the dumb subset and document the exact format as Trail's format, or replace with a shelf YAML/frontmatter parser if full YAML is actually promised. | Parser change could alter stored task interpretation. | `frontmatter.test.ts`, task-format docs, real task fixtures. |
| Root `--no-save` contract is only partly honored | Semantic lie / correctness bug candidate. The root option says skip writing to disk and index, but not every mutation command checks it. | `task-create`, `task-update`, `task-pickup`, `task-complete`, and `task-archive` have `shouldSave` paths; `task-move.ts` always calls `moveTask` and `updateIndex`. Project commands also write, but may be a separate contract decision. | Tool stats do not matter here. The name/option contract lies. | Thread `shouldSave` through move and any other claimed dry-run surface, or narrow the root option contract so it does not claim global mutation suppression. | Fixing may require defining raw/json preview semantics for move. | Add `--no-save` tests for move and any other root commands that should obey it. |
| Some write paths bypass the activity/history contract | Correctness/auditability leak. Trail's spec says every task modification gets an activity-log entry and full-content diff, but only the ordinary field-update path consistently does that. Move/reference/interactive writes can change files without the same audit trail. | `mutate.updateTaskFields` calls `appendActivityEntry`, writes the file, and calls `writeDiff`. `task-update.ts` interactive path writes edited content directly via `writeFileAtomic` + `updateIndex`. `move.ts` writes moved task content, moved subtasks, tombstones, and inbound-reference rewrites without `appendActivityEntry`/`writeDiff`. Spec §7.7 says every task modification MUST append activity; §8.4 says a diff MUST be written for every modification that changes file content. | Tool stats do not matter here. This is an invariant bypass. | Define one audited write helper/pipeline for task-file modifications, then route move/reference/interactive writes through it; or explicitly decide and document narrower audit semantics for move/tombstones before coding. Avoid stuffing this into `updateTaskFields` with flags. | Move history has semantic decisions: old key vs new key history directory, how to summarize path/key/reference changes, and whether reference rewrites get activity entries. Interactive editing needs a generic "manual edit" summary if field diffing is not feasible. | Characterization tests for `task move` kind/path/reference changes creating activity/history; CLI test for `task update -i` using a fake `$EDITOR`; existing `activity-log`/`history` tests. | **IN PROGRESS.** `writeAuditedTaskFile` helper designed and TDD-red tests written. Design: single audited write gate in `mutate.ts`; move-history-identity decision = Option A (history under old key); reference rewrites get history diffs but no activity entries. Open: name reconciliation needed (tests say `writeTaskFileAuditably`, design says `writeAuditedTaskFile`); `historyKey` seam needs a guard test. |
| Keyless bulk mutation is too easy to trigger accidentally | Product/API footgun with real observed blast radius. Bulk update/pickup/complete is useful, but the current affordance lets a query-shaped command mutate every match immediately once any explicit filter exists. Agents are especially likely to treat `-q` as lookup, not "select all matches and write." | `task-cmd-helpers.resolveTargetPaths` allows mutation without a key when any of `--project`, `--filter-status`, or `--search` is present; `pickup`, `update`, and `complete` call it and then write every matched path. `searchTasks` default BM25 returns any positive-score match, so broad/common query terms can match many tasks. Live audit incident: `trail task pickup -p TCL -q "Audit Trail code health with anti-slop lens" --assignee Roux` picked up dozens of TCL tasks. | Tool stats do not matter here. This is command-surface affordance, not local complexity. | Require an explicit bulk intent flag/confirmation contract for keyless mutating commands (for example `--bulk`/`--yes`), and make the error show matched count plus a `--no-save` preview path. Keep noninteractive scripting possible; do not add a TTY-only prompt as the only safety. | Backward compatibility for existing scripts that rely on keyless bulk mutation; need decide whether search should be OR/BM25 ranking vs narrower mutation selection. | CLI tests: keyless mutation without explicit bulk intent refuses after showing count/action; with explicit bulk intent still mutates; `--no-save` previews without writing; broad search query characterization covers multi-match behavior. |

## Implementation progress

### Slice 1: Canonical mapper collapse — DONE

- `arrayValue` in `frontmatter.ts` now wraps scalar strings to single-element arrays (was silently dropping them — bug fix).
- `scanTaskFiles` in `index-update.ts` now calls `taskFromFrontmatter` instead of hand-building `IndexedTask`. Dead code removed: `asString`, `asStringArray`, five unused type imports.
- Three characterization tests added: enum validation, scalar array coercion, misfiled project derivation.
- 359/359 tests green.

### Slice 2: Audited write-through helper — IN PROGRESS

**`writeTaskFileAuditably()` in `mutate.ts`** — the single audited write gate. Takes task path, tasks dir, original content, new content, and field changes. Appends activity log, writes atomically, writes history diff.

**Caller routing:**
| Caller | Current | After |
|---|---|---|
| `updateTaskFields` | Direct writeFileAtomic + writeDiff | `writeTaskFileAuditably` |
| `task-update --interactive` | Direct writeFileAtomic + updateIndex | `writeTaskFileAuditably` for content; updateIndex stays separate |
| `moveTask` main write | Direct writeFileAtomic | `writeTaskFileAuditably` with move-specific summary |
| `moveTask` subtask writes | Direct writeFileAtomic | `writeTaskFileAuditably` with kind-change activity |
| `updateReferencesInFile` | Direct writeFileAtomic | `writeTaskFileAuditably` with reference-rewrite activity |

**Move-history-identity decision: Option A — old key only.**
- History diff lands under the OLD key dir (the key the task had when the change happened).
- `historyKey` parameter on `writeTaskFileAuditably` lets `moveTask` pass the old key.
- New key's history begins at the next write after the move. Prior history stays under the old key.
- Tombstone bridges the gap. Continuity-across-moves is a deliberate port-era decision.
- In the Rust op-log world, a task has a continuous op stream and a move is one op. This question evaporates.

**Reference rewrites:** No activity entries for reference rewrites (mechanically derived, not user-initiated). Downstream files get a history diff (content changed) but no activity entry.

**`--no-save` gap:** `task-move.ts` now honors `--no-save`. Separate seam from the audit/history fix.

**Tombstone writes:** Explicitly out of scope for the audit contract. Tombstones are filesystem metadata (`.moved` files), not task content. The audit contract (§§7.7/8.4) is about task modifications, not directory entries.

**Current status:** 289 core tests green. +700/-120 across 11 files. Commit pending.

## File-level checklist

Doug requested tracking audited status and fixes applied per file. This table tracks which files have been read (audit) and which have had code changes (fixes applied).

| File | Audited | Fixes applied | Notes |
|---|:---:|:---:|---|
| `core/frontmatter.ts` | ✅ | ✅ | `arrayValue` fix: wraps scalars to single-element arrays |
| `core/frontmatter.test.ts` | ✅ | ✅ | New test: scalar array coercion |
| `core/index-update.ts` | ✅ | ✅ | `scanTaskFiles` collapsed onto `taskFromFrontmatter`; dead code removed |
| `core/index-update.test.ts` | ✅ | ✅ | Three new tests: enum validation, scalar arrays, misfiled project derivation |
| `core/mutate.ts` | ✅ | ✅ | `writeTaskFileAuditably` helper added; `updateTaskFields` refactored to use it |
| `core/mutate.test.ts` | ✅ | ✅ | Red tests for `writeTaskFileAuditably` (now green) |
| `core/move.ts` | ✅ | ✅ | `moveTask` wired through helper (main + subtask + reference rewrites) |
| `core/move.test.ts` | ✅ | ✅ | Three new audit trail tests |
| `commands/task-update.ts` | ✅ | ✅ | Interactive edit wired through `writeTaskFileAuditably` |
| `commands/task-move.ts` | ✅ | ✅ | `--no-save` check added |
| `commands/helpers.ts` | ✅ | — | |
| `commands/index-cmd.ts` | ✅ | — | |
| `commands/index-cmd.test.ts` | ✅ | — | |
| `commands/project-cmd.ts` | ✅ | — | |
| `commands/project-cmd.test.ts` | ✅ | — | |
| `commands/storage-cmd.ts` | ✅ | — | |
| `commands/storage-cmd.test.ts` | ✅ | — | |
| `commands/task-archive.ts` | ✅ | — | |
| `commands/task-cmd-helpers.ts` | ✅ | — | |
| `commands/task-cmd-helpers.test.ts` | ✅ | — | |
| `commands/task-cmd.ts` | ✅ | — | |
| `commands/task-complete.ts` | ✅ | — | |
| `commands/task-create.ts` | ✅ | — | |
| `commands/task-list.ts` | ✅ | — | |
| `commands/task-pickup.ts` | ✅ | — | |
| `commands/task-show.ts` | ✅ | — | |
| `commands/task-subcommands.test.ts` | ✅ | — | |
| `commands/task-summary.ts` | ✅ | — | |
| `core/activity-log.ts` | ✅ | — | |
| `core/activity-log.test.ts` | ✅ | — | |
| `core/archive.ts` | ✅ | — | |
| `core/archive.test.ts` | ✅ | — | |
| `core/auto-commit.ts` | ✅ | — | |
| `core/auto-commit.test.ts` | ✅ | — | |
| `core/consistency.ts` | ✅ | — | |
| `core/consistency.test.ts` | ✅ | — | |
| `core/counter.test.ts` | ✅ | — | |
| `core/description.ts` | ✅ | — | |
| `core/editor.ts` | ✅ | — | |
| `core/format.ts` | ✅ | — | |
| `core/fs.ts` | ✅ | — | |
| `core/fs.test.ts` | ✅ | — | |
| `core/history.ts` | ✅ | — | |
| `core/history.test.ts` | ✅ | — | |
| `core/interactive.test.ts` | ✅ | — | |
| `core/migrate.ts` | ✅ | — | |
| `core/migrate.test.ts` | ✅ | — | |
| `core/output.ts` | ✅ | — | |
| `core/output.test.ts` | ✅ | — | |
| `core/patterns.ts` | ✅ | — | |
| `core/project-metadata.ts` | ✅ | — | |
| `core/project-metadata.test.ts` | ✅ | — | |
| `core/query.ts` | ✅ | — | |
| `core/query.test.ts` | ✅ | — | |
| `core/resolution.test.ts` | ✅ | — | |
| `core/schema.ts` | ✅ | — | |
| `core/schema.test.ts` | ✅ | — | |
| `core/search.ts` | ✅ | — | |
| `core/search.test.ts` | ✅ | — | |
| `core/storage-backend.ts` | ✅ | — | |
| `core/storage-backend.test.ts` | ✅ | — | |
| `core/storage-config.ts` | ✅ | — | |
| `core/storage-config.test.ts` | ✅ | — | |
| `core/types.ts` | ✅ | — | |
| `core/vcs.ts` | ✅ | — | |
| `core/vcs.test.ts` | ✅ | — | |
| `index.ts` | ✅ | — | |
| `vitest.config.ts` | ✅ | — | |

## Port-readiness ranking

This is a domain-weight ranking, not an implementation sequence. Rank answers "how much Rust-port ambiguity does this remove?" Sequence answers "what is the cheapest safe slice?" Do not turn this table into a fake project plan. A lower-ranked item may still be the first commit if it cheaply exposes the seam that lets the higher-ranked law land cleanly.

| Rank | Candidate | Domain weight | Earned complexity to preserve | Accidental complexity to delete | Cheapest safe slice / sequencing note |
|---:|---|---|---|---|---|
| 1 | Canonical task state + audited projection write boundary | Port blocker by ambiguity. Rust needs a clear line between parsed task state, mutation intent/op, and rendered Markdown projection. Today the same boundary is blurred by the parallel index mapper and by direct write paths that bypass audit/history. | Manual Markdown edits remain product-visible; activity/history promises matter for TS behavior until the op-log port lands; move/rekey semantics are real domain behavior. | Parallel task shape construction, direct `writeFileAtomic` mutation paths, and a temptation to turn `updateTaskFields()` into a flag casserole. | First name the boundary: parse current task state → apply mutation intent → render/write audited projection. Then either one cut carries both task-shape and audit fixes, or split only if evidence proves separate reasons to change. Characterization tests before code. |
| 2 | Task-file terrain / projection walker | Port blocker if left as scattered traversal lore. The Rust projection/materialization layer needs one answer for "what counts as an active task file, subtask, tombstone, archive, and project terrain?" | Current one-level subtask layout, archive exclusion, tombstone counter behavior, and manual files on disk are real product rules. | Reimplemented walkers in index, consistency, search, move-reference scanning, archive, and counter/tombstone logic. | A deep walker may be the cheapest first implementation slice, but only if it stays a terrain object instead of a mode-flag swamp. Gate with index/search/consistency/move/archive characterization tests. |
| 3 | Bulk mutation and dry-run command contract | Port-important CLI contract and agent-safety issue. Rust can only preserve behavior worth preserving; keyless query-shaped mutation and a partly false global `--no-save` contract should not cross the river unchanged. | Bulk mutation is useful for scripting; dry-run/preview is useful for agents and humans. | Mutating broad search results without explicit bulk intent; help text that claims global no-save while `move` writes anyway. | Define command contract first: explicit bulk intent and truthful preview/no-save semantics. Then add CLI tests before changing behavior. |
| 4 | Frontmatter / task-format parser contract | Drift-import/projection in Rust needs to know whether manual Markdown is "real YAML frontmatter" or Trail's own narrow frontmatter dialect. | A narrow deterministic format may be the right dumb thing; custom parsing can be okay if the product names the limits. | Unspoken YAML promise, duplicated PROJECT.md/task parsing assumptions, and fail-soft casts that let invalid stored state spread. | Either document/test the Trail dialect as the format, or replace with a shelf parser. Do not swap parser behavior without real fixtures. |
| 5 | Private BM25 search engine | Lower port weight: search is user-facing query behavior, not core storage law. Still worth deciding because ranking behavior may affect bulk mutation selection. | Fast dependency-free local search may be enough; regex/ripgrep fallback is user-visible. | Owning a bespoke engine without naming why, plus coupling broad positive-score matches to mutation selection. | Keep only if the reason and rank/scoping tests are explicit; otherwise replace/simplify behind a clearer search boundary. |
| 6 | Separate-worktree storage furniture | Lowest port-readiness weight. The Rust PRD supersedes git worktree/jj workspace storage with side-ref, lock, drift import, and owned sync. | Current behavior matters as migration/back-compat context and existing tests document what users have today. | Polishing subprocess worktree/workspace bootstrap that the Rust storage model intends to retire. | Preserve enough characterization for migration decisions; do not spend cleanup budget beautifying furniture we are moving out of the house. |

## Initial tool-seeded reading signals

These are reading prompts, not verdicts.

| Signal | Notes |
|---|---|
| `packages/trail/src` has 67 TypeScript files, 8,605 source-code lines by `scc` | Source-only count; generated `dist` excluded. |
| Largest source files by `scc` | `core/mutate.test.ts`, `task-subcommands.test.ts`, `query.test.ts`, `core/mutate.ts`, `move.test.ts`, `index-update.test.ts`, `consistency.test.ts`, `core/move.ts`, `project-cmd.test.ts`, `storage-cmd.test.ts`. |
| Highest `lizard` complexity prompts | `getBaseCounter` CC 34, `matchesFilter` CC 32, `scanTaskFiles` CC 25, `formatScalarFieldChange` CC 21, `moveTask` CC 19, `applyMoveFieldUpdates` CC 18. |
| Dora role | Use for code cartography: file/symbol neighborhoods, dependencies, reverse dependencies, references. Metrics are lagniappe. |

## Coverage ledger

All in-scope Trail TypeScript/config files now have at least read-level coverage. This means the audit has graduated from sampling to a real package health audit; the remaining work is ranking and slice design, not basic cartography.

Legend: `unread`, `skimmed`, `read`, `deep-read`.

| File | Status | Notes |
|---|---:|---|
| `packages/trail/src/commands/helpers.ts` | read | Root option handling, load/update index, mutation output. |
| `packages/trail/src/commands/index-cmd.test.ts` | read | CLI index update and auto-rebuild behavior. |
| `packages/trail/src/commands/index-cmd.ts` | read | Thin index update command. |
| `packages/trail/src/commands/project-cmd.test.ts` | read | Project metadata CLI behavior; list only includes projects with tasks. |
| `packages/trail/src/commands/project-cmd.ts` | read | Project metadata command; owns more policy than some task wrappers. |
| `packages/trail/src/commands/storage-cmd.test.ts` | read | Storage init/migrate/sync integration tests; current separate-worktree furniture. |
| `packages/trail/src/commands/storage-cmd.ts` | read | Storage init/sync/migrate wrapper. |
| `packages/trail/src/commands/task-archive.ts` | read | Honors `--no-save`; archive preview path. |
| `packages/trail/src/commands/task-cmd-helpers.test.ts` | read | Helper behavior; no `--no-save` move coverage. |
| `packages/trail/src/commands/task-cmd-helpers.ts` | read | Bulk target resolution, dry-run output helpers. |
| `packages/trail/src/commands/task-cmd.ts` | read | Command aggregator. |
| `packages/trail/src/commands/task-complete.ts` | read | Honors `--no-save`. |
| `packages/trail/src/commands/task-create.ts` | read | Honors `--no-save`. |
| `packages/trail/src/commands/task-list.ts` | read | Search/filter/sort plus hidden parent context. |
| `packages/trail/src/commands/task-move.ts` | read | Does not honor root `--no-save`; writes unconditionally. |
| `packages/trail/src/commands/task-pickup.ts` | read | Honors `--no-save`. |
| `packages/trail/src/commands/task-show.ts` | read | Detail/raw/metadata output. |
| `packages/trail/src/commands/task-subcommands.test.ts` | read | Broad happy-path command tests; no dry-run move test found. |
| `packages/trail/src/commands/task-summary.ts` | read | Summary wrapper. |
| `packages/trail/src/commands/task-update.ts` | read | Honors `--no-save`; interactive path bypasses history. |
| `packages/trail/src/core/activity-log.test.ts` | read | Covers update/pickup/complete activity entries; no move/interactive coverage. |
| `packages/trail/src/core/activity-log.ts` | read | Activity log delimiter/parser; regex parser worth revisiting after mutation lifecycle read. |
| `packages/trail/src/core/archive.test.ts` | read | Archive behavior tests; preserves content, moves parent subtask dirs. |
| `packages/trail/src/core/archive.ts` | read | Archive owns its own project/task traversal. |
| `packages/trail/src/core/auto-commit.test.ts` | read | Separate-branch auto-commit/push tests. |
| `packages/trail/src/core/auto-commit.ts` | read | Auto-commit wrapper for separate/external storage modes. |
| `packages/trail/src/core/consistency.test.ts` | read | Index/disk consistency tests; cardinality-based stale detection. |
| `packages/trail/src/core/consistency.ts` | read | Duplicates task-file traversal/counting. |
| `packages/trail/src/core/counter.test.ts` | read | Counter preservation/rebuild tests, including deletion defense. |
| `packages/trail/src/core/description.ts` | read | Small body/activity-log split helper. |
| `packages/trail/src/core/editor.ts` | read | `$EDITOR` shell string; likely acceptable as user-controlled interactive path, but note if hardening later. |
| `packages/trail/src/core/format.ts` | read | Output formatting; likely simple. |
| `packages/trail/src/core/frontmatter.test.ts` | read | Tests custom YAML subset and canonical mapper. |
| `packages/trail/src/core/frontmatter.ts` | read | Canonical mapper claim plus private frontmatter parser. |
| `packages/trail/src/core/fs.test.ts` | read | Atomic write and gitignore helper tests. |
| `packages/trail/src/core/fs.ts` | read | Tiny; has doc-comment drift around `writeFileAtomic`. |
| `packages/trail/src/core/history.test.ts` | read | Diff behavior tests after library swap. |
| `packages/trail/src/core/history.ts` | read | Now thin wrapper over `diff`. |
| `packages/trail/src/core/index-update.test.ts` | read | Index behavior tests; does not yet prove reuse of canonical mapper. |
| `packages/trail/src/core/index-update.ts` | read | Parallel task mapper and traversal hotspot. |
| `packages/trail/src/core/interactive.test.ts` | read | Description edit helpers, not CLI editor invocation. |
| `packages/trail/src/core/migrate.test.ts` | read | Migration error/recovery coverage only. |
| `packages/trail/src/core/migrate.ts` | read | Inline-to-separate branch migration. |
| `packages/trail/src/core/move.test.ts` | read | Move behavior coverage: kind, reparent, cross-project, references, tombstones; no audit/history expectations. |
| `packages/trail/src/core/move.ts` | read | Move lifecycle is phase-extracted but still central to identity/path/reference semantics. |
| `packages/trail/src/core/mutate.test.ts` | read | Create/update/pickup/complete/counter behavior; ordinary update path only for audit/history. |
| `packages/trail/src/core/mutate.ts` | read | Mutation lifecycle: render, update, activity log, history, counters. |
| `packages/trail/src/core/output.test.ts` | read | JSON/TOON/raw/frontmatter formatting. |
| `packages/trail/src/core/output.ts` | read | Raw/json/toon/frontmatter output helpers. |
| `packages/trail/src/core/patterns.ts` | read | Task key/path regexes plus resolver/scanner helpers. |
| `packages/trail/src/core/project-metadata.test.ts` | read | PROJECT.md render/parse/update tests; mirrors task-frontmatter subset. |
| `packages/trail/src/core/project-metadata.ts` | read | PROJECT.md rendering/parsing/updating. |
| `packages/trail/src/core/query.test.ts` | read | Behavior tests for query filters/sorts/relationships. |
| `packages/trail/src/core/query.ts` | read | Table-driven filter code after TCL-133. |
| `packages/trail/src/core/resolution.test.ts` | read | Completion/resolution invariants. |
| `packages/trail/src/core/schema.test.ts` | read | Index schema migration/future-version tests. |
| `packages/trail/src/core/schema.ts` | read | Index schema migration is small. |
| `packages/trail/src/core/search.test.ts` | read | Covers BM25 rank, regex, ripgrep, scoping. |
| `packages/trail/src/core/search.ts` | read | Private BM25 engine plus search traversal. |
| `packages/trail/src/core/storage-backend.test.ts` | read | Git/jj worktree/workspace bootstrap tests; commit message injection guard. |
| `packages/trail/src/core/storage-backend.ts` | read | VCS subprocess backend. |
| `packages/trail/src/core/storage-config.test.ts` | read | Config precedence/default merge tests. |
| `packages/trail/src/core/storage-config.ts` | read | Storage config merge/defaults. |
| `packages/trail/src/core/types.ts` | read | Canonical domain/index types. |
| `packages/trail/src/core/vcs.test.ts` | read | VCS detection tests; jj wins over colocated git. |
| `packages/trail/src/core/vcs.ts` | read | VCS backend detection. |
| `packages/trail/src/index.ts` | read | Thin Commander root. |
| `packages/trail/vitest.config.ts` | read | Vitest package config. |
