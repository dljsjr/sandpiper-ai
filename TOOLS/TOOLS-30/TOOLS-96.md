---
title: "Replace obsolete build helpers with root-product packaging regressions"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-11-02T18:35:58.783Z
updated_at: 2026-11-23T22:02:49.147Z
depends_on:
  - TOOLS-94
  - TOOLS-95
---

# Replace obsolete build helpers with root-product packaging regressions

## Execution hold lifted

Doug fixed fling and explicitly authorized launching agents with model inheritance. Earlier hold instructions below are superseded. Follow .sandpiper/archive/build-simplification-work-plan.md and its ownership rules. Initial lanes94/95/97 start read-only until lead GO;96 follows94/95 and98 follows all four. The94 worker also owns new devtools/rootProductMetadata.test.ts for TDD of package/bin contracts. No commits, shared installs or full integration builds without lead coordination.

## Earlier work item and hold record

## Execution hold

Doug explicitly paused sub-agent execution while he fixes a fling bug. Work breakdown and ownership are complete in .sandpiper/archive/build-simplification-work-plan.md. No implementation or worker launch occurred. Do not retry fling or substitute solo implementation during this hold. Model and thinking inheritance remain selected for the eventual workers.

## Work item

User authorized a work breakdown and implementation of the recommended root-product-package/one-Bun-build design from TOOLS-92. This is NOT the no-build TypeScript alternative. Read .sandpiper/archive/build-simplification-exploration.md and the work plan when available.

Shared invariants: preserve consumer name sandpiper-ai-cli, current version/piConfig, both command names and existing packages/cli/bin launcher paths (the user's workspace launcher can depend on them). One root product manifest; no nested duplicate CLI product manifest. Root dist owns built entrypoints/chunks. Source module folders stay intact. The root product directly owns docs/license; no staging, generated metadata, custom pack wrapper or compiled executable. Default optional owned resource path is productRoot/packages/resources in both source and built modes; packaged absence valid, explicit resource-root override must remain an existing directory. Custom/global/project/package resources and normal settings behavior remain supported. Pinned patched Pi dependency and offline/read-only installation remain mandatory. Align Bun toolchain declarations with the proven1.4.4 packing behavior without unrelated dependency upgrades.

No Shell Relay revival/assets/removal:93 is deferred. No runtime dependency redesign, mcporter replacement/removal, developer-tool removals, external repo/global configuration/archives/WIP skill changes, pushes or releases. Do not close tasks as DONE on tests alone. TDD: one behavior/test, verify expected RED, minimum GREEN, assess/refactor, then next. Hermetic tests only; no real providers/configuration or install scripts. jj snapshotting must use command-local --config fsmonitor.backend=none; never persist VCS settings. Agents must stay inside assigned file ownership, coordinate conflicts through the lead, and leave version-control commits/full builds/workspace installs to the lead.

Ownership: devtools production helpers and their tests, packages/cli/standalone_cli_smoke.test.ts, standalone_resource_discovery.test.ts, system_prompt_diagnostic.test.ts and pi_asset_paths.test.ts if needed, plus focused new build/pack fixtures. Preserve devtools/integration and jj-isolation fixture unless coordinating a necessary import/path change. No manifests/runtime bootstrap/docs edits.

After package/runtime handoff, delete clean.ts/packCli.ts/stageCliResources.ts and retire tests exclusively about removed Turbo/staging mechanics. Keep meaningful cleanup/relocation invariants covered with the actual declared build/pack commands. Adapt installed tarball test to direct root packing. Assert packaged absence BEFORE any resources deletion (existing33 finding); then prove resource-free readonly operation. Verify patched Pi, correct docs/LICENSE/bin paths, source/built commands, SDK extension imports, stock/custom themes, configured custom skills/prompts and explicit invalid resource overrides. Source root-finder helpers must use the new product identity. No live provider/network or real user state. Full builds/install smoke are serialized by the lead.

---

# Activity Log

## 2026-11-02T18:39:04.806Z

- **description**: 9 lines → updated (15 lines)

## 2026-11-02T20:24:02.758Z

- **description**: 15 lines → updated (21 lines)

## 2026-11-02T20:46:43.902Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-02T21:29:20.115Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-09T19:42:59.015Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:02:49.147Z

- **description**: updated
