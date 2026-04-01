# Code Review: Refactor Plan Execution Stack

**Review date:** 2026-04-01 (revision 2)  
**Reviewer:** Sandpiper Agent (code review skill, Mode A)  
**Range:** `main..@` (22 commits, +2 since rev 1)  
**Mode:** Diff Review — "Did this stack leave the codebase better than, equal to, or worse than it was?"

---

## Health Summary

| Metric | Value |
|--------|-------|
| Files reviewed (source) | ~30 production TS files + ~10 test files |
| Lints (`bun run check`) | ✅ Clean — zero errors, zero warnings |
| Tests (`bun test`) | ✅ 496 pass, 0 fail |
| Duplication (jscpd, source dirs) | 2.05% lines / 2.24% tokens (23 clones) — acceptable |
| Complexity hotspots (CC > 15) | 0 newly introduced (pre-existing: `moveTask` CC 41, `getBaseCounter` CC 27 in `move.ts`) |
| New files | ~20 production, ~6 test files |
| Deleted files | 3 scratch/debug artifacts |
| `as any` in new code | 0 |
| `@ts-ignore` / `@ts-expect-error` | 0 |

**Overall: 0 blockers, 0 major, 1 minor, 2 nits, 11 positive**

**Conventions checked:** repo `AGENTS.md`, homedir `AGENTS.md`, `~/.sandpiper/agent/docs/code-health.md`, `~/.sandpiper/agent/docs/testing.md`, `.sandpiper/docs/extension-loading.md`, `.sandpiper/docs/pi-api-pitfalls.md`, `.sandpiper/docs/cli-development.md`, `extensions/shell-relay/AGENTS.md`

---

## Commit Stack Overview

| # | Change ID | Summary | Refs |
|---|-----------|---------|------|
| 1 | `vlutortz` | Fix skill directory names (rename `-skill` suffix) | — |
| 2 | `zyrvwpxz` | Set up refactor tooling and create execution tasks | AGENT-43, AGENT-39, SHR-96, TCL-72, AGENT-40, AGENT-41, TCL-73, AGENT-42, TCL-74, TCL-75 |
| 3 | `utmtsrmv` | Remove scratch/debug artifacts and tighten ignores | AGENT-39, AGENT-44, TCL-76 |
| 4 | `srqwnrnt` | Refactor shell-relay into runtime/tools/commands | SHR-96 |
| 5 | `xslunykn` | Split task-cmd into per-subcommand modules | TCL-72 |
| 6 | `munwpxpn` | Deduplicate parseTaskIndex flush logic | AGENT-40 |
| 7 | `rqpnupzl` | Add tests for extracted system extension modules | AGENT-41 |
| 8 | `pzrvoqou` | Add command/helper tests for extracted task subcommands | TCL-73 |
| 9 | `lllurmtr` | Deduplicate remaining low-priority clone hotspots | AGENT-42, TCL-77 |
| 10 | `vvslmkyv` | Refactor history diff sync-point logic into helpers | TCL-74 |
| 11 | `tvkywtuq` | Refactor computeChanges formatting into helpers | TCL-75 |
| 12 | `nkowqmzu` | Add backlog bug for Biome schema drift | AGENT-45 |
| 13 | `yyxnwtno` | Update standup with refactor execution summary | AGENT-39, SHR-96, TCL-72, AGENT-40, AGENT-41, TCL-73, AGENT-42, TCL-74, TCL-75 |
| 14 | `norvqlzt` | Align Biome schema URL with installed CLI version | AGENT-45 |
| 15 | `nswwyvow` | Stabilize process and shell-relay tests under Bun | AGENT-44 |
| 16 | `uyplnsnv` | Close non-reproducible tasks-cli baseline regression | TCL-76 |
| 17 | `zsppmkky` | Extract shared project-counter reader | TCL-77 |
| 18 | `qormzkxu` | Update standup with backlog-fix pass | AGENT-44, AGENT-45, TCL-76, TCL-77 |
| 19 | `vupmqqvy` | Fix: correct misnamed code review skill dir | — |
| 20 | `oqqttpxk` | Add resolveTargetPaths coverage, clarify AnyCommand | TCL-73 |
| 21 | `xuknwmmw` | Address review follow-ups: test stubs, dynamic import, readonly, JSDoc, naming | AGENT-41, SHR-96 |
| 22 | `ntklzkkx` | Add code review document | — |
| 23 | `rvvopyuw` | (empty working copy) | — |

---

## Findings

### ❌ Major

(None — M1 from rev 1 was addressed in `xuknwmmw`.)

---

### ⚠️ Minor

