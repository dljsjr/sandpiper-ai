# Build System Guide

Understanding Sandpiper's build pipeline and when to run build steps.

## Overview

Sandpiper is a Pi Package and Bun workspace. The build system has three stages:

1. **Package builds** — Compile TypeScript, bundle binaries
2. **Dependency hoisting** — Bun workspace install
3. **Distribution assembly** — Assemble generated distribution artifacts in `dist/`

This document explains when each stage runs and what you need to do after making changes.

## When to Build

Not all changes require a build step. Here's what to do after different types of changes:

| You changed... | Then run... | Why |
|----------------|-------------|-----|
| Extension source (`extensions/`) | `bash devtools/postinstall.sh` | Extensions load from source, no build needed |
| Shared skills, prompts, themes (`packages/resources/`) | `bash devtools/postinstall.sh` | These are copied, not built |
| `packages/cli/` | `bun run build` then `postinstall.sh` | Emits bundled binary |
| `packages/sandpiper-tasks-cli/` | `bun run build` then `postinstall.sh` | Emits bundled binary |
| `packages/core/` | `bun run build` then `postinstall.sh` | Emits TypeScript declarations |
| `packages/adapter-claude-code/` | `bun --filter sandpiper-adapter-claude-code build` then `bun run build:claude-plugin` | Emits TypeScript declarations and bundles Claude hook scripts into the plugin artifact |
| Distribution invariant or smoke checks | `bun run test:distribution` | Builds legacy dist prerequisites, assembles `dist/`, builds neutral Pi, standalone app, and Claude plugin artifacts, and runs source/distribution/standalone/plugin invariant tests |

## Build Pipeline

### Stage 1: Package Builds

Only packages that emit distributable artifacts need build steps:

**`packages/cli/`**:
```bash
bun build --target=node ./pi_wrapper.ts --outfile ./dist/sandpiper
bun build --target=bun --external canvas --external css-tree ./sandpiper_standalone.ts --outdir ./dist/standalone
bun run build:standalone-app
```
- Bundles the legacy Sandpiper CLI wrapper
- Bundles the dogfood standalone CLI target
- Builds the standalone app-bundle artifact at `dist/standalone-sandpiper/`
- Copies Pi assets (themes, export templates)

**`packages/sandpiper-tasks-cli/`**:
```bash
bun build --production --minify --target=node src/index.ts --outfile ./dist/sandpiper-tasks
```
- Bundles the task management CLI
- `postinstall.sh` links the built CLI into the tasks skill script directory

**`packages/core/`**:
```bash
tsc --build
```
- Emits TypeScript declarations (`.d.ts`)
- Builds package dist artifacts

**`packages/adapter-claude-code/`**:
```bash
tsc --build
bun run build:claude-plugin
```
- Emits TypeScript declarations for the adapter package
- Bundles `src/autotoon-post-tool-use.ts` into `dist/claude-plugin/hooks/autotoon-post-tool-use.js`

**Extensions are NOT built** — they load from source `.ts` files via jiti at runtime.

### Stage 2: Dependency Hoisting

Bun workspace install hoists dependencies to the root `node_modules/`:

```toml
# bunfig.toml
[install]
linker = "hoisted"
```

This means:
- Extensions with npm dependencies (like `web-fetch`) resolve from root `node_modules/`
- No per-extension `node_modules/` directories
- Single source of truth for dependency versions

### Stage 3: Distribution Assembly

The `postinstall.sh` script assembles the generated Sandpiper Pi/npm package at `dist/`:

```bash
bash devtools/postinstall.sh
```

This script:
1. Removes stale nested package artifacts from `dist/` (`claude-plugin`, `neutral-pi-package`, `standalone-package`)
2. Copies extensions and package-owned shared resources to `dist/`
3. Preserves extension `src/` trees (so `pi.extensions` entries resolve)
4. Generates `dist/package.json` with artifact-owned Pi package metadata and an npm `files` whitelist
5. Symlinks Pi's internal assets
6. Builds the Dash CLI via mcporter
7. Optionally installs the legacy Sandpiper Pi package when `SANDPIPER_INSTALL_PI_PACKAGE=1`

The neutral Pi package artifact is built separately:

```bash
bun run build:neutral-pi-package
```

This writes `dist/neutral-pi-package/`, a local transition artifact that exposes neutral capabilities/resources without Sandpiper `piConfig`, CLI branding, migration flags, or startup prompt identity hooks. Its generated manifest is npm-installable: package-owned runtime support is copied under `packages/`, referenced with local `file:` dependencies, and Pi packages are declared as `peerDependencies` with `"*"` ranges per Pi packaging guidance.

The standalone Sandpiper app bundle is built separately:

```bash
bun run build:standalone-app
```

This writes `dist/standalone-sandpiper/` with a compiled `sandpiper` executable, Sandpiper sidecar package metadata, bundled resources/support packages, and Pi internal assets. The executable bundles `css-tree`'s JSON/package metadata through the standalone assembler's Bun build plugin and leaves optional `canvas` external so jsdom can treat it as unavailable rather than requiring a native sidecar.

The Claude Code plugin artifact is built separately:

```bash
bun run build:claude-plugin
```

This writes `dist/claude-plugin/` with Claude plugin metadata, copied skills/commands/themes, materialized helper CLIs, hook configuration, a bundled `hooks/autotoon-post-tool-use.js` script, and npm package metadata for `sandpiper-claude-code-plugin`. The plugin manifest does not include Sandpiper `piConfig` or Pi package metadata; Claude-specific hook glue lives in `packages/adapter-claude-code/` and adapts host-neutral capability code. The repository root also contains `.claude-plugin/marketplace.json`, which validates as a Claude marketplace and points marketplace installs at the npm plugin package.

