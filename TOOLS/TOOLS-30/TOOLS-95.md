---
title: "Resolve runtime metadata and resources from the root product layout"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-11-02T18:35:58.704Z
updated_at: 2026-11-09T19:42:58.944Z
---

# Resolve runtime metadata and resources from the root product layout

## Execution hold lifted

Doug fixed fling and explicitly authorized launching agents with model inheritance. Earlier hold instructions below are superseded. Follow .sandpiper/docs/specs/build-simplification-work-plan.md and its ownership rules. Initial lanes94/95/97 start read-only until lead GO;96 follows94/95 and98 follows all four. The94 worker also owns new devtools/rootProductMetadata.test.ts for TDD of package/bin contracts. No commits, shared installs or full integration builds without lead coordination.

## Earlier work item and hold record

## Execution hold

Doug explicitly paused sub-agent execution while he fixes a fling bug. Work breakdown and ownership are complete in .sandpiper/docs/specs/build-simplification-work-plan.md. No implementation or worker launch occurred. Do not retry fling or substitute solo implementation during this hold. Model and thinking inheritance remain selected for the eventual workers.

## Work item

User authorized a work breakdown and implementation of the recommended root-product-package/one-Bun-build design from TOOLS-92. This is NOT the no-build TypeScript alternative. Read .sandpiper/docs/specs/build-simplification-exploration.md and the work plan when available.

Shared invariants: preserve consumer name sandpiper-ai-cli, current version/piConfig, both command names and existing packages/cli/bin launcher paths (the user's workspace launcher can depend on them). One root product manifest; no nested duplicate CLI product manifest. Root dist owns built entrypoints/chunks. Source module folders stay intact. The root product directly owns docs/license; no staging, generated metadata, custom pack wrapper or compiled executable. Default optional owned resource path is productRoot/packages/resources in both source and built modes; packaged absence valid, explicit resource-root override must remain an existing directory. Custom/global/project/package resources and normal settings behavior remain supported. Pinned patched Pi dependency and offline/read-only installation remain mandatory. Align Bun toolchain declarations with the proven1.4.4 packing behavior without unrelated dependency upgrades.

No Shell Relay revival/assets/removal:93 is deferred. No runtime dependency redesign, mcporter replacement/removal, developer-tool removals, external repo/global configuration/archives/WIP skill changes, pushes or releases. Do not close tasks as DONE on tests alone. TDD: one behavior/test, verify expected RED, minimum GREEN, assess/refactor, then next. Hermetic tests only; no real providers/configuration or install scripts. jj snapshotting must use command-local --config fsmonitor.backend=none; never persist VCS settings. Agents must stay inside assigned file ownership, coordinate conflicts through the lead, and leave version-control commits/full builds/workspace installs to the lead.

Ownership: packages/cli/standalone_bootstrap.ts, standalone_bootstrap.test.ts, sandpiper_standalone.ts, sandpiper_system_prompt.ts, and directly required CLI runtime modules after coordinating with the lead. Do not edit package manifests, bins, public docs, generic resource APIs unless necessary, or packaging/smoke tests owned by the test worker.

Deliver: source and built entrypoints find the real root sandpiper-ai-cli package, SDK branding/asset environment remains set before Pi imports, both modes use optional root-owned packages/resources, no checkout fallback/sidecars/installation writes, invalid explicit overrides still fail usefully, package override and Journal defaults unchanged. Pure fixture unit tests can progress in parallel with the package worker. Hand off source/built loader contract and evidence to the packaging worker.

---

# Activity Log

## 2026-11-02T18:39:04.684Z

- **description**: 9 lines → updated (15 lines)

## 2026-11-02T20:24:01.588Z

- **description**: 15 lines → updated (21 lines)

## 2026-11-02T20:25:33.636Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-02T20:46:43.834Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-09T19:42:58.945Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
