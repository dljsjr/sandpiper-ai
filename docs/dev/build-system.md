# Build System Guide

Understanding Sandpiper's build pipeline and when to run build steps.

## Overview

Sandpiper is a Pi Package and Bun workspace. The build system has three stages:

1. **Package builds** — Compile TypeScript, bundle binaries
2. **Dependency hoisting** — Bun workspace install
3. **Distribution assembly** — Assemble the final Pi Package in `dist/`

This document explains when each stage runs and what you need to do after making changes.

## When to Build

Not all changes require a build step. Here's what to do after different types of changes:

| You changed... | Then run... | Why |
|----------------|-------------|-----|
| Extension source (`extensions/`) | `bash devtools/postinstall.sh` | Extensions load from source, no build needed |
| Skills, prompts, themes | `bash devtools/postinstall.sh` | These are copied, not built |
| `packages/cli/` | `bun run build` then `postinstall.sh` | Emits bundled binary |
| `packages/sandpiper-tasks-cli/` | `bun run build` then `postinstall.sh` | Emits bundled binary |
| `packages/core/` | `bun run build` then `postinstall.sh` | Emits TypeScript declarations |

## Build Pipeline

### Stage 1: Package Builds

Only packages that emit distributable artifacts need build steps:

**`packages/cli/`**:
```bash
bun build src/pi_wrapper.ts --outdir dist/sandpiper
```
- Bundles the Sandpiper CLI wrapper
- Copies Pi assets (themes, export templates)

**`packages/sandpiper-tasks-cli/`**:
```bash
bun build src/index.ts --outdir skills/sandpiper/tasks/scripts/
```
- Bundles the task management CLI
- Output is a skill script

**`packages/core/`**:
```bash
tsc --build
```
- Emits TypeScript declarations (`.d.ts`)
- Builds package dist artifacts

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

The `postinstall.sh` script assembles the final Pi Package:

```bash
bash devtools/postinstall.sh
```

This script:
1. Copies extensions, skills, prompts, themes to `dist/`
2. Preserves extension `src/` trees (so `pi.extensions` entries resolve)
3. Generates `dist/package.json` with Pi package metadata
4. Symlinks Pi's internal assets
5. Builds the Dash CLI via mcporter
6. Installs the Sandpiper Pi package

## Understanding `dist/`

The `dist/` directory is a **Pi Package assembly**, not a dependency manager.

**What `dist/` contains**:
- Extension source trees (not bundled)
- Skills, prompts, themes
- Package binaries (from build step)
- `dist/package.json` with `pi` key and `sandpiper` bin

**What `dist/` does NOT contain**:
- `node_modules/` (dependencies resolve from root)
- Extension build outputs (extensions load from source)

**Key insight**: `dist/package.json` declares Pi resources and the `sandpiper` bin. Runtime npm dependencies resolve from the workspace install, not from `dist/`.

## Common Workflows

### After Extension Changes

```bash
# Changed: extensions/system.ts or extensions/shell-relay/src/index.ts
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
# Changed: skills/, prompts/, themes/
bash devtools/postinstall.sh
```

These are copied, not built.

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

## Related Documentation

- [Extension Loading](../.sandpiper/docs/extension-loading.md) — How jiti loads extensions
- [Pi Dev Suite - Architecture](./pi-dev-suite/PI-DEV-ARCHITECTURE.md) — Pi's extension loading mechanism
- [Contributing Guide](../CONTRIBUTING.md) — General contributor guidelines

---

**Last updated**: 2026-04-16  
**Audience**: Contributors building or modifying packages
