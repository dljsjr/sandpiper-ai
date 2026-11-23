---
title: "Implement and verify the approved build simplification"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-10-20T15:20:03.012Z
updated_at: 2026-11-23T22:02:37.713Z
---

# Implement and verify the approved build simplification

## Current integrated implementation checkpoint

Approved native MCP adoption100–102 is now implemented alongside the root-product build. Current full default gates are86files671tests, zero-warning check and pack in both normal and fresh offline producer layouts. Actual installed own web_search remains the facade; no upstream server tools/config, SDK dependency is explicit and retired application library absent. Packed read-only offline npm/mock-MCP proof and independent read-only review pass with no outstanding findings. This remains NEEDS REVIEW, not DONE;30 stays open and unrelated deferrals/acceptance remain separate.

## Earlier verification and scope record

## Current implementation checkpoint

TOOLS-94–97 are implemented and NEEDS REVIEW; their workers are closed. TOOLS-98 is active. Quiet normal and a new clean-source frozen/offline/scripts-disabled producer both pass bun check with zero warnings,85files/653tests, and pack:cli. No legacy output is needed or emitted. Actual root tarball is verified before mutation; repeat direct packing excludes the previous tarball, offline empty-cache npm/read-only CLI/SDK/theme/native SQLite/jsdom probes pass. Parent corrected Jiti cache flags through an actual RED/GREEN regression. Independent inherited read-only review is complete with no outstanding actionable findings or blockers. The Jiti correction was independently re-reviewed. No final acceptance inferred.

Both earlier findings are addressed: payload assertions run before installation without destructive resource deletion, and integration docs preserve compiled-binary history without suggesting its revival. Archives/settings/WIP/independent copies and exact launcher-only approved changes match baselines. TOOLS-30 stays open; unrelated updater87, Trail43, Shell Relay93 and unapproved dependency/toolchain decisions are not completed by this change. See work plan and TOOLS-98 for detailed evidence and installer limits.

## Earlier planning and scope history (superseded checkpoints)

## Work breakdown complete; implementation not started

TOOLS-94 package/build,95 runtime,96 tests/helper removal,97 docs and98 integrated verification/review are all NOT STARTED. Detailed contracts, ownership and dependencies: .sandpiper/archive/build-simplification-work-plan.md. Preserve existing consumer name and packages/cli/bin launcher paths. Initial parallel lanes are94/95/97, then96 after94/95, then98 after all four.

Doug paused sub-agents because he is fixing a fling bug. No worker was launched or queued, no implementation was substituted, and no product code changed. No launch retries during the hold. This parent remains open; planning completion is not implementation acceptance.

## Earlier planning and scope history

## Implementation resumed

User authorized the recommended root-product-package/one-Bun-build implementation. New granular siblings TOOLS-94/TOOLS-95/TOOLS-96/TOOLS-97/TOOLS-98 track the work under30. Existing test-gap/doc findings are included, not forgotten. Sub-agent launch availability must be established before claiming workers are running. No final acceptance/closure is inferred from this authorization.

## Earlier review history

## Scope-completeness correction

The user challenged the broader simplification coverage. The review below was of implemented changes, not an exhaustive audit of everything retained. It does not support the claim that only final acceptance remains. TOOLS-92 under30 tracks remaining runtime/build/toolchain inventory and recovery of missed decisions/tasks, notably still-bundled mcporter. Accepted resource outcomes stay closed; this review's two findings remain valid. Overall final acceptance is premature until coverage is reconciled. No code changes were made for this correction.

## Review and implementation history

## Full simplification review — current findings

Reviewed source range36bd8ebd331e through060903df040c: original build-topology retirement, portable CLI/asset patch, Trail extraction/temporary bridge, Journal cutover, resource extraction and optional-tree support. This is a same-agent integrated review; no independent reviewer was available. No code changes or closures performed.

### Findings

