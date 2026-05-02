# Sandpiper CLI

Thin wrapper around [pi-coding-agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) that runs pi as `sandpiper` with its own config directories (`~/.sandpiper` instead of `~/.pi`).

## How It Works

`pi_wrapper.ts` is the entry point. At runtime it:

1. **Locates the system `pi` binary** — checks `.pi-binpath` (written at install time), falls back to `which pi`
2. **Finds the package directory** — walks up from the script location looking for a `package.json` with a `pi` key (resource declarations)
3. **Sets environment variables** — `PI_PACKAGE_DIR` (config path), `PI_CODING_AGENT_PACKAGE` (asset path), `PI_SKIP_VERSION_CHECK` (sandpiper handles its own)
4. **Imports and calls `main()`** from pi's `dist/main.js`

The wrapper is bundled to a single ~1.3KB JS file with a `#!/usr/bin/env node` shebang.

## Build

```bash
bun run build        # tsc + bun build → dist/sandpiper
bun run copy-assets  # Copy README/CHANGELOG into dist
./locatePi.sh        # Write .pi-binpath for the installed pi location
```

All three run automatically during `preinstall`.

## Dogfood Standalone Target

`AGENT-99` introduced a narrow dogfood target for the package-first refactor. This target keeps using Pi's `main(args, { extensionFactories })`, but loads Sandpiper extensions/resources explicitly instead of relying on root `pi.extensions` / `pi.skills` manifest entries.

Use explicit package scripts or paths when testing. The user's `$PATH` may contain another `sandpiper` executable or shell script.

```bash
# Source/dev target
bun run sandpiper-standalone-dev -- --help

# Build the dogfood bundle
bun run build:standalone

# Run the built dogfood bundle
bun run sandpiper-standalone-built -- --help

# Dogfood through the workspace-linked bin after bun install
./node_modules/.bin/sandpiper-standalone --help

# Standalone smoke tests
bun run test:standalone
```

The dogfood build target intentionally produces a Bun-targeted JS bundle under `packages/cli/dist/standalone/`; it is still useful for fast local dogfooding and the workspace-linked `sandpiper-standalone` bin. `canvas` and `css-tree` are externalized in this dogfood bundle: `canvas` is optional for jsdom, and `css-tree` still uses `createRequire(import.meta.url)` for JSON/package metadata in ways that do not survive this JS-bundle path reliably. Bun links `sandpiper-standalone` through a checked-in bin shim at `packages/cli/bin/sandpiper-standalone`, because generated bundle outputs are not available early enough for first-install bin linking.

The standalone app bundle is built separately:

```bash
bun run build:standalone-app
bun run test:standalone-app
./dist/standalone-sandpiper/sandpiper --help
```

`build:standalone-app` writes `dist/standalone-sandpiper/` with a compiled `sandpiper` executable, Sandpiper sidecar `package.json`, copied resources/support packages, and Pi internal assets. Its Bun build plugin bundles `css-tree`'s JSON/package metadata into the executable; `canvas` remains external so jsdom treats it as unavailable instead of requiring a native sidecar.

By default the source/dogfood standalone entrypoint generates a lightweight package-metadata sidecar under `dist/standalone-package/` and points Pi at that sidecar instead of the repo root. The compiled app bundle instead resolves package metadata and resources relative to `dirname(process.execPath)`, so it does not need `SANDPIPER_STANDALONE_RESOURCE_ROOT` or `SANDPIPER_STANDALONE_PACKAGE_DIR` in normal use. Both modes preserve Sandpiper branding/config defaults without loading the legacy root Pi manifest a second time. Built-in Sandpiper extensions/resources come from explicit extension factories and `resources_discover`; source/dogfood mode can still defer to a configured legacy Sandpiper package to avoid duplicate resources while package-management commands operate on normal Sandpiper global/project settings files.

Package-management commands such as `install`, `list`, `remove`, and `update` operate on the normal Sandpiper global/project settings files.

## Key Files

| File | Purpose |
|------|---------|
| `pi_wrapper.ts` | CLI entry point — locates pi, sets env vars, delegates to `main()` |
| `sandpiper_standalone.ts` | Standalone entrypoint — sets sidecar package metadata before loading Pi and injects Sandpiper factories/resources |
| `deferred_pi_import.ts` | Load-order shim so the Sandpiper app bundle imports Pi only after Sandpiper package metadata env vars are set; not a Pi distribution artifact |
| `copy_pi_assets.ts` | Copies sandpiper README/CHANGELOG into dist |
| `locatePi.sh` | Writes the system pi binary path to `.pi-binpath` |

## Pi Asset Resolution

Pi expects themes, export templates, and other assets relative to its "package directory." Since we override `PI_PACKAGE_DIR` to point at sandpiper's dist, we symlink pi's internal `modes/` and `core/` directories into our `dist/` so pi can find them. This is handled by the root `postinstall.sh`, not by this package.
