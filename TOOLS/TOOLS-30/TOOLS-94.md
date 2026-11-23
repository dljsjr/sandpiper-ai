---
title: "Make the repository root the CLI product and reduce the build to one Bun invocation"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-11-02T18:35:58.620Z
updated_at: 2026-11-23T22:02:37.910Z
---

# Make the repository root the CLI product and reduce the build to one Bun invocation

## Approved launcher compatibility update

Read-only audit found ~/.local/bin/sandpiper invokes repo/node_modules/.bin/sandpiper. An isolated offline Bun1.4.4 fixture confirmed root packages do not get a self-bin link. Doug explicitly approved changing ONLY that target to packages/cli/bin/sandpiper in both the deployed launcher and canonical dotfiles/dot_local/bin/executable_sandpiper AFTER verifying the new build. Parent owns both updates, source-ownership/dirty-state checks, exact backups and preservation proof. Preserve every other byte/argument-handling difference between source and deployed copies. No external edits by workers, no compatibility shim workspace, global links or install hooks. Shared install/first build/bin switch remains lead-serialized.

## Earlier work item and coordination record

## Execution hold lifted

Doug fixed fling and explicitly authorized launching agents with model inheritance. Earlier hold instructions below are superseded. Follow .sandpiper/archive/build-simplification-work-plan.md and its ownership rules. Initial lanes94/95/97 start read-only until lead GO;96 follows94/95 and98 follows all four. The94 worker also owns new devtools/rootProductMetadata.test.ts for TDD of package/bin contracts. No commits, shared installs or full integration builds without lead coordination.

## Earlier work item and hold record

## Execution hold

Doug explicitly paused sub-agent execution while he fixes a fling bug. Work breakdown and ownership are complete in .sandpiper/archive/build-simplification-work-plan.md. No implementation or worker launch occurred. Do not retry fling or substitute solo implementation during this hold. Model and thinking inheritance remain selected for the eventual workers.

## Work item

User authorized a work breakdown and implementation of the recommended root-product-package/one-Bun-build design from TOOLS-92. This is NOT the no-build TypeScript alternative. Read .sandpiper/archive/build-simplification-exploration.md and the work plan when available.

Shared invariants: preserve consumer name sandpiper-ai-cli, current version/piConfig, both command names and existing packages/cli/bin launcher paths (the user's workspace launcher can depend on them). One root product manifest; no nested duplicate CLI product manifest. Root dist owns built entrypoints/chunks. Source module folders stay intact. The root product directly owns docs/license; no staging, generated metadata, custom pack wrapper or compiled executable. Default optional owned resource path is productRoot/packages/resources in both source and built modes; packaged absence valid, explicit resource-root override must remain an existing directory. Custom/global/project/package resources and normal settings behavior remain supported. Pinned patched Pi dependency and offline/read-only installation remain mandatory. Align Bun toolchain declarations with the proven1.4.4 packing behavior without unrelated dependency upgrades.

No Shell Relay revival/assets/removal:93 is deferred. No runtime dependency redesign, mcporter replacement/removal, developer-tool removals, external repo/global configuration/archives/WIP skill changes, pushes or releases. Do not close tasks as DONE on tests alone. TDD: one behavior/test, verify expected RED, minimum GREEN, assess/refactor, then next. Hermetic tests only; no real providers/configuration or install scripts. jj snapshotting must use command-local --config fsmonitor.backend=none; never persist VCS settings. Agents must stay inside assigned file ownership, coordinate conflicts through the lead, and leave version-control commits/full builds/workspace installs to the lead.

Ownership: root package.json, bun.lock, bunfig.toml/mise.toml as needed, turbo.json removal, workspace package metadata/type-export configuration, root build-output policy, packages/cli/bin/* shims and removal of packages/cli/package.json. Preserve the old bin source paths instead of adding compatibility wrappers or moving the user's launcher. Coordinate any tsconfig edit through the lead. Do not edit runtime bootstrap, tests, docs or devtools helpers.

Deliver: accurate build/runtime dependency declarations (current portable external runtime dependencies bundled, source-build dependencies available in workspace), no Turbo/core emission prerequisite, one explicit root-dist cleanup+Bun build, ordinary Bun pack with declared outputs/docs/license and existing consumer identity. Core/capability module boundaries survive; type exports point at source when emission is removed. No installation lifecycle builds. A clean dependency-install and lockfile update must be scheduled with the lead to avoid concurrent node_modules mutation. Provide test/experiment evidence and any assumptions for dependent runtime and test workers.

---

# Activity Log

## 2026-11-02T18:39:04.564Z

- **description**: 9 lines → updated (15 lines)

## 2026-11-02T20:23:59.825Z

- **description**: 15 lines → updated (21 lines)

## 2026-11-02T20:25:33.160Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-02T20:36:08.013Z

- **description**: 21 lines → updated (27 lines)

## 2026-11-02T20:57:26.244Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-09T19:42:58.867Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:02:37.910Z

- **description**: updated
