# Devtools

Development scripts and build utilities. Not distributed with the package.

## Scripts

| Script                         | Purpose                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assembleDistribution.ts`      | Assembles the generated `dist/` Sandpiper Pi/npm package with copied resources, package outputs, Pi runtime assets, helper CLIs, and npm metadata |
| `vendor.ts`                    | Downloads vendored third-party skills from `vendor.txt`                                                                                           |
| `distPackageJson.ts`           | Generates `dist/package.json` with artifact-owned Sandpiper `piConfig` + `pi` resource paths                                                      |
| `standaloneSandpiperApp.ts`    | Assembles `dist/standalone-sandpiper/` metadata/resources and compiles the standalone app-bundle executable                                       |
| `claudeCodePlugin.ts`          | Assembles `dist/claude-plugin/` resources/manifest and bundles Claude hook scripts                                                                |
| `distribution-invariants.ts`   | Shared helpers for distribution invariant and manifest smoke tests                                                                                |
| `ecosystemPackage.ts`          | Shared helpers for npm/Pi/Claude install-compatibility checks                                                                                     |
| `piPackageArtifactMetadata.ts` | Shared manifest/dependency generation for npm-installable Pi package artifacts                                                                    |
| `clean.ts`                     | Portable workspace clean (removes node_modules, dist, caches)                                                                                     |
| `adoptTrailBoard.ts`           | Adopts one legacy task board in place by creating Trail v2 configuration                                                                          |

## Trail board adoption

Use this utility to make an existing Sandpiper board readable by standalone Trail. It keeps task files, history, indexes, and workspaces unchanged.

From the Sandpiper checkout, inspect one board:

```sh
bun --bun devtools/adoptTrailBoard.ts --dir /path/to/project --tasks-dir .sandpiper/tasks --dry-run
```

Make sure that the source, task directory, and version control values match the board. Apply the same request without `--dry-run`:

```sh
bun --bun devtools/adoptTrailBoard.ts --dir /path/to/project --tasks-dir .sandpiper/tasks
```

The utility creates `.trail/config.json`. An equivalent repeat makes no changes. The task-directory argument is required. Relative paths resolve against `--dir`. Absolute paths remain supported.

To override legacy discovery, add `--config-file <path>`. The source can be a standalone task configuration or a settings file with a `tasks` object.

If configuration conflicts or inputs change, resolve the reported cause before running another dry run. Do not delete task files to resolve a configuration conflict.

If a write fails, inspect the reported path. Staging keeps incomplete JSON out of the canonical path. A new dry run reports whether adoption completed before the error.

This utility does not relocate boards or change installed consumers. The [adoption specification](../.sandpiper/docs/specs/trail-board-adoption.md) describes discovery, preservation, and refusal rules.

## Integration Tests

[`integration/`](./integration/) is the headless CLI/RPC integration-test lane (AGENT-249) --
tests driven through real `pi`/`sandpiper` process spawns instead of mocked extension APIs. See
[`integration/README.md`](./integration/README.md) and
[`.sandpiper/docs/specs/agent-249-headless-cli-integration-harness-design.md`](../.sandpiper/docs/specs/agent-249-headless-cli-integration-harness-design.md).

## Configuration

| File         | Purpose                                 |
| ------------ | --------------------------------------- |
| `vendor.txt` | Third-party skill sources for vendoring |

## Distribution Checks

`bun run test:distribution` is the package-first refactor's primary gate. It builds the generated artifacts before running the distribution, standalone, and Claude plugin smokes; `bun test` alone does not exercise this assembled layout.

Run the distribution invariant and smoke gate with:

```bash
bun run test:distribution
```

This prepares the generated Sandpiper Pi/npm package at `dist/`, verifies source-boundary invariants, checks generated Pi package resource paths, verifies npm/Pi package install metadata and scratch-file pruning, installs an npm-packed Sandpiper artifact with lifecycle scripts disabled, verifies root Pi package loading without Sandpiper identity, runs both dogfood standalone and compiled standalone app smoke tests with temporary agent directories, and validates the Claude plugin artifact plus hook smoke tests.

## Build Flow

```text
bun install
  → install dependencies only

bun run prepare:distribution
  → turbo builds package-owned outputs
  → assembleDistribution.ts:
      → copy sources, package outputs, public docs, and README into dist/
      → copy generated helper CLIs into packaged skills
      → copy extension package.json files
      → generate dist/package.json with npm-compatible package metadata and artifact-owned Pi resource metadata
      → materialize Pi runtime assets under dist/dist/core and dist/dist/modes
      → create dev-mode skill helper copies in packages/resources

bun run prepare:standalone-app
  → copy standalone Sandpiper resources/support packages and public docs to dist/standalone-sandpiper/
  → generate Sandpiper sidecar package.json without Pi resource manifest entries
  → copy Pi internal asset directories required by the app-bundle layout

bun run build:standalone-app
  → run prepare:standalone-app
  → compile dist/standalone-sandpiper/sandpiper with the standalone Bun build plugin

bun run build:claude-plugin
  → run prepare:distribution for generated helper CLIs
  → copy Claude-compatible skills/commands/themes to dist/claude-plugin/ because installed Claude plugins must be self-contained
  → materialize generated skill scripts and bin helpers without external workspace symlinks
  → write .claude-plugin/plugin.json, package.json, and hooks/hooks.json
  → bundle hooks/autotoon-post-tool-use.js for Claude's PostToolUse lifecycle

bun run test:standalone-app
  → verify standalone app metadata/resource assembly
  → compile the app bundle and run help/resource smoke tests from temp agent directories

bun run test:claude-plugin
  → verify Claude plugin metadata/resource assembly
  → exercise the AutoTOON hook package and bundled hook artifact
```

## Pi Runtime Assets

Sandpiper's generated package includes selected Pi runtime internals under `dist/dist/` because npm-installed packages cannot rely on workspace symlinks. Distribution tests assert these paths exist and that package manifests resolve without reaching back into the source tree.
