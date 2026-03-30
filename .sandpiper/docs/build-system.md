# Build System & Distribution

## Build Pipeline

The build pipeline has three stages:

### 1. Package builds (per-package `preinstall`/`build` scripts)

- `packages/cli/` — `bun build` bundles `pi_wrapper.ts` → `dist/sandpiper`, runs `copy_pi_assets.ts` to symlink pi's themes/exports
- `packages/sandpiper-tasks-cli/` — `bun build` bundles the CLI → `skills/sandpiper/tasks/scripts/sandpiper-tasks`
- `extensions/shell-relay/` — `bun build` bundles the extension → `dist/shell-relay`
- `extensions/web-fetch/` — `tsc` compiles TypeScript → `dist/` (uses hoisted node_modules for npm deps)
- `packages/core/` — `tsc --build` compiles TypeScript → `dist/`

### 2. Dependency hoisting (`bunfig.toml`)

```toml
[install]
linker = "hoisted"
```

This hoists all dependencies to the root `node_modules/`, which is required for extensions that have npm dependencies (like `web-fetch` with `jsdom`, `readability`, `turndown`). Extensions loaded by pi's jiti runtime resolve imports from the hoisted `node_modules/`.

### 3. Distribution assembly (`devtools/postinstall.sh`)

This script assembles the final Pi Package in `dist/`:
- Copies extensions, skills, prompts, themes from source to `dist/`
- Generates `dist/package.json` with the `pi` key (declares resource paths)
- Symlinks pi's internal assets (themes, export templates)
- Builds the dash CLI via mcporter
- Runs `pi package install dist/` to register with pi

## Workflow

**After making changes, the typical workflow is:**
- Source code changes in `packages/` or `extensions/` → run the package's `build` script
- Skill/prompt/theme changes in `skills/` → run `bash devtools/postinstall.sh`
- Both → build first, then postinstall

**Single-file extensions** (like `extensions/system.ts`) are loaded directly by jiti at runtime — no build step needed. They resolve imports via hoisted `node_modules/`.

## Extension Loading

See [docs/extension-loading.md](extension-loading.md) for details on how Pi loads extensions and why some are bundled vs. loaded from source.
