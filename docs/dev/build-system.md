# Build system reference

Sandpiper is a Bun workspace that emits several generated artifacts: a Sandpiper Pi/npm package assembly, a standalone Sandpiper app bundle, and a Claude Code plugin package.

Use this page as a reference for how the build system is structured. For action-oriented commands, see [How to build and verify Sandpiper changes](build-workflows.md).

## Pipeline stages

Sandpiper's build system has three main stages:

1. **Package builds** compile TypeScript, emit declarations, and bundle package-owned binaries.
2. **Dependency hoisting** installs workspace dependencies into the root `node_modules/`.
3. **Distribution assembly** copies source and generated outputs into the final artifacts under `dist/`.

## Package builds

Only packages that emit distributable artifacts need package build steps.

| Package                           | Build output                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `packages/cli/`                   | Bundled `sandpiper` runtime, standalone alias target, standalone app bundle support files, Pi assets |
| `packages/core/`                  | TypeScript declarations and package dist artifacts                                                   |
| `packages/sandpiper-tasks-cli/`   | Bundled `sandpiper-tasks` CLI                                                                        |
| `packages/sandpiper-standup-cli/` | Bundled `sandpiper-standup` CLI                                                                      |
| `packages/adapter-claude-code/`   | TypeScript declarations and Claude plugin AutoTOON hook bundle                                       |

Extensions are not bundled as runtime entrypoints. Pi loads extension source TypeScript through jiti.

## Task orchestration

Turborepo orchestrates cacheable package build tasks. The root `build:packages` script runs `turbo run build` for the distributable package set used by `prepare:distribution`:

- `sandpiper-ai-core`
- `sandpiper-standup-cli`
- `sandpiper-tasks-cli`
- `sandpiper-ai-cli`

`turbo.json` defines package `build` tasks with dependency-aware ordering (`^build`) and caches package-local `dist/**` outputs. It does not replace Syncpack dependency policy, root Vitest runs, or distribution assembly. `devtools/assembleDistribution.ts` owns generated `dist/` assembly after package builds finish.

## Dependency hoisting

The workspace uses Bun's hoisted linker:

```toml
# bunfig.toml
[install]
linker = "hoisted"
```

Extension dependencies resolve from the root `node_modules/`. Generated artifacts do not contain per-extension `node_modules/` directories.

Package manifests stay compatible with both Bun local development and npm installation:

- Do not use Bun catalog dependency protocols (`catalog:`) in package manifests.
- The root router package uses `workspace:*` for local workspace dependencies so Bun and npm workspace commands remain monorepo-aware.
- Workspace package manifests use npm-compatible exact versions for internal package dependencies because npm rejects nested workspace protocol specs during root installs.
- Registry dependencies, dev dependencies, and peer dependencies use exact versions only: no wildcards, tags, caret ranges, or tilde ranges.
- Generated package artifacts may use tested `file:` dependencies for copied support packages.

`bun run check:deps` enforces source manifest policy with Syncpack. Ecosystem package tests enforce generated package policy.

## Distribution assembly

`devtools/assembleDistribution.ts` assembles generated artifacts. It:

1. Recreates the generated `dist/` package root.
2. Copies extension source trees, shared resources, public `docs/`, and README content.
3. Preserves extension `src/` trees so package-local `pi.extensions` entries resolve.
4. Generates `dist/package.json` with artifact-owned Pi package metadata and an npm `files` whitelist.
5. Materializes Pi internal runtime assets under `dist/dist/modes` and `dist/dist/core` so npm-packed installs do not depend on symlinks.
6. Builds the Dash CLI via mcporter.
7. Copies skill helper executables into packaged skill script directories.

Dependency installation does not build or assemble artifacts. Run `bun run prepare:distribution` explicitly when generated artifacts are needed.

## Repository root as neutral Pi surface

The repository root is intentionally still an installable neutral Pi package surface. Root `package.json` keeps its `pi` manifest routed through provider/package-owned paths:

- `plugins/pi/extensions`
- `packages/resources/skills/...`
- `packages/resources/prompts`
- `packages/resources/themes`

Sandpiper runtime branding lives in root `piConfig` and the `sandpiper` bin. Vanilla Pi resource loading is covered by the root Pi package smoke test and must not load Sandpiper identity, system-prompt, migration, diagnostics, or update behavior.

Root assembly retirement removed top-level implementation ownership; it did not remove the root package's routing and branding role.

## Generated `dist/` package

`dist/` is the generated Sandpiper Pi/npm package assembly. It is not source and is not a dependency manager.

`dist/` contains:

- extension source trees
- skills, prompts, and themes copied from `packages/resources/`
- public documentation copied from top-level `docs/`
- package-owned binaries
- `dist/package.json` with `pi` resource paths and the `sandpiper` bin

`dist/` does not contain:

- `.sandpiper/` operational state, tasks, reviews, internal playbooks, or active specs
- `node_modules/`
- bundled extension runtime output
- nested generated package artifacts such as `claude-plugin` or standalone packages

Runtime npm dependencies resolve from the workspace install. Pi internals look for assets under `<PI_PACKAGE_DIR>/dist/*`, so the generated package materializes Pi's `modes/` and `core/` assets under `dist/dist/` before packing.

## Standalone app bundle

`bun run build:standalone-app` writes `dist/standalone-sandpiper/` with:

- a compiled `sandpiper` executable
- Sandpiper sidecar package metadata
- bundled resources, support packages, and public docs
- Pi internal assets

The standalone assembler bundles `css-tree` JSON/package metadata through a Bun build plugin and leaves optional `canvas` external so jsdom can treat it as unavailable instead of requiring a native sidecar.

## Claude Code plugin artifact

`bun run build:claude-plugin` writes `dist/claude-plugin/` with:

- Claude plugin metadata
- copied skills, commands, and themes
- materialized helper CLIs
- hook configuration
- bundled `hooks/autotoon-post-tool-use.js`
- npm package metadata for `sandpiper-claude-code-plugin`

The plugin package is intentionally self-contained because marketplace-installed Claude plugins are copied into Claude's plugin cache. The plugin manifest does not include Sandpiper `piConfig` or Pi package metadata; Claude-specific hook glue lives in `packages/adapter-claude-code/` and adapts host-neutral capability code.

The repository root also contains `.claude-plugin/marketplace.json`, which validates as a Claude marketplace and points marketplace installs at the npm plugin package.

## Supported install roots

| Ecosystem path                                      | Source root                                                  | Invariant                                                                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Source workspace clone                              | Repository root                                              | Root `package.json` is npm-installable, local workspace deps use root-only `workspace:*`, registry specs are exact, and Pi package routing points only at provider/package-owned paths |
| `pi install npm:sandpiper-ai` / `pi install <dist>` | Published/local package built from `dist/`                   | `dist/package.json` owns Sandpiper `piConfig`, Sandpiper `pi` paths, npm-compatible runtime deps, and `file:` support packages |
| Neutral Pi local install surface                    | Repository root                                              | Root `pi` routes through neutral adapters/resources and does not load Sandpiper identity hooks                                 |
| Claude plugin marketplace/npm install               | `.claude-plugin/marketplace.json` plus `dist/claude-plugin/` | Claude marketplace and plugin manifests validate, and plugin package metadata has author/repository/license and no `private`   |

## Related docs

- [How to build and verify Sandpiper changes](build-workflows.md)
- [Pi extension development](pi-extension-development.md)
- [Contributing guide](../../CONTRIBUTING.md)
