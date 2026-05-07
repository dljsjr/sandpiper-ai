# Build System & Distribution

Read when: modifying build scripts, `package.json`, `devtools/postinstall.sh`, dist assembly, package install flow, or deciding whether a change needs a build step.
Last verified: 2026-03-30

## Key Rules

- Extensions in `extensions/` are loaded from source `.ts` files via jiti. Do **not** add build steps for extension runtime entrypoints.
- Only packages with real build outputs need build steps: `packages/cli`, `packages/sandpiper-tasks-cli`, and `packages/core`.
- After changing extension code, skills, prompts, themes, or other packaged resources, run `bash devtools/postinstall.sh`.
- After changing a package that emits binaries or declarations, build that package first, then run `bash devtools/postinstall.sh`.
- `dist/` is the generated Sandpiper Pi/npm package assembly, not a dependency manager. Root `package.json` is the neutral Pi install surface; `dist/package.json` declares the Sandpiper package resources and `sandpiper` bin.
- Runtime npm dependencies resolve from the hoisted root `node_modules/`, not from per-extension `node_modules/` inside `dist/`.

## Canonical Examples

- `devtools/postinstall.sh`
- `devtools/distPackageJson.ts`
- `packages/cli/package.json`
- `packages/core/package.json`
- `extensions/shell-relay/package.json`
- `extensions/web-fetch/package.json`

## Reference

## Build Pipeline

The build pipeline has three stages.

### 1. Package builds (per-package `preinstall` / `build` scripts)

Only actual distributable binaries and declaration-emitting workspace packages need build steps:

- `packages/cli/` — `bun build` bundles `sandpiper_standalone.ts` → `dist/sandpiper` and `dist/standalone/sandpiper_standalone.js`, then runs `copy_pi_assets.ts`
- `packages/sandpiper-tasks-cli/` — `bun build` bundles the CLI → `skills/sandpiper/tasks/scripts/sandpiper-tasks`
- `packages/core/` — `tsc --build` emits declarations and package dist artifacts

Pi extensions themselves are **not** built. They are loaded from source `.ts` files via jiti.

### 2. Dependency hoisting (`bunfig.toml`)

```toml
[install]
linker = "hoisted"
```

This hoists dependencies to the root `node_modules/`. Extensions with npm dependencies, such as `web-fetch`, resolve imports from that hoisted install when loaded by pi's jiti runtime.

### 3. Distribution assembly (`devtools/postinstall.sh`)

This script assembles the final Pi Package in `dist/`:

- copies extensions, package-owned shared resources, and support packages into `dist/`
- preserves extension `src/` trees so package-local `pi.extensions` entries like `./src/index.ts` resolve in both source and dist
- generates `dist/package.json` with Sandpiper Pi package metadata and the `sandpiper` bin
- symlinks Pi's internal assets (themes, export templates)
- builds the dash CLI via mcporter
- optionally installs `dist/` through Sandpiper only when `SANDPIPER_INSTALL_PI_PACKAGE=1`

## Workflow

Typical workflow after changes:

- Extension source changes in `extensions/` → run `bash devtools/postinstall.sh`
- Package changes with real build outputs (`packages/cli`, `packages/sandpiper-tasks-cli`, `packages/core`) → run that package's `build` script, then `bash devtools/postinstall.sh`
- Skill / prompt / theme changes under `packages/resources/` → run `bash devtools/postinstall.sh`

## Related Docs

- [extension-loading.md](extension-loading.md) — how Pi loads extension source via jiti
- [agent-guidance-evolution.md](agent-guidance-evolution.md) — current guidance-shaping plan for prompt architecture