1. Medium — devtools/packedCli.test.ts:83 removes the entire installed resources tree before retired-skill/prompt absence assertions at117–133 and catalogue validation. Those assertions therefore cannot detect accidentally rebundled resources. Current package is clean by independent tar-entry inspection, but the regression test would accept such a change. Check installed packaged content before removal, then retain the resource-free startup checks.
2. Low — devtools/integration/README.md:126–133 presents the compiled Bun binary smoke as deferred wave-2 work. That target was explicitly retired. Keep historical incident context, but describe the current source RPC lane and built-JS/packed-install coverage without implying compiled-binary support is planned.

### Verification and preservation

Fresh bun check, full87 files/649 tests and pack:cli all passed. Actual tarball16932 entries: only optional theme README under owned resources; no bundled skills/prompts, legacy helper docs or metadata sidecar. Ten current hash/mode/tree comparisons exactly match preserved baselines: prompt archive, five skill archives, global settings, WIP replacement skills, independent Claude review skill and archive LICENSE. All14 migrated project records still match every field/order; a later unrelated project entry remains untouched. No active obsolete build/vendor/helper routes found in the scoped residual scan. Earlier Journal note/guidance/closed-record preservation remains covered by its accepted independent evidence, not newly claimed to have been rerun.

### Boundaries

No new runtime blocker found in the reviewed simplification paths. Existing updater lifecycle defect87 remains separate and is not cleared by this review. Temporary PATH-gated hard-coded Trail bridge remains an accepted limitation under43. Accepted57/58/59 decisions and DONE states are unchanged. This overall review remains open with the two findings above;30 remains IN PROGRESS.

## Earlier acceptance and implementation history

## Current resource acceptance checkpoint

User accepted TOOLS-59. Resource-review subtasks TOOLS-57 (skills), TOOLS-58 (prompts), and TOOLS-59 (optional themes/resources) are all COMPLETE/DONE. No resource inclusion decisions or implementation acceptances remain outstanding. Current verified gates remain bun check clean,87 files/649 tests, and pack:cli including resource-free readonly installation plus stock/custom theme checks.

This overall implementation-review ticket remains NEEDS REVIEW and TOOLS-30 remains IN PROGRESS: the user approved closing59 only, not final overall build acceptance. Unrelated Trail integration, SOP rewrites and updater bug remain separate.

## Earlier checkpoint history

## Current final resource checkpoint — 2026-11-02

Skills and prompt extraction are accepted and COMPLETE. User's revised theme scope is implemented under TOOLS-59 and ready for acceptance: all owned builtin resource directories are optional, stock/custom themes preserved, and resource-free standalone install verified. Final gates: bun check clean,87 files/649 tests,pack:cli all pass.

This overall task remains NEEDS REVIEW and TOOLS-30 remains IN PROGRESS until actual final review/acceptance. Do not close merely because gates pass; TOOLS-59 still needs user acceptance. Unrelated Trail integration/SOP rewrites/updater bug are not completed by this change.

## Earlier checkpoints

## Current resource acceptance — 2026-10-28

User accepted the prompt-removal package: TOOLS-58 and TOOLS-88–91 are COMPLETE/DONE. Skills remain accepted and complete. Theme scaffold TOOLS-59 is the remaining undecided resource review. This overall task remains NEEDS REVIEW and TOOLS-30 remains IN PROGRESS; prompt acceptance does not close overall build acceptance.

## Earlier checkpoint history

## Current resource checkpoint — 2026-10-28

Skills review/extraction remains accepted and COMPLETE. All six prompt templates are now archived unchanged externally and unbundled under TOOLS-58/88–91, ready for user acceptance. Current code/package gates pass87 files/645 tests and bun check with no errors/warnings. Theme scaffold TOOLS-59 is still NOT STARTED and undecided. Overall acceptance remains pending; TOOLS-30 must stay IN PROGRESS.

## Earlier checkpoint history

## Current resource review checkpoint — 2026-10-28

Six-skill inclusion/extraction review is accepted and COMPLETE/DONE under TOOLS-57; mutation and jj implementation tickets TOOLS-79–86 are also COMPLETE/DONE. Current verification is bun check clean, 87 files/642 tests passing without unhandled errors, and packed-install/pack:cli passing with zero built-in skills.

