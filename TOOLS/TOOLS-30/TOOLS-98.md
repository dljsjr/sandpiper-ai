---
title: "Verify and independently review the integrated minimal build"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-11-02T18:35:58.942Z
updated_at: 2026-11-23T22:05:39.946Z
depends_on:
  - TOOLS-94
  - TOOLS-95
  - TOOLS-96
  - TOOLS-97
---

# Verify and independently review the integrated minimal build

## Scoped delivery revision

Sandpiper implementation committed as vnwpkwyp / 4abe9b67 (parent00841d95). Working copy clean after commit. Canonical dotfiles launcher edit intentionally remains uncommitted beside unrelated preserved user work. No push/release or final task acceptance.

## Current integrated evidence (independent review complete; user acceptance pending)

All implementation lanes94–97 are NEEDS REVIEW and their workers are closed. Quiet main checkout: bun check zero errors/warnings;85files/653tests pass; pack:cli pass. Fresh tracked-source copy: frozen offline scripts-disabled install, identical85/653 full suite, check/pack pass, lock unchanged, no prior/emitted CLI/core/capability output. Existing live ignored output was not deleted.

Real direct repack with previous root archive present produced identical16932-entry payload and identical SHA256 0001623f7e1e165929198241f62c42e1b5016a89903340d38e5cb21db4f46e4a; no nested archives. Empty-cache offline npm install with scripts disabled passed. Read-only CLI/SDK/stock-theme probes pass in packed regression. Extra installed read-only native SQLite query (SQLite3.53.4) and jsdom parsing probes pass with zero sidecars.

Nine protected roots, exact launcher-only target updates, modes and three unrelated dirty dotfiles rechecked unchanged. Canonical launcher edit intentionally uncommitted beside unrelated dotfiles; no blanket commit.

Parent caught and corrected a fixture issue: JITI_FS_CACHE path strings enabled the shared default cache. Four fixtures now disable it with false; a real SDK-anchored options regression demonstrated RED then GREEN. Both corrected quiet main and newly copied-source default gates pass85/653, with original timeouts and the identical product artifact.

Independent inherited-model read-only reviewer build-review04648c65348f is active. No final acceptance inferred;30 remains open. No pushes/releases, Shell Relay changes, mcporter/toolchain removals, archive installs or WIP-skill edits.

Limits/findings: documented offline consumer recipe is npm, not Bun. An extra empty-cache Bun1.4.4 consumer install failed dependency-manifest resolution; no upstream-change task or workaround added. Main installed-tree tar includes122 paths absent in clean producer:112 files of a redundant SAME4.12.1 @smithy/node-http-handler copy plus10 old better-sqlite3 Makefile/gyp/stamp metadata, not missing/extra native binaries. Fresh full/native tests pass; no bit-reproducibility claim or pruning wrapper.

## Previous task contract and coordination

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

Lead-owned integration with a read-only independent reviewer after implementation. Reconcile dependency and launcher behavior, review full diffs for scope/quality, classify remaining retained surfaces and explicit deferrals, and ensure the simplification removes machinery rather than moves it into shell blobs. Verify fresh hermetic dependency declarations, clean build and stale-output cleanup, bun check zero errors/warnings, full Vitest, focused source/built/installed probes and actual tarball contents. Offline installs with scripts disabled, readonly runtime, patched Pi/assets, custom resources, launcher paths and absence of retired payload/sidecars are required. Preserve settings/archives/WIP/independent copies; never run real shell installers. Record evidence and leave implementation tasks/33 for user review. No push/release or automatic closure of30.

---

# Activity Log

## 2026-11-02T18:39:05.047Z

- **description**: 7 lines → updated (13 lines)

## 2026-11-02T20:24:05.643Z

- **description**: 13 lines → updated (19 lines)

## 2026-11-02T20:36:08.196Z

- **description**: 19 lines → updated (25 lines)

## 2026-11-02T21:29:20.178Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-02T21:53:55.875Z

- **description**: 25 lines → updated (39 lines)

## 2026-11-02T22:14:00.345Z

- **description**: 39 lines → updated (41 lines)

## 2026-11-02T22:18:42.180Z

- **description**: updated

## 2026-11-02T22:18:42.256Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-02T22:22:26.188Z

- **description**: 41 lines → updated (45 lines)

## 2026-11-09T19:42:59.158Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:02:38.106Z

- **description**: updated

## 2026-11-23T22:05:39.946Z

- **description**: updated
