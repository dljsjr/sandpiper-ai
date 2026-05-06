# Sandpiper CLI

Sandpiper-branded CLI runtime around [pi-coding-agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent).

## How It Works

`sandpiper_standalone.ts` is the normal `sandpiper` runtime. It:

1. Resolves Sandpiper resource/package sidecar paths.
2. Configures `PI_PACKAGE_DIR`, `PI_CODING_AGENT_PACKAGE`, `PI_CODING_AGENT_VERSION`, and mirrored `SANDPIPER_*` env vars before importing Pi.
3. Imports Pi through `deferred_pi_import.ts`.
4. Calls `main(args, { extensionFactories })` with Sandpiper identity/capability factories and explicit resource discovery.

This path does not install Sandpiper into Pi to load its own behavior. The old `pi_wrapper.ts` remains as legacy code while distribution assembly is retired.

## Build

```bash
bun run build            # tsc + build sandpiper runtime + standalone alias bundle
bun run build:sandpiper  # build packages/cli/dist/sandpiper from sandpiper_standalone.ts
bun run build:standalone # build packages/cli/dist/standalone/sandpiper_standalone.js
bun run copy-assets      # Copy README/CHANGELOG into dist
```

`preinstall` builds both Bun-targeted runtime bundles and copies Pi assets.

## Runtime Targets

Use explicit package scripts or paths when testing. The user's `$PATH` may contain another `sandpiper` executable or shell script.

```bash
# Source/dev target
bun run sandpiper-dev -- --help

# Build and run the normal runtime bundle
bun run build:sandpiper-cli
bun run sandpiper-built -- --help

# Workspace-linked bins after bun install
./node_modules/.bin/sandpiper --help
./node_modules/.bin/sandpiper-standalone --help

# Smoke tests
bun run test:standalone
```

The `sandpiper-standalone` bin remains as a compatibility alias for dogfooding, but `sandpiper` now points at the same deferred-import runtime via `packages/cli/bin/sandpiper`.

The standalone app bundle is built separately:

```bash
bun run build:standalone-app
bun run test:standalone-app
./dist/standalone-sandpiper/sandpiper --help
```

`build:standalone-app` writes `dist/standalone-sandpiper/` with a compiled `sandpiper` executable, Sandpiper sidecar `package.json`, copied resources/support packages, and Pi internal assets. Its Bun build plugin bundles `css-tree`'s JSON/package metadata into the executable; `canvas` remains external so jsdom treats it as unavailable instead of requiring a native sidecar.

By default the source/runtime entrypoint generates a lightweight package-metadata sidecar under `dist/standalone-package/` and points Pi at that sidecar instead of the repo root. The compiled app bundle instead resolves package metadata and resources relative to `dirname(process.execPath)`, so it does not need `SANDPIPER_STANDALONE_RESOURCE_ROOT` or `SANDPIPER_STANDALONE_PACKAGE_DIR` in normal use. Both modes preserve Sandpiper branding/config defaults without loading the legacy root Pi manifest a second time. Built-in Sandpiper extensions/resources come from explicit extension factories and `resources_discover`; source mode can still defer to a configured legacy Sandpiper package to avoid duplicate resources while package-management commands operate on normal Sandpiper global/project settings files.

Package-management commands such as `install`, `list`, `remove`, and `update` operate on the normal Sandpiper global/project settings files.

## Key Files

| File | Purpose |
|------|---------|
| `sandpiper_standalone.ts` | Normal Sandpiper runtime entrypoint — sets sidecar package metadata before loading Pi and injects Sandpiper factories/resources |
| `bin/sandpiper` | Stable workspace bin shim for the normal runtime |
| `bin/sandpiper-standalone` | Compatibility alias shim for the standalone bundle |
| `deferred_pi_import.ts` | Load-order shim so Sandpiper imports Pi only after package metadata env vars are set |
| `pi_wrapper.ts` | Legacy wrapper retained temporarily while generated distribution assembly is retired |
| `copy_pi_assets.ts` | Copies Sandpiper README/CHANGELOG into dist |

## Pi Asset Resolution

Pi expects themes, export templates, and other assets relative to its package directory. The Sandpiper runtime configures `PI_PACKAGE_DIR` before importing Pi, and distribution assembly symlinks Pi's internal `modes/` and `core/` directories where needed.
