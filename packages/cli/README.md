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

# Standalone smoke tests
bun run test:standalone
```

The build target intentionally produces a Bun-targeted JS bundle under `packages/cli/dist/standalone/`; it is not yet the final `bun compile` app bundle. `css-tree` is externalized because the bundled web-fetch dependency path currently hits Bun issue [#13076](https://github.com/oven-sh/bun/issues/13076): `css-tree` loads `../data/patch.json` through `createRequire(import.meta.url)`, and Bun can fail to resolve/bundle that JSON asset even with `--target=bun`.

## Key Files

| File | Purpose |
|------|---------|
| `pi_wrapper.ts` | CLI entry point — locates pi, sets env vars, delegates to `main()` |
| `copy_pi_assets.ts` | Copies sandpiper README/CHANGELOG into dist |
| `locatePi.sh` | Writes the system pi binary path to `.pi-binpath` |

## Pi Asset Resolution

Pi expects themes, export templates, and other assets relative to its "package directory." Since we override `PI_PACKAGE_DIR` to point at sandpiper's dist, we symlink pi's internal `modes/` and `core/` directories into our `dist/` so pi can find them. This is handled by the root `postinstall.sh`, not by this package.
