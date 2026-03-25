# Sandpiper CLI

Thin wrapper around [pi-coding-agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) that rebrands the `pi` command as `sandpiper` with custom config directories.

## How It Works

`pi_wrapper.ts` is the entry point. At runtime it:

1. **Locates the system `pi` binary** — checks `.pi-binpath` (written at install time), falls back to `which pi`
2. **Finds the package directory** — walks up from the script location looking for a `package.json` with a `pi` key (resource declarations)
3. **Sets environment variables** — `PI_PACKAGE_DIR` (branding), `PI_CODING_AGENT_PACKAGE` (asset path), `PI_SKIP_VERSION_CHECK` (sandpiper handles its own)
4. **Imports and calls `main()`** from pi's `dist/main.js`

The wrapper is bundled to a single ~1.3KB JS file with a `#!/usr/bin/env node` shebang.

## Build

```bash
bun run build        # tsc + bun build → dist/sandpiper
bun run copy-assets  # Copy README/CHANGELOG into dist
./locatePi.sh        # Write .pi-binpath for the installed pi location
```

All three run automatically during `preinstall`.

## Key Files

| File | Purpose |
|------|---------|
| `pi_wrapper.ts` | CLI entry point — locates pi, sets env vars, delegates to `main()` |
| `copy_pi_assets.ts` | Copies sandpiper README/CHANGELOG into dist |
| `locatePi.sh` | Writes the system pi binary path to `.pi-binpath` |

## Pi Asset Resolution

Pi expects themes, export templates, and other assets relative to its "package directory." Since we override `PI_PACKAGE_DIR` for branding, we symlink pi's internal `modes/` and `core/` directories into our `dist/` so pi can find them. This is handled by the root `postinstall.sh`, not by this package.
