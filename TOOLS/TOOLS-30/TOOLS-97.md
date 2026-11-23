---
title: "Document the single-product build and retire obsolete build-only guidance"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-11-02T18:35:58.865Z
updated_at: 2026-11-23T22:02:54.795Z
---

# Document the single-product build and retire obsolete build-only guidance

## Final worker result recovered

Closing the docs worker delivered its final SUCCESS handoff, superseding the transient stopped-before-answer notification below. Worker confirms all18 docs, two legacy-rule deletions, final formatting/local-link/whitelist checks, no remaining command uncertainty, and no forbidden side effects. Parent independently verified all18 formatting/local-link targets and clean active build/doc residuals. Session is closed. This task remains NEEDS REVIEW, not DONE; integrated review is still pending.

## Verification and worker history

## Parent verification complete; ready for review

Worker completed the18-document migration and two unreferenced legacy AST-grep deletions. Its latest notification reports it stopped before answering the final ping, with completed previous handoff intact. No independent latest reply is claimed. Parent inspected the scoped docs/guidance diff, corrected formatting in docs/dev/cli-development.md and packages/core/README.md, and rechecked all18 changed active Markdown documents: Prettier passes; relative local-link targets exist. Active build/doc residual scan is recorded. Runtime/source behavior remains owned by94/95/96; no full-gate claim from this docs slice.

Commands match root product and stable bins, primary pack:cli/root dist, underlying ordinary Bun pack, source type exports/no core emitter, no staging/Turbo/compiled app, Bun1.4.4, JS/map output whitelist, CONTRIBUTING included. Existing developer tooling, historical records and Shell Relay deferral are preserved.

## Earlier worker scope and coordination

## Execution hold lifted

Doug fixed fling and explicitly authorized launching agents with model inheritance. Earlier hold instructions below are superseded. Follow .sandpiper/archive/build-simplification-work-plan.md and its ownership rules. Initial lanes94/95/97 start read-only until lead GO;96 follows94/95 and98 follows all four. The94 worker also owns new devtools/rootProductMetadata.test.ts for TDD of package/bin contracts. No commits, shared installs or full integration builds without lead coordination.

## Earlier work item and hold record

## Execution hold

Doug explicitly paused sub-agent execution while he fixes a fling bug. Work breakdown and ownership are complete in .sandpiper/archive/build-simplification-work-plan.md. No implementation or worker launch occurred. Do not retry fling or substitute solo implementation during this hold. Model and thinking inheritance remain selected for the eventual workers.

## Work item

User authorized a work breakdown and implementation of the recommended root-product-package/one-Bun-build design from TOOLS-92. This is NOT the no-build TypeScript alternative. Read .sandpiper/archive/build-simplification-exploration.md and the work plan when available.

Shared invariants: preserve consumer name sandpiper-ai-cli, current version/piConfig, both command names and existing packages/cli/bin launcher paths (the user's workspace launcher can depend on them). One root product manifest; no nested duplicate CLI product manifest. Root dist owns built entrypoints/chunks. Source module folders stay intact. The root product directly owns docs/license; no staging, generated metadata, custom pack wrapper or compiled executable. Default optional owned resource path is productRoot/packages/resources in both source and built modes; packaged absence valid, explicit resource-root override must remain an existing directory. Custom/global/project/package resources and normal settings behavior remain supported. Pinned patched Pi dependency and offline/read-only installation remain mandatory. Align Bun toolchain declarations with the proven1.4.4 packing behavior without unrelated dependency upgrades.

No Shell Relay revival/assets/removal:93 is deferred. No runtime dependency redesign, mcporter replacement/removal, developer-tool removals, external repo/global configuration/archives/WIP skill changes, pushes or releases. Do not close tasks as DONE on tests alone. TDD: one behavior/test, verify expected RED, minimum GREEN, assess/refactor, then next. Hermetic tests only; no real providers/configuration or install scripts. jj snapshotting must use command-local --config fsmonitor.backend=none; never persist VCS settings. Agents must stay inside assigned file ownership, coordinate conflicts through the lead, and leave version-control commits/full builds/workspace installs to the lead.

Ownership: active root/package/devtools READMEs, public build/CLI/env docs, project build playbooks/indexes and relevant active specs; delete the unreferenced devtools/sgconfig.yml and astgrepRules migration-rule file after confirming no current caller. No source/manifests/test changes, external guidance or historical archives/closed task edits.

Can start against the agreed layout contract in parallel, but finalize after implementation handoff. Explain the one root-dist build and normal root packing, dependency-only install, Bun version requirement, retained test infrastructure, and absence of first-party staged resources. Preserve valid optional-resource/theme and configured package behavior. Replace current stale compiled-binary deferral text (existing33 finding) without rewriting historical evidence. Do not turn proposed mcporter/Shell Relay/toolchain removals into policy.

---

# Activity Log

## 2026-11-02T18:39:04.930Z

- **description**: 9 lines → updated (15 lines)

## 2026-11-02T20:24:04.584Z

- **description**: 15 lines → updated (21 lines)

## 2026-11-02T20:25:34.361Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-02T21:07:57.618Z

- **description**: 21 lines → updated (29 lines)

## 2026-11-02T21:07:57.704Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-02T21:10:55.818Z

- **description**: 29 lines → updated (35 lines)

## 2026-11-09T19:42:59.088Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:02:54.795Z

- **description**: updated
