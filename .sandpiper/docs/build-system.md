# Build System & Distribution

## Build Pipeline

The build pipeline has three stages:

### 1. Package builds (per-package `preinstall`/`build` scripts)

Only actual distributable binaries and declaration-emitting workspace packages need build steps:

- `packages/cli/` — `bun build` bundles `pi_wrapper.ts` → `dist/sandpiper`, runs `copy_pi_assets.ts` to symlink pi's themes/exports
- `packages/sandpiper-tasks-cli/` — `bun build` bundles the CLI → `skills/sandpiper/tasks/scripts/sandpiper-tasks`
- `packages/core/` — `tsc --build` emits declarations and package dist artifacts

Pi extensions themselves are **not** built. They are loaded from source `.ts` files via jiti.

### 2. Dependency hoisting (`bunfig.toml`)

```toml
[install]
linker = "hoisted"
```

This hoists all dependencies to the root `node_modules/`, which is required for extensions that have npm dependencies (like `web-fetch` with `jsdom`, `readability`, `turndown`). Extensions loaded by pi's jiti runtime resolve imports from the hoisted `node_modules/`.

### 3. Distribution assembly (`devtools/postinstall.sh`)

This script assembles the final Pi Package in `dist/`:
- Copies extensions, skills, prompts, themes, and packages from source to `dist/`
- Preserves extension `src/` trees so package-local `pi.extensions` entries like `./src/index.ts` resolve in both source and dist
- Generates `dist/package.json` with the `pi` key (declares resource paths)
- Symlinks pi's internal assets (themes, export templates)
- Builds the dash CLI via mcporter
- Runs `pi package install dist/` to register with pi

## Workflow

**After making changes, the typical workflow is:**
- Extension source changes in `extensions/` → run `bash devtools/postinstall.sh`
- Package changes with real build outputs (`packages/cli`, `packages/sandpiper-tasks-cli`, `packages/core`) → run that package's `build` script, then `bash devtools/postinstall.sh`
- Skill/prompt/theme changes → run `bash devtools/postinstall.sh`

All extensions — single-file or directory-based — are loaded from source by jiti at runtime. They resolve imports via hoisted `node_modules/`.

## Extension Loading

See [extension-loading.md](extension-loading.md) for details on how Pi loads extensions from source and how dist assembly preserves that layout.
