---
title: "Define the minimal target build and distribution topology"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-10-20T15:20:02.937Z
updated_at: 2026-10-20T16:40:06.694Z
---

# Define the minimal target build and distribution topology

Approved target (Doug, 2026-10-20): retain only the workspace standalone and local helper builds. Retire every unused delivery surface, including the root neutral Pi package, generated npm/Pi artifact, compiled Bun app, Claude Code plugin, and vendoring updater.

Problem and constraints
- The only live product path is ~/.local/bin/sandpiper -> workspace bin -> Bun-run JavaScript bundle.
- Preserve the sandpiper and sandpiper-system-prompt workspace bins, Sandpiper identity/resources/extensions, Trail and standup helper scripts, the local Pi patch, and existing user/project configuration behavior.
- Keep explicit builds. bun install remains dependency-only.
- Generated output stays beside the owning package. Tests must not use real user state.
- No release, npm-install, stock-Pi-package, compiled-executable, or Claude marketplace compatibility remains in scope.

Target build graph
1. bun run build invokes the Turbo package build graph for sandpiper-ai-core, sandpiper-standup-cli, @sandpiper-ai/trail, and sandpiper-ai-cli, then refreshes the ignored Trail/standup executables in packages/resources/skills/sandpiper/*/scripts directly from package-owned dist outputs.
2. packages/cli build type-checks and emits only dist/standalone/sandpiper_standalone.js plus dist/standalone/sandpiper_system_prompt.js and shared chunks. Remove the duplicate dist/sandpiper and dist/sandpiper-system-prompt bundles that existed only for npm assembly.
3. bun run test runs the workspace build followed by the complete Vitest suite. It performs no root artifact assembly, package install smoke, compiled executable build, Claude plugin build, or network download.
4. Focused test:standalone remains. test:distribution, test:standalone-app, test:claude-plugin, prepare/build distribution scripts, and obsolete built-entry scripts are removed.
5. Root dist/ is no longer a staging artifact. The workspace runtime may continue to create its small dist/standalone-package sidecar and Pi asset symlinks; that runtime concern can move later only if it independently causes trouble.

Retired code and metadata
- Remove devtools npm/Pi assembly, generated-package metadata/invariant/install-smoke code, compiled-app assembler/tests, Claude-plugin assembler/tests, and root Claude marketplace metadata.
- Remove packages/adapter-claude-code.
- Remove root pi manifest/keyword and plugins/pi neutral adapters. Keep root piConfig because the workspace runtime still needs Sandpiper branding/config defaults.
- Remove compiled-app-only branches and setup from packages/cli, and prebuilt/generated-Pi-package compatibility that no live path uses. Preserve the source/workspace sidecar and explicit extension/resource factories.
- Remove vendor.txt, devtools/vendor.ts, the package script and Knip entry. Keep the checked-in third-party skill snapshots and licenses as normal reviewed source until separately replaced.

Tests and verification
- Before edits: bun check and full bun run test:vitest baseline.
- During edits: use existing standalone/resource/system-prompt tests as the behavior contract; update tests that intentionally asserted retired surfaces.
- Add/retain a build-topology test that runs the workspace bins and generated helper scripts from package-owned outputs without requiring assembled root package files.
- Final: remove generated output, run bun install if workspace metadata changed, bun check, bun run test, and direct smoke tests for node_modules/.bin/sandpiper, node_modules/.bin/sandpiper-system-prompt, Trail, and standup.
- Search for stale prepare:distribution, standalone-app, claude-plugin, vendor.txt, plugins/pi, npm package install, and root Pi package references; expected matches are zero outside history/archive/task records.

Tradeoff
- This intentionally drops installability and host portability for artifacts nobody uses. Restoring one later means designing it against the actual future harness rather than preserving four speculative compatibility surfaces now.

---

# Activity Log

## 2026-10-20T16:16:36.957Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-20T16:16:37.044Z

- **description**: added (32 lines)

## 2026-10-20T16:16:37.109Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-20T16:40:06.694Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
