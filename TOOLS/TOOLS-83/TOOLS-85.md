---
title: "Verify skill-free built-ins and self-contained skill RPC coverage"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-10-28T21:15:55.470Z
updated_at: 2026-10-28T22:07:27.697Z
---

# Verify skill-free built-ins and self-contained skill RPC coverage

## Accepted and verified closeout — 2026-10-28

Zero-built-in source/packed discovery verified. Individual RED→GREEN regressions cover missing optional skills category and absent owned discovery path; present/custom/Trail skill support remains. RPC filesystem coverage now uses its own fixture and the unchanged isolated mock provider. Resource-only discovery uses neutral factories with a mutable array copy; no unhandled error is suppressed and production updater code is unchanged.

Final closeout verification: mutable fixture-array copy resolves TS4104; bun check is clean, full Vitest gate passes 87 files/642 tests with no unhandled errors, and bun run pack:cli passes. Actual tarball has zero built-in skills and no archive/replacement/test-fixture entries. Independent preservation/routing review passed; final artifact/preservation checks are recorded in ~/.sandpiper/agent/backups/jj-unbundle-20261028-3NFgBZ/preservation-after.json.

User explicitly requested closing all skill-resource review/extraction tickets. This closes the six-skill inclusion/extraction review only: projects, code-review, refactoring, TDD, mutation-testing and jj. It does not close prompt/theme reviews, deferred SOP redesigns, standalone Trail integration, WIP jj replacement AGENT-67, or updater lifecycle bug TOOLS-87.

Implementation changes: Sandpiper qmkzynrn, canonical guidance klxvrytv, Dotfiles vtwqyzno. Historical failure-limit checkpoints below are superseded by this successful closeout on the user's explicit resumption request.

## Earlier scope and progress record

## Stopped at verification failure limit — 2026-10-28

Third final gate stopped at TypeScript TS4104, packages/cli/standalone_resource_discovery.test.ts:50. Invalid assumption: createNeutralCapabilityExtensionFactories returns a mutable extension array; actual return type is readonly InlineExtension[], while DefaultResourceLoader expects InlineExtension[]. The fixture needs a mutable copy before assignment. No fourth patch/retry was made after the failure limit.

Archive is complete: 16 original files/188,007 bytes with exact paths/modes at ~/git/skills-incubator/skills/jj. No previous incubator copy existed. Replacement skills and global settings still match captured fingerprints; WIP replacement was not edited/installed/adopted. Source/deployment removal, optional-routing docs and zero-built-in runtime changes are implemented but UNCOMMITTED across Sandpiper/global-guidance/Dotfiles; not ready for acceptance.

Last runtime gate passed all 642 assertions, including offline packed install, but had an unrelated unhandled stale update callback. That production issue is separately TOOLS-87 NOT STARTED; fixture now uses neutral resource factories to avoid unrelated identity/updater work. Focused discovery tests pass; the final gate must be rerun only after resolving the readonly fixture type. Baseline was 87 files/640 tests; two new optional-directory regressions bring total642.

Evidence: ~/.sandpiper/agent/backups/jj-unbundle-20261028-3NFgBZ/ contains before.json, snapshot.mjs, archive-verified.json, guide/deployment backups and diagnostic-red.log. Do not mark83–86 complete or infer acceptance of79–82. Broader resource review remains open.

## Verification fixture isolation — 2026-10-28

Second gate passed all 642 assertions and bun check, but caught an unrelated unhandled update-banner callback using stale pi after fixture session disposal. Production bug recorded separately as TOOLS-87, NOT STARTED; production updater code is not changed here. Resource discovery now uses existing neutral capability factories so this resource-only fixture does not start identity/update work. No unhandled error is suppressed; source discovery still exercises the shared resource-discovery implementation with both PATH-gated Trail variants. Focused two-case run passes. Third full gate follows.

## Zero-built-in runtime regressions found and fixed

The first final gate passed bun check and 639/640 tests, but packed --version failed because npm omits the empty skills directory and bootstrap required all three resource categories. Added one focused failing regression; minimal bootstrap change now permits absent skills while still requiring prompts/themes. All 15 bootstrap cases pass.

Installed Pi source confirms explicit nonexistent skill paths emit diagnostics. Added a separate focused failing resource-adapter regression, then omit only absent builtin skill paths. Updated the existing positive mapping fixture to use a real temporary skills directory. All five adapter cases pass; no SDK event/API signature changes. Full gate rerun follows.

The filesystem RPC skill case also demonstrated missing-fixture RED → add standalone fixture GREEN with the existing isolated mock provider. Source discovery RED → preserved/deleted resource GREEN. No live provider calls, replacement adoption or test access to production user state.

## Original scope

Use autonomous one-behavior/test RED→GREEN→REFACTOR. Adapt source discovery, diagnostic and packed contracts for zero built-ins; preserve custom/Trail skill support. Replace the skill RPC smoke test dependency on bundled jj with an isolated repo fixture, using its existing mock-provider harness. No production-state tests or live provider calls.

---

# Activity Log

## 2026-10-28T21:15:55.774Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-28T21:40:24.014Z

- **description**: 1 line → updated (11 lines)

## 2026-10-28T21:49:16.047Z

- **description**: 11 lines → updated (15 lines)

## 2026-10-28T21:52:31.542Z

- **description**: 15 lines → updated (25 lines)

## 2026-10-28T22:06:42.734Z

- **description**: 25 lines → updated (37 lines)

## 2026-10-28T22:07:27.598Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-28T22:07:27.698Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
