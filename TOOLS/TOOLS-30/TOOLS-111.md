---
title: "Collapse the workspace packages into one root manifest"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-11-11T05:36:37.419Z
updated_at: 2026-11-23T22:05:38.818Z
related:
  - TOOLS-92
  - TOOLS-109
  - TOOLS-110
---

# Collapse the workspace packages into one root manifest

## bunfig.toml removed (2026-11-11)

Doug chose to delete it after the probe below. Change tmozzwzk / 42eaf738 follows sntvwxtp and removes bunfig.toml, its description in docs/dev/build-system.md and its trigger in the build playbook. Reason: for a lockfile with configVersion 1, Bun defaults to the isolated linker with workspaces and the hoisted linker without them; the root manifest has no workspaces. Gate in an isolated checkout: frozen install (166 top-level node_modules entries, no .bun store), clean bun check, full serial suite 65 files, 535 tests passed in 43s.

## Full gate passed; bunfig question answered (2026-11-11)

oykttyqt / 1b33b8ff: 65 files, 535 tests passed in 77s, including the real offline packed CLI test. Each ran in a fresh isolated checkout: frozen install, clean bun check, then bun run test --maxWorkers 1 --no-file-parallelism with no filters, retries or timeout changes; source tree clean afterwards.

Without-bunfig probe at the tip sntvwxtp / b28ec60f: with bunfig.toml deleted, a frozen install produced the same hoisted layout (166 top-level node_modules entries, no .bun store) and the full suite passed 65 files, 535 tests in 48s, packing included. With one manifest the hoisted-linker setting changes nothing. bunfig.toml is still in the tree; removing it and its mention in docs/dev/build-system.md awaits Doug.

## Final corrected queue checkpoint (2026-11-11)

Corrected reference and seven implementation units passed full gates; the ninth run stopped at TOOLS-113 with three different existing5-second source-entrypoint smoke timeouts. The guarded runtime-import case did not fail. No retry, new source change or cause attribution followed. TOOLS-122 records the new blocker. Consolidation and two Markdown unit full gates and without-bunfig probe remain unattempted. All agents/processes are stopped and checkouts removed.

## Verification stopped at TOOLS-116 (2026-11-11)

All ten approved implementations are committed and independently reviewed. Six tasks passed full per-commit gates and are NEEDS REVIEW. This task remains IN PROGRESS, not accepted. TOOLS-112 full gate hit the runtime-Pi-import smoke timeout at load below5. Controlled comparison passed that case on112 but reproduced it on the already-full-gated110 predecessor at load2.83. Relevant source/dependencies are identical; root cause is unknown, not a proven112 regression. No source or timeout was changed for the failure.113/111/114 full gates remain unattempted. TOOLS-116 holds exact evidence and is NOT STARTED pending Doug's go for broader diagnosis. Work is at rest.

## Independent check checkpoint (2026-11-11)

Parent/gate independently passed frozen install and the revision-specific bun check with zero errors/warnings. All ten tasks are implemented and independently reviewed with no outstanding actionable findings. Full/per-commit full-test gates remain pending quiet load; no completion or acceptance is claimed.

Fresh dependency install also passed with no workspace links. The504-module build and both built CLI help commands passed under isolated HOME/agent/XDG/offline configuration. Real packing/bunfig proof still awaits quiet load.

## Implementation checkpoint (2026-11-11)

Change oykttyqt collapses to one root manifest/lock, direct owning-module imports, adjacent AutoTOON core, four inline Vitest projects, and normal Knip in bun check. Root identity/bin/runtime dependency pins and Pi patch are unchanged. Worker frozen install and clean check passed; 66 test files before/after (43/8/9/6), 222 focused tests passed. Unused-module Knip canary failed as expected, then clean gate passed after removal. Parent and independent reviews found no outstanding actionable issue; corrected safe-fix docs and TUI core guidance are included.