#### m1 (rev 1 m4): `draw-sandpiper.ts` still uses `as` cast for server proxy
**Location:** `draw-sandpiper.ts:49`  
**Severity:** minor  
**What:** The `any` type was replaced with an `AsciiMotionTool` interface and an `as AsciiMotionTool` cast. This is a strict improvement over the previous `any`, but the type assertion still bypasses the type checker at the boundary.  
**Why:** The task (AGENT-42) was specifically about clone cleanup, not type safety, so this is acceptable for scope. Noting for awareness: the proper fix would be to type the `createServerProxy` return value at its definition site.  
**Suggestion:** No action needed in this stack — note for future if `createServerProxy` gets its own type improvements.

---

### 📝 Nits

#### n1 (rev 1 n4): Inconsistent export style between task subcommand modules
**Location:** All `task-*.ts` files  
**Severity:** nit  
**What:** All subcommand files use `export const taskFooCommand = new Command(...)` — consistent and good. But `task-cmd-helpers.ts` exports both `interface` types and `function` helpers at the top level while other helper files in the same directory (e.g., `helpers.ts`) use a different style.  
**Suggestion:** No change needed — noting it's fine as-is. The split between "subcommand wiring" (`helpers.ts`) and "task-specific command helpers" (`task-cmd-helpers.ts`) is clear.

---

### ✅ Positive

#### p1: Shell-relay refactor is structurally excellent
The extraction from a 555-line `index.ts` monolith into `runtime.ts` (247 lines), `types.ts` (51 lines), three command modules, two tool modules, and a shared `withRelaySetup` helper is textbook module decomposition. The `RelayRuntime` interface is clean, well-typed, and creates a clear seam for testing. The orchestrator (`index.ts`, 42 lines) is genuinely thin — it only wires registrations and lifecycle hooks.

#### p2: Task-cmd decomposition preserves CLI contract perfectly
The split from a single 569-line `task-cmd.ts` into 9 focused subcommand files + a 150-line helpers module preserves the exact CLI interface. The orchestrator is now 22 lines of pure wiring. The subcommand integration tests confirm end-to-end behavior for all commands through Commander's real parse pipeline.

#### p3: `withRelaySetup` pattern eliminates duplicated error handling
The `with-relay-setup.ts` module (33 lines) cleanly extracts the setup-or-error-result pattern that was duplicated between `shell_relay` and `shell_relay_inspect` tools. This is a good application of the "extract shared patterns early" principle.

#### p4: Test stabilization (AGENT-44) uses correct, portable patterns
Replacing `vi.waitFor` (unavailable under Bun) with a local polling helper is the right fix — it avoids adding a test utility dependency while remaining idiomatic. The zellij test migration from module-level `vi.mock` to per-test `vi.spyOn` + `afterEach` restore is a strictly better pattern that eliminates cross-test contamination.

#### p5: `readProjectCounter` is a well-placed extraction (TCL-77)
Extracting the index-counter read into `readProjectCounter()` in `index-update.ts` (the module that owns the index) and consuming it from both `move.ts` and `mutate.ts` removes a real clone pair and follows the "shared constants belong in a dedicated module" guideline.

#### p6: Task tracking is exemplary
Every commit references the tasks it addresses. Task statuses were kept current throughout (NOT STARTED → IN PROGRESS → NEEDS REVIEW). The bug task (TCL-76) that proved non-reproducible was closed with thorough investigation notes. This is exactly how the task management conventions should work.

#### p7: History/mutate refactors maintain behavioral equivalence
The `findSyncPoint` extraction in `history.ts` and the `formatScalarFieldChange`/`formatArrayFieldChange` helpers in `mutate.ts` preserve exact behavior (same control flow, same constants) while making the logic composable and testable. The `MAX_DIFF_LOOKAHEAD` named constant replaces the magic number 20.

#### p8: Scratch file cleanup with forward-looking ignore patterns
AGENT-39 not only removes `.tmp-fuzz.mts`, `.tmp-fuzz2.mts`, and `devtools/mcporter.log`, but adds `.tmp-*` and `devtools/*.log` to `.gitignore` to prevent recurrence. Cleaning up *and* preventing is better than just cleaning up.

#### p9: Shell-relay refactor respects framework-independent core boundary
The extension-loading doc and shell-relay AGENTS.md both define a clear architectural boundary: core relay logic (escape, signal, FIFO, snapshot-diff, zellij client) must stay Pi-independent, while extension glue lives in the orchestrator and registration modules. The refactoring moved all Pi-dependent code into `runtime.ts`, `tools/*.ts`, `commands/*.ts`, and `index.ts`, while leaving the six framework-independent modules untouched. The AGENTS.md module table was updated to reflect the new layout. This demonstrates good awareness of the architectural constraint during a large restructuring.