Automatic package installation is intentionally opt-in. The standalone CLI path loads Sandpiper extensions/resources through explicit extension factories and `resources_discover`; it does not need `dist/` installed as a Pi package. The standalone dogfood launcher is linked as `node_modules/.bin/sandpiper-standalone` from a stable checked-in bin shim, while the generated dogfood bundle lives at `packages/cli/dist/standalone/sandpiper_standalone.js`. This avoids duplicate package entries when running `bun install` from multiple jj workspaces.

## Understanding `dist/`

The `dist/` directory is the **Sandpiper Pi/npm package assembly**, not a dependency manager and not the repository root.

**What `dist/` contains**:
- Extension source trees (not bundled)
- Skills, prompts, themes copied from `packages/resources/`
- Package binaries (from build step)
- `dist/package.json` with `pi` key and `sandpiper` bin

**What `dist/` does NOT contain**:
- `node_modules/` (dependencies resolve from root)
- Extension build outputs (extensions load from source)

**Key insight**: `dist/package.json` declares Pi resources and the `sandpiper` bin. Runtime npm dependencies resolve from the workspace install, not from `dist/`.

## Common Workflows

### After Extension Changes

```bash
# Changed: extensions/system/index.ts or extensions/shell-relay/src/index.ts
bash devtools/postinstall.sh
```

Extensions load from source via jiti — no build step needed.

### After Package Changes

```bash
# Changed: packages/cli/src/pi_wrapper.ts
cd packages/cli && bun run build
cd ../..
bash devtools/postinstall.sh
```

Packages emit binaries or declarations — build first, then assemble.

### After Skill/Prompt/Theme Changes

```bash
# Changed: packages/resources/skills/, packages/resources/prompts/, packages/resources/themes/
bash devtools/postinstall.sh
```

These are copied, not built.

### Distribution Invariant and Smoke Checks

```bash
bun run test:distribution
```

This command prepares the generated Sandpiper Pi/npm package assembly and neutral Pi package artifact, then runs distribution invariant tests, dogfood standalone smoke tests, standalone app-bundle smoke tests, and Claude plugin smoke tests. It verifies source-boundary rules, generated Pi manifest resource paths, opt-in legacy package installation behavior, ecosystem package install metadata, neutral package loading without Sandpiper identity, standalone temp-config execution, compiled app-bundle help/resource loading, Claude plugin path/resource shape, and hook adapter execution.

### Ecosystem Install Certification

The supported local install roots are:

| Ecosystem path | Source root | Gate |
| --- | --- | --- |
| source-root workspace clone | repository root after clone | root `package.json` is npm-installable for development and any Pi package routing points only at provider/package-owned paths |
| `pi install npm:sandpiper-ai` / `pi install <dist>` | published/local package built from `dist/` | `dist/package.json` has no `private`, owns Sandpiper `piConfig` and `pi` resource paths, uses npm-compatible runtime deps and `file:` support packages, and `npm pack --dry-run --json` excludes nested generated artifacts |
| neutral Pi local/npm artifact | `dist/neutral-pi-package/` | same npm-compatible dependency/file-target checks as `dist/` plus no Sandpiper `piConfig` or `sandpiper` bin |
| Claude plugin marketplace/npm install | root `.claude-plugin/marketplace.json` plus `dist/claude-plugin/` | `claude plugin validate` passes for both marketplace and plugin manifests; plugin package metadata has author/repository/license and no `private` |

Manual certification commands:

```bash
bun run prepare:distribution
npm install --ignore-scripts --package-lock=false --dry-run
npm install --ignore-scripts --package-lock=false --dry-run --prefix dist
npm install --ignore-scripts --package-lock=false --dry-run --prefix dist/neutral-pi-package
bun run build:claude-plugin
claude plugin validate .
claude plugin validate dist/claude-plugin
```

Use `--ignore-scripts` for npm install convention checks unless you intentionally want to exercise source builds; source-tree lifecycle scripts call Bun and are covered by the Bun build/test gates.

### Clean Build from Scratch

```bash
bun run clean          # Remove node_modules, dist, caches
bun install            # Install deps + run preinstall (builds packages)
bash devtools/postinstall.sh
```

## Troubleshooting

### "Extension not found" after changes

Run `postinstall.sh` to reassemble `dist/`. Extension source trees must be preserved in `dist/` for `pi.extensions` entries to resolve.

### "Module not found" for npm dependency

Run `bun install` to hoist dependencies. Extensions resolve from root `node_modules/`, not per-extension directories.

### Binary not updated after package changes

Build the package first, then run `postinstall.sh`:
```bash
bun --filter sandpiper-tasks-cli run build
bash devtools/postinstall.sh
```

For the standalone Sandpiper dogfood binary, either run `bun install` or rebuild it directly:
```bash
bun run build:standalone
./node_modules/.bin/sandpiper-standalone --help
```

For the standalone app bundle, rebuild and smoke-test it with:
```bash
bun run build:standalone-app
bun run test:standalone-app
./dist/standalone-sandpiper/sandpiper --help
```

For the Claude Code plugin artifact, rebuild and smoke-test it with:
```bash
bun run build:claude-plugin
bun run test:claude-plugin
```

## Related Documentation

- [Extension Loading](../.sandpiper/docs/extension-loading.md) — How jiti loads extensions
- [Pi Dev Suite - Architecture](./pi-dev-suite/PI-DEV-ARCHITECTURE.md) — Pi's extension loading mechanism
- [Contributing Guide](../CONTRIBUTING.md) — General contributor guidelines

---

**Last updated**: 2026-04-16  
**Audience**: Contributors building or modifying packages