Status remains IN PROGRESS. Fresh independent verification is running; full build/test/real packing gates remain pending quiet load. bunfig is retained until actual packing proof. Production-only Knip diagnostics for kept/test-only surfaces do not authorize cleanup. This is not verified completion or acceptance.

## Added on 2026-11-10: Knip (inventory row B-6)

Doug decided to repair Knip as part of this task and add it to the bun check gate. With one manifest the config needs one workspace, the two entrypoints packages/cli/sandpiper_standalone.ts and packages/cli/sandpiper_system_prompt.ts, and an ignore list for the dependencies the build leaves external (the Pi packages and jsdom). Remove the packages/cli workspace block and the stale ignore entries. The run must be clean before it joins the gate. Update the Verification section of AGENTS.md, which defines the gate.

## Decision

Doug approved on 2026-11-10 (TOOLS-92 review, inventory rows B-27, B-3 and B-8): collapse the workspace packages into one root manifest, and use one root Vitest config. Not started. Do this after TOOLS-109 and TOOLS-110, which shrink what has to move.

## Facts

- Seven package.json files for one product: the root, packages/core, packages/capability-autotoon, and extensions/autotoon, system, web-fetch and web-search. Tattler and Chorus have none and use the root.
- The six inner manifests declare six dependencies between them (@toon-format/toon, diff, @mozilla/readability, turndown, @types/jsdom, @types/turndown; jsdom and pi-mcp are also in the root). All are bundled at build time.
- 17 source files import sandpiper-ai-core by name. That name resolves through the workspace link, because TOOLS-108 removed the tsconfig path alias. Nothing imports the other packages by name.
- packages/capability-autotoon holds one 58-line source file, core.ts, with the JSON to TOON transform. Its one consumer is extensions/autotoon/autotoon.ts, by relative path. The package is a leftover of an older design in which each feature had a host-neutral package plus one adapter per host. Sandpiper has one host now.
- syncpack, .syncpackrc.json, the check:deps step of bun check, the workspaces field, and the AGENTS.md rule about workspace dependency specifications exist only because of the inner manifests.
- Vitest: the root config has a catch-all project plus three nested configs (packages/core, extensions/web-fetch, extensions/web-search) that differ only in timeouts: 10 seconds for core, 15 for the two web extensions.

## Scope

- One root package.json. Move the inner dependencies to the root. Delete the six inner manifests and the workspaces field.
- Replace the 17 imports of sandpiper-ai-core with relative imports, or choose one other mechanism and say why.
- Move packages/capability-autotoon/src/core.ts and its test beside extensions/autotoon, and delete the package (B-3).
- Remove syncpack, its config and check:deps. Update the bun check script, AGENTS.md, the build playbook and docs/dev/build-system.md.
- One root Vitest config that keeps the three timeouts (B-8).
- Update devtools/rootProductMetadata.test.ts and devtools/packedCli.test.ts, which assert the package layout.

## Not known yet

- Whether bunfig.toml still needs the hoisted linker for packing once there is one manifest. Test it; do not assume.
- The word "capability" also survives in extensions/system/neutral-capability-extension.ts, createNeutralCapabilityExtensionFactories and packages/core/src/background-process-capability.ts. Those are names, not packages. Report them; renaming is not part of this task.

---

# Activity Log

## 2026-11-11T15:54:46.310Z

- **description**: 26 lines → updated (30 lines)

## 2026-11-11T17:27:11.301Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-11T17:43:08.427Z

- **description**: 30 lines → updated (36 lines)

## 2026-11-11T17:58:20.824Z

- **description**: 36 lines → updated (42 lines)

## 2026-11-11T18:20:23.171Z

- **description**: 42 lines → updated (46 lines)

## 2026-11-11T19:21:13.633Z

- **description**: 46 lines → updated (50 lines)

## 2026-11-11T21:09:12.764Z

- **description**: 50 lines → updated (56 lines)

## 2026-11-11T21:09:13.455Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-11T21:22:51.554Z

- **description**: 56 lines → updated (60 lines)

## 2026-11-11T21:49:42.300Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:05:38.818Z

- **description**: updated