#### p10: `test-helpers.ts` is a well-designed shared test utility (rev 2)
The new `extensions/system/test-helpers.ts` (144 lines) addresses M1 from rev 1 thoroughly. Each builder function returns a typed `Pick<ExtensionAPI, ...>` stub that only exposes the interface slice the corresponding `register*` function actually uses. The stubs are narrowed at call sites via `as Parameters<typeof registerFn>[0]` — a cast from a subset to a superset, which is structurally sound. This replaces the `as never` escape with real interface conformance checking. Good JSDoc header explaining the design intent.

#### p11: `resolveTargetPaths` tests close the coverage gap (rev 2)
Two new tests in `task-cmd-helpers.test.ts` cover the bulk filter happy path (project + status filter → correct match) and the error path (no matches → throws). These are the exact cases m2 from rev 1 called for, with real filesystem fixtures via `setupTasksDir()`. This fully satisfies TCL-73's scope.

---

## Task × Commit Alignment Check

| Task | Status | Commit(s) | Alignment |
|------|--------|-----------|-----------|
| **AGENT-39** | NEEDS REVIEW | `utmtsrmv` | ✅ Scope fully addressed: removed files + ignore patterns |
| **AGENT-40** | NEEDS REVIEW | `munwpxpn` | ✅ Scope fully addressed: `flushCurrentTask` extraction |
| **AGENT-41** | NEEDS REVIEW | `rqpnupzl`, `xuknwmmw` | ✅ Scope fully addressed: tests for all 4 target modules + type-safe stubs |
| **AGENT-42** | NEEDS REVIEW | `lllurmtr` | ✅ Scope fully addressed: archive, project-cmd, migrate, draw-sandpiper cleanups |
| **AGENT-43** | NEEDS REVIEW | `zyrvwpxz` | ✅ Scope fully addressed: mise.toml + tooling setup |
| **AGENT-44** | NEEDS REVIEW | `nswwyvow` | ✅ Scope fully addressed: all 3 identified failures fixed |
| **AGENT-45** | NEEDS REVIEW | `norvqlzt` | ✅ Scope fully addressed: schema URL updated 2.4.8 → 2.4.10 |
| **SHR-96** | NEEDS REVIEW | `srqwnrnt`, `xuknwmmw` | ✅ Scope fully addressed: thin orchestrator + runtime + tools + commands + follow-up fixes |
| **TCL-72** | NEEDS REVIEW | `xslunykn` | ✅ Scope fully addressed: per-subcommand split + shared helpers |
| **TCL-73** | NEEDS REVIEW | `pzrvoqou`, `oqqttpxk` | ✅ Scope fully addressed: helper tests + resolveTargetPaths coverage |
| **TCL-74** | NEEDS REVIEW | `vvslmkyv` | ✅ Scope fully addressed: `findSyncPoint` + named constant |
| **TCL-75** | NEEDS REVIEW | `tvkywtuq` | ✅ Scope fully addressed: scalar/array formatter helpers |
| **TCL-76** | COMPLETE | `uyplnsnv` | ✅ Correctly closed with investigation notes |
| **TCL-77** | NEEDS REVIEW | `zsppmkky` | ✅ Scope fully addressed: `readProjectCounter` extraction |

---

## Ticket Closure Recommendations

### Can close (NEEDS REVIEW → COMPLETE)
- **AGENT-39** — Clean, fully scoped, no follow-up needed.
- **AGENT-40** — Mechanical dedup, straightforward, tests pass.
- **AGENT-42** — Clone hotspots addressed, jscpd confirms improvement.
- **AGENT-43** — Tooling setup, one-shot task.
- **AGENT-44** — All three failures fixed, verified in full suite.
- **AGENT-45** — One-line schema URL bump, verified clean.
- **SHR-96** — Excellent decomposition, fully scoped.
- **TCL-72** — Clean split, integration tests confirm CLI contract.
- **TCL-74** — Focused refactor, behavior preserved.
- **TCL-75** — Focused refactor, behavior preserved.
- **TCL-76** — Already COMPLETE.
- **TCL-77** — Clean extraction, clone pair eliminated.

### Should address before close
- None — all items from rev 1 have been addressed.

### Requires investigation before close
- None.

---

## Recommended Follow-Up Actions

None blocking. The only remaining finding (m1, `draw-sandpiper.ts` type assertion) is acknowledged as out-of-scope for this stack.

---

## Verdict

This stack is a well-executed, large-scope refactoring effort. The code is cleaner, better decomposed, better tested, and more maintainable than before. No correctness regressions were identified. All findings from rev 1 have been addressed: M1 (`as never` → type-safe stubs), m2 (`resolveTargetPaths` tests added), m3 (dynamic import → top-level), n1 (`readonly` added), n2 (JSDoc restored), n3 (naming clarified). Lint and test suites are fully clean (496 pass, 0 fail).

**Recommendation: Approve. All tickets can close.**