This task remains NEEDS REVIEW and TOOLS-30 remains IN PROGRESS: six prompt templates (TOOLS-58) and the README-only theme scaffold (TOOLS-59) still need their own inclusion/ownership decisions and any agreed implementation. Passing gates or completed skills alone do not constitute final overall acceptance.

## Earlier review and implementation record

## Review status correction — 2026-10-28

Returned to NEEDS REVIEW after premature lead final-completion during bookkeeping. The implemented mechanical cleanup and its test evidence are retained below, but they do not finish or approve the parent's remaining resources review. Final completion requires actual review/acceptance, not only a passing repository gate.

## Earlier implementation and verification history

Implemented and verified the workspace-only topology and the approved resource cleanup. Removed every third-party skill. Moved age, ast-grep, skill-review, and toon byte-for-byte to the separate skills-incubator repository. Flattened the eight retained first-party skills directly under packages/resources/skills/. Updated resource discovery, helper synchronization, prompts, tests, playbooks, and public documentation.

Verification: bun check; bun run test (124 files, 1,220 tests); focused resource and integration tests; direct Sandpiper, Trail, and standup command smokes; archived-file byte comparison; stale-path and third-party sweeps.

## Bookkeeping acceptance — 2026-10-27

Accepted the delivered build-topology and resource simplification. TOOLS-34 subsequently approved portable CLI packing; TOOLS-38/42 extracted Trail and retained its temporary external skill bridge; TOOLS-51 replaced bundled standup with standalone Journal. Those approved changes supersede the earlier helper-retention constraints, not the original completion evidence.

Current verification: bun check passed with zero errors/warnings; bun run test rebuilt package output and passed 87 files / 640 tests, including packed-install, cache-restoration and temporary Trail bridge regressions. Closure requested during the return to build/packaging simplification. Original historical verification is retained above.

---

# Activity Log

## 2026-10-20T16:16:55.915Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-20T16:38:59.476Z

- **description**: added (3 lines)

## 2026-10-20T16:38:59.541Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-20T17:25:23.788Z

- **status**: NEEDS REVIEW → IN PROGRESS
- **description**: 3 lines → updated (1 line)

## 2026-10-20T17:31:02.642Z

- **description**: 1 line → updated (3 lines)

## 2026-10-20T17:31:03.545Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-28T01:17:04.049Z

- **description**: 3 lines → updated (9 lines)

## 2026-10-28T01:17:04.111Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-10-28T14:17:40.200Z

- **status**: COMPLETE → NEEDS REVIEW
- **description**: 9 lines → updated (15 lines)

## 2026-10-28T14:20:52.578Z

- **description**: updated

## 2026-10-28T22:08:09.302Z

- **description**: 15 lines → updated (23 lines)

## 2026-10-28T22:58:05.994Z

- **description**: 23 lines → updated (29 lines)

## 2026-11-02T15:41:23.271Z

- **description**: 29 lines → updated (35 lines)

## 2026-11-02T16:57:37.511Z

- **description**: 35 lines → updated (43 lines)

## 2026-11-02T16:59:53.482Z

- **description**: 43 lines → updated (51 lines)

## 2026-11-02T17:31:54.735Z

- **description**: 51 lines → updated (70 lines)

## 2026-11-02T17:42:32.001Z

- **description**: 70 lines → updated (76 lines)

## 2026-11-02T18:35:59.206Z

- **status**: NEEDS REVIEW → IN PROGRESS
- **description**: 76 lines → updated (82 lines)

## 2026-11-02T18:39:05.289Z

- **description**: 82 lines → updated (90 lines)

## 2026-11-02T22:16:28.067Z

- **description**: 90 lines → updated (98 lines)

## 2026-11-02T22:18:42.387Z

- **description**: updated

## 2026-11-02T22:18:42.462Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-03T03:13:25.873Z

- **description**: 98 lines → updated (104 lines)

## 2026-11-09T19:42:58.750Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:02:37.713Z

- **description**: updated
