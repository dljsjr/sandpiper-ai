# Trail health audit - 2026-06-11

Mode: Explanation / working audit notes.

Task: `TCL-138` - Audit Trail code health with anti-slop lens.

## State of this audit (reconstructed 2026-08-12, Roux)

**This audit is OPEN. It is not complete, and no section below should be read as a finish line.**

Written during the Trail extraction scoping, after this document was found to be roughly two
months stale and to disagree with the other two places the audit's state lives. Read this
section before trusting anything under it.

**The audit's state is split across three stores that do not agree:**

| Store | Says | Last moved |
|---|---|---|
| This document | Findings 1–10, coverage "complete" | 2026-06-24 |
| YAAMS (Roux's DB) | Findings 11 and 12, the whole rank-4 dialect thread, an open follow-up | 2026-06-13 |
| `TCL-138` on the board | Nothing past initial scope | 2026-06-11 |

None of the three is the record. The document was the artifact a later session actually
found, so its self-assessment got believed — that is the failure this section exists to stop.

**Known-incomplete by construction.** The audit was a three-hander (Roux, Huginn, Muninn,
with Piper as Librarian). This reconstruction was assembled from **Roux's YAAMS database
only**. Huginn's and Muninn's memory stores were not reachable at the time of writing and
have not been folded in. Assume material is missing, not that this list is the remainder.

**Coverage never reached its own top tier.** The ledger below marks 68 of 68 files `read`
and **zero** `deep-read`, in a legend that defines `deep-read` as a level. "All files read"
is true; "the audit is done" does not follow from it, and the repeated pattern on this task
was a completeness claim that did not survive the next sweep.

**What is actually open** (see the re-sweep section for detail):

- **Finding 10** — search/archive terrain split. Named, deliberately unfixed.
- **Finding 11** — guard cleanup (two SUBTASK guards + `mutate.ts:513`). Behavior-neutral. Status unknown.
- **Rank-4 follow-up** — the frontmatter edit guard detects YAML forms by regex while the
  codebase now owns a real `yaml` parser: a parallel representation, with a live
  false-positive bug. Deferred to a writer-contract cut that does not exist yet.
- **Ranks 1, 2, 3, 5, 6** — no tickets, no slices, untouched beyond what slices 1–2 covered.

**Ranking caveat.** The port-readiness table ranks candidates by how much Rust-port
ambiguity they remove. Doug set the Rust port aside as long-tail work on 2026-08-12. The
*findings* all still hold; the *ordering* is optimizing for a shelved goal. Re-derive the
sequence on current weights before treating that table as a plan.

**Not a blocker for the Trail repo extraction.** Nothing open here gates standalone Trail.
The rank-4 guard bug lives in `mutate.ts` and travels with the code either way.


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
| Preview/dry-run contract | Former root `--no-save` claimed a global no-write mode without enforcing one. It has been deleted; future preview must be explicit architecture, not a flag barnacle. | If preview returns, is it backed by one mutation-plan/persist gate instead of scattered command branches? |
| Audit/history contract | Ordinary field updates append activity entries and history diffs; move/reference/interactive paths write around that pipeline. | Does every task modification preserve the audit trail promised by the spec, or are some writes invisible except in VCS history? |
| Mutation lifecycle | The healthy shape is: resolve targets → validate intent → compute content/path/reference changes → write through one audited path → update derived index → emit/auto-commit. | Which modules are core lifecycle and which are CLI presentation? Where has policy leaked sideways? |

## Ledger

| Finding | Human judgment | Evidence | Tool signal | Cheapest dumb form | Risk | Gate | Status |
|---|---|---|---|---|---|---|---|
| Index task-shape mapping is parallel to the claimed canonical mapper | Semantic lie / parallel representation. `frontmatter.ts` says `taskFromFrontmatter` is the single canonical mapping, but index construction hand-builds the same task shape and casts raw values. | `core/frontmatter.ts` `taskFromFrontmatter`; `core/index-update.ts` `scanTaskFiles` builds `IndexedTask` manually. | `scanTaskFiles` CC 25; Dora shows `index-update.ts` depends on `frontmatter.ts` but uses only `parseFrontmatter`. | Use `taskFromFrontmatter(taskKey, fm)` and add index-only metadata/parent, or create one explicit indexed-task constructor. | Behavior may shift for malformed frontmatter because the canonical mapper normalizes/canonicalizes values. That may be good; test it deliberately. | Focused `index-update` tests for malformed enum defaults, freeform assignee/reporter canonicalization, optional arrays, and parent injection; existing Trail package tests. | **ADDRESSED.** `scanTaskFiles` now calls `taskFromFrontmatter` + parent + lastIndexedAt. `arrayValue` fixed to wrap scalars. Dead code removed. Three characterization tests added (enum validation, scalar arrays, misfiled project derivation). 359/359 green. |
| Task-file traversal worldview appears duplicated | Same filesystem concept is reimplemented in several modules: find task files, infer parent, scan subtasks, count task files, collect search docs, update references, scan tombstones. This is likely the `walkTaskDirs` seam, but it must be earned from the map. | `patterns.ts` `resolveTaskFile`/`scanHighestNumber`; `index-update.ts` `updateIndex`/`scanTaskFiles`; `consistency.ts` `countTaskFilesOnDisk`; `search.ts` `collectTaskDocumentsInto`; `move.ts` `updateReferencesByScanningTaskFiles`; `archive.ts` project walk. | `scanTaskFiles` CC 25; `countTaskFilesOnDisk` CC 13; Dora shows `patterns.ts` depended on by 14 files. | Extract a deep task-file walker that yields `{ key, project, path, parent? }` and optionally tombstone records, or leave smaller helpers if one abstraction would grow flags. | Wrong abstraction risk: a walker that serves indexing/search/archive/move by mode flags would be worse. | Characterization tests around index, consistency, search scoping, move references, archive exclusion. |
| `search.ts` owns a private BM25 engine | Shelf-miss smoke. This may be justified by tiny dependency-free search, but it is exactly the `history.ts` class of question: why do we own this engine? | `core/search.ts` implements `Bm25SearchIndex`, tokenization, IDF, saturation, scoring, regex, and ripgrep fallback. | `search.ts` is 200 SLOC by `scc`; low per-function CC except traversal and BM25 internals. Tool quiet is not innocence. | Not decided. Options: keep and name why, replace with a shelf dependency, simplify to ripgrep/literal search, or move BM25 behind a clearer boundary. | Search behavior/ranking is user-visible. Do not cut without deciding whether ranking quality matters. | Existing `search.test.ts` plus new rank/scoping tests if behavior changes. |
| Frontmatter parsing is a private YAML subset | Shelf-miss smoke, not yet verdict. It may be acceptable because the task format is intentionally narrow; it may also be a future bug farm because package identity says YAML frontmatter. | `parseFrontmatter` handles simple scalars, quoted strings, arrays, duplicate keys, and ignores full YAML. Package keywords include `yaml-frontmatter`; no YAML parser dependency. | `parseFrontmatter` CC 14; `frontmatter.ts` has 16 reverse dependents. | Either keep the dumb subset and document the exact format as Trail's format, or replace with a shelf YAML/frontmatter parser if full YAML is actually promised. | Parser change could alter stored task interpretation. | `frontmatter.test.ts`, task-format docs, real task fixtures. |
| Root `--no-save` contract is only partly honored | Semantic lie / correctness bug candidate. The root option said skip writing to disk and index, but not every mutation command checked it. | Historical state: create/update/pickup/complete/archive had `shouldSave` branches; move wrote unconditionally; project commands wrote too. | Tool stats do not matter here. The name/option contract lied. | Delete `--no-save` wholesale unless/until a real mutation-plan preview gate exists. | Behavior change for scripts that relied on preview-ish command branches; accepted because the flag had no spec/PRD authority. | Grep for `--no-save`/`shouldSave` in source and user-facing docs; full Trail suite; tsc; biome. | **ADDRESSED.** `--no-save` and `shouldSave` removed from source/user docs; future preview captured in `trail-mutation-gate-design.md`. |
| Some write paths bypass the activity/history contract | Correctness/auditability leak. Trail's spec says every task modification gets an activity-log entry and full-content diff, but only the ordinary field-update path consistently does that. Move/reference/interactive writes can change files without the same audit trail. | `mutate.updateTaskFields` calls `appendActivityEntry`, writes the file, and calls `writeDiff`. `task-update.ts` interactive path writes edited content directly via `writeFileAtomic` + `updateIndex`. `move.ts` writes moved task content, moved subtasks, tombstones, and inbound-reference rewrites without `appendActivityEntry`/`writeDiff`. Spec §7.7 says every task modification MUST append activity; §8.4 says a diff MUST be written for every modification that changes file content. | Tool stats do not matter here. This is an invariant bypass. | Define one audited write helper/pipeline for task-file modifications, then route move/reference/interactive writes through it; or explicitly decide and document narrower audit semantics for move/tombstones before coding. Avoid stuffing this into `updateTaskFields` with flags. | Move history has semantic decisions: old key vs new key history directory, how to summarize path/key/reference changes, and whether reference rewrites get activity entries. Interactive editing needs a generic "manual edit" summary if field diffing is not feasible. | Characterization tests for `task move` kind/path/reference changes creating activity/history; CLI test for `task update -i` using a fake `$EDITOR`; existing `activity-log`/`history` tests. | **IN PROGRESS.** `writeAuditedTaskFile` helper designed and TDD-red tests written. Design: single audited write gate in `mutate.ts`; move-history-identity decision = Option A (history under old key); reference rewrites get history diffs but no activity entries. Open: name reconciliation needed (tests say `writeTaskFileAuditably`, design says `writeAuditedTaskFile`); `historyKey` seam needs a guard test. |
| Keyless bulk mutation is too easy to trigger accidentally | Product/API footgun with real observed blast radius. Bulk update/pickup/complete is useful, but the old affordance let a query-shaped command mutate every match immediately once any explicit filter existed. Agents are especially likely to treat `-q` as lookup, not "select all matches and write." | `task-cmd-helpers.resolveTargetPaths` allowed mutation without a key when any of `--project`, `--filter-status`, or `--search` was present; pickup/update/complete then wrote every matched path. Live audit incident: `trail task pickup -p TCL -q "Audit Trail code health with anti-slop lens" --assignee Roux` picked up dozens of TCL tasks. | Tool stats do not matter here. This is command-surface affordance, not local complexity. | Require explicit `--bulk` intent for keyless mutating commands. Keep noninteractive scripting possible; do not add a TTY-only prompt as the only safety. | Backward compatibility for existing scripts that relied on keyless bulk mutation. | CLI tests: keyless mutation without `--bulk` refuses and reports match count/action; with `--bulk` still mutates. Docs/examples show `--bulk` where needed. | **ADDRESSED.** `pickup`, `update`, and `complete` require `--bulk` for keyless writes. |

## Implementation progress

### Slice 1: Canonical mapper collapse — DONE

- `arrayValue` in `frontmatter.ts` now wraps scalar strings to single-element arrays (was silently dropping them — bug fix).
- `scanTaskFiles` in `index-update.ts` now calls `taskFromFrontmatter` instead of hand-building `IndexedTask`. Dead code removed: `asString`, `asStringArray`, five unused type imports.
- Three characterization tests added: enum validation, scalar array coercion, misfiled project derivation.
- 359/359 tests green.

### Slice 2: Audited write-through helper — DONE

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

**Preview/dry-run gap:** The interim `task-move --no-save` repair was superseded by the later decision to delete root `--no-save` wholesale. Future preview belongs behind a real mutation-plan persist/preview gate, not per-command branches.

**Tombstone writes:** Explicitly out of scope for the audit contract. Tombstones are filesystem metadata (`.moved` files), not task content. The audit contract (§§7.7/8.4) is about task modifications, not directory entries.

**Current status:** 379/379 green, tsc clean, biome clean. Committed.

### Re-sweep findings (post-cleanup)

After the initial seven findings were addressed, a re-sweep with fresh eyes found three more:

**Finding 8: `resolveTaskPath` is a dead name alias.** `helpers.ts` re-exports `resolveTaskFile` from `patterns.ts` as `resolveTaskPath` "for backward compat." Four command files import the alias instead of the canonical name. Two names for one function — parallel representation. Fix: kill the alias, use `resolveTaskFile` directly. **ADDRESSED.**

**Finding 9: `resolveTasksRoot` in `mutate.ts` is an unanchored inverse.** `updateTaskFields` takes a `taskPath` and needs `tasksDir` for the audit write. Instead of requiring `tasksDir` as a parameter, it calls `resolveTasksRoot(taskPath)` — a private function that walks up the directory tree looking for an uppercase directory name. This is fragile: it assumes directory naming conventions instead of requiring the caller to pass what it already knows. Compare `moveTask(tasksDir, key, opts)` — it takes `tasksDir` directly. Fix: add `tasksDir` parameter to `updateTaskFields` (and convenience wrappers), kill `resolveTasksRoot`. **ADDRESSED.**

**Finding 10: `collectTaskDocumentsInto` in `search.ts` is a residual parallel traversal.** (See also the 2026-08-12 addendum below — F10 was later traced to a ghost flag and split.) It does recursive directory walking, reads file content eagerly, and doesn't use `walkTaskFiles`. It also doesn't exclude archive directories or enforce project-key structure — it just finds any `.md` file matching `TASK_FILE_RE` anywhere. This is a subtler divergence from the canonical terrain contract. The fix isn't trivial (search needs content, walkTaskFiles yields metadata only), but the Rust port needs one answer for "what files are searchable." Name the gap now; fix when the walker grows content-yielding capability.

### Findings recorded only in YAAMS (added 2026-08-12, Roux)

The sweep continued past Finding 10 and never came back to this document. Recovered from
Roux's memory store; fact ids are Roux-DB-local and unreachable from any other identity.

**Finding 11: guard cleanup.** Two SUBTASK guards plus `mutate.ts:513`. Explicitly
behavior-neutral style cleanup. **Status unknown** — named in a session handoff (fact 346,
2026-06-12) as pending, never confirmed either way. Verify against the code before acting.

**Finding 12: activity-log `from`/`to` semantics — DECIDED, literal.** `FieldChange.from`/
`.to` are display-only: `extractActivityLog` → `formatActivityEntry` renders them straight
back to Markdown, nothing parses `from` back into a canonical `TaskKind`, nothing branches
on it. A literal `banana` in the log pollutes nothing downstream. (fact 347)

**Finding 10, re-traced: it is a ghost flag.** `searchTasks()` can include archived files,
but the display path (`task list -q` → `loadTasks()` → `index.toon`) is active-only because
`walkTaskFiles()` excludes `archive/`. So `--include-archived` in search *alone* returns
archived keys the CLI cannot render. Split into its own slice. (fact 348)

**Rank 4 (frontmatter dialect) is substantially LANDED, not open as the table implies.**
The table row still reads as an unstarted candidate. In fact:

- An A/B probe compared the hand-rolled parser against `yaml@2.9.0` across 578 real task and
  fixture files plus adversarial coercion fixtures. (fact 350)
- **Option A shipped**: reader is permissive (YAML 1.2 failsafe, Postel's law). (fact 352)
- The **dialect is defined** as *the writer's safe round-trip set* — reader permissive,
  documented format = what the surgical writer round-trips, writer guards the gap at the
  edit boundary. This closed the rank-4 one-way door. (fact 353, Piper)
- The write path is **surgical string editing, not parse-object-stringify**; there is no
  `yaml.stringify` anywhere in the writer. (fact 351)
- Refuse-vs-normalize was ruled **refuse-loud** for the parse-only slice; lossless normalize
  is a deliberate *future* cut with its own tests, not a now-option. (fact 353)

**Rank-4 open follow-up — the one with a live bug.** The edit guard
(`assertRoundTrippableFieldForm` / `isRoundTrippableFieldForm` in `mutate.ts`) detects
non-round-trippable YAML forms with **regex heuristics on raw text**, sitting beside the real
`yaml` parser the codebase now owns. That is a parallel representation of YAML-form
knowledge — the same anti-pattern class this audit exists to find.

It has a known false positive: a legitimate plain scalar containing ` &word` or ` *word`
(e.g. `title: Add &ref support`) is flagged non-round-trippable and **refused on edit**,
because the regex cannot distinguish a real YAML anchor from an ampersand mid-scalar.
Fail-loud-safe, never corrupts — but a real usability edge on plausible titles.

Fix: replace regex form-detection with `yaml` parser node-type inspection (`isScalar` plus
block-scalar type, `isMap`, `node.anchor`). Removes the false positive *and* the parallel
representation. Deferred to the true-block-scalar-write-support / lossless-normalize
writer-contract cut. Minor adapter note from the same review: `frontmatterValue()` drops
nested-map values on read (returns `undefined`, key skipped) where the legacy parser gave
`[]` — zero corpus impact, forward-edge only. (fact 355)

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
| `commands/task-move.ts` | ✅ | ✅ | Move writes routed through audited helper; later `--no-save` deleted wholesale |
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
| 3 | Bulk mutation and preview command contract | Port-important CLI contract and agent-safety issue. Rust can only preserve behavior worth preserving; keyless query-shaped mutation and the deleted false global `--no-save` contract should not cross the river unchanged. | Bulk mutation is useful for scripting; dry-run/preview is useful for agents and humans when designed deliberately. | Mutating broad search results without explicit bulk intent; reintroducing preview as scattered branch logic. | Bulk intent is now explicit via `--bulk`; if preview returns, start from the mutation-gate design note and add CLI tests before changing behavior. |
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

All in-scope Trail TypeScript/config files now have at least read-level coverage.

> **Qualified 2026-08-12 (Roux).** The original wording continued: *"This means the audit has
> graduated from sampling to a real package health audit; the remaining work is ranking and
> slice design, not basic cartography."* That conclusion overreaches. Every row below is
> `read`; **not one is `deep-read`**, a tier this table's own legend defines. Read-level
> coverage of every file is a real milestone and it is not the same claim as a finished
> audit — findings 11 and 12 and the entire rank-4 dialect thread were all found *after*
> this line was written, and none of them are recorded above. Treat the table as a
> cartography receipt, not a completeness certificate.

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
| `packages/trail/src/commands/task-archive.ts` | read | Archive command; former `--no-save` branch later deleted. |
| `packages/trail/src/commands/task-cmd-helpers.test.ts` | read | Helper behavior; bulk guard coverage. |
| `packages/trail/src/commands/task-cmd-helpers.ts` | read | Bulk target resolution; keyless writes require `--bulk`. |
| `packages/trail/src/commands/task-cmd.ts` | read | Command aggregator. |
| `packages/trail/src/commands/task-complete.ts` | read | Completion command; keyless writes require `--bulk`; former `--no-save` branch deleted. |
| `packages/trail/src/commands/task-create.ts` | read | Creation command; former `--no-save` branch deleted. |
| `packages/trail/src/commands/task-list.ts` | read | Search/filter/sort plus hidden parent context. |
| `packages/trail/src/commands/task-move.ts` | read | Move command routed through audited write helper; root `--no-save` later deleted. |
| `packages/trail/src/commands/task-pickup.ts` | read | Pickup command; keyless writes require `--bulk`; former `--no-save` branch deleted. |
| `packages/trail/src/commands/task-show.ts` | read | Detail/raw/metadata output. |
| `packages/trail/src/commands/task-subcommands.test.ts` | read | Broad happy-path command tests; bulk/no-save contract coverage updated during cleanup. |
| `packages/trail/src/commands/task-summary.ts` | read | Summary wrapper. |
| `packages/trail/src/commands/task-update.ts` | read | Interactive path now uses audited helper; keyless writes require `--bulk`; former `--no-save` branch deleted. |
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
