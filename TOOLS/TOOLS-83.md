---
title: "Unbundle jj while preserving the current skill and leaving its replacement WIP"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-10-28T21:13:13.263Z
updated_at: 2026-11-23T22:02:39.686Z
related:
  - TOOLS-57
  - TOOLS-30
  - AGENT-67
---

# Unbundle jj while preserving the current skill and leaving its replacement WIP

## Accepted and verified closeout — 2026-10-28

JJ extraction is complete. There was no prior incubator jj copy; all 16 original files/188,007 bytes are now preserved with exact paths and modes. No WIP replacement was edited, installed or adopted. Owned source/deployment retired; zero-built-in runtime and available-skill guidance work without archive registration.

Final closeout verification: mutable fixture-array copy resolves TS4104; bun check is clean, full Vitest gate passes 87 files/642 tests with no unhandled errors, and bun run pack:cli passes. Actual tarball has zero built-in skills and no archive/replacement/test-fixture entries. Independent preservation/routing review passed.

User explicitly requested closing all skill-resource review/extraction tickets. This closes the six-skill inclusion/extraction review only: projects, code-review, refactoring, TDD, mutation-testing and jj. It does not close prompt/theme reviews, deferred SOP redesigns, standalone Trail integration, WIP jj replacement AGENT-67, or updater lifecycle bug TOOLS-87.

Implementation changes: Sandpiper qmkzynrn, canonical guidance klxvrytv, Dotfiles vtwqyzno. Historical failure-limit checkpoints below are superseded by this successful closeout on the user's explicit resumption request.

## Earlier scope and progress record

## Stopped at verification failure limit — 2026-10-28

Third final gate stopped at TypeScript TS4104, packages/cli/standalone_resource_discovery.test.ts:50. Invalid assumption: createNeutralCapabilityExtensionFactories returns a mutable extension array; actual return type is readonly InlineExtension[], while DefaultResourceLoader expects InlineExtension[]. The fixture needs a mutable copy before assignment. No fourth patch/retry was made after the failure limit.

Archive is complete: 16 original files/188,007 bytes with exact paths/modes in the separate skills-incubator repository. No previous incubator copy existed. Replacement skills and global settings still match captured fingerprints; WIP replacement was not edited/installed/adopted. Source/deployment removal, optional-routing docs and zero-built-in runtime changes are implemented but UNCOMMITTED across Sandpiper/global-guidance/Dotfiles; not ready for acceptance.

Last runtime gate passed all 642 assertions, including offline packed install, but had an unrelated unhandled stale update callback. That production issue is separately TOOLS-87 NOT STARTED; fixture now uses neutral resource factories to avoid unrelated identity/updater work. Focused discovery tests pass; the final gate must be rerun only after resolving the readonly fixture type. Baseline was 87 files/640 tests; two new optional-directory regressions bring total642.

Do not mark83–86 complete or infer acceptance of79–82. Broader resource review remains open.

User explicitly chose jj extraction and asked to verify the believed incubator copy. Inspection found no jj skill in the separate skills-incubator repository; current bundled skill is 16 files/188,007 bytes. Preserve it unchanged there before removal. WIP replacement is jujutsu-vcs-skill (https://github.com/dljsjr/jujutsu-vcs-skill) under AGENT-67: do not edit, install or adopt it. Retire owned deployment and hard skill requirements with available-skill/current-CLI-doc fallbacks; preserve use-jj-not-git policy. Adapt existing discovery/diagnostic/packed contracts to zero built-ins and make mock-provider RPC skill smoke tests self-contained. Do not redesign VCS SOPs or deferred AGENT-35 policy specs. No archive auto-loading. Mutation TOOLS-79–82 remains NEEDS REVIEW; do not infer its acceptance from this decision. End implementation at NEEDS REVIEW; broader resource review stays open.

---

# Activity Log

## 2026-10-28T21:15:55.638Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-28T21:17:58.857Z

- **description**: updated

## 2026-10-28T21:52:31.422Z

- **description**: 1 line → updated (11 lines)

## 2026-10-28T22:06:42.409Z

- **description**: 11 lines → updated (23 lines)

## 2026-10-28T22:07:28.133Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-28T22:07:28.233Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:02:39.686Z

- **description**: updated
