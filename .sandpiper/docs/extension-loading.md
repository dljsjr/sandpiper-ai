# How Extensions Are Loaded

## Pi's Extension Loader (jiti)

Pi uses **jiti** (a TypeScript-aware module loader) to load extensions at runtime:

1. **jiti loads `.ts` files directly** — no build step required. This is Pi's happy path.
2. **Module resolution** follows standard Node.js rules — imports resolve from `node_modules/` (hoisted by bun), plus jiti aliases for Pi framework packages.
3. **`tsconfig.json` paths are for TypeScript type-checking only** — jiti does NOT use them. If an import works in `tsc` but fails at runtime, the module isn't resolvable via standard Node.js resolution.
4. **Each jiti load creates a separate module scope** — module-level state is NOT shared between extensions. Use `pi.events` for cross-extension communication.

## Our Extensions

All current extensions now follow Pi's happy path and load from source `.ts` files:

| Extension | Entry point | Build step | Notes |
|-----------|------------|------------|-------|
| `system.ts` | Source `.ts` file | None | Single-file extension |
| `shell-relay` | `./src/index.ts` via `package.json` | None | Multi-file extension; source tree copied into dist |
| `web-fetch` | `./src/index.ts` via `package.json` | None | npm deps resolve from hoisted `node_modules/` |

This was normalized in TOOLS-10. Only actual binaries from `packages/` are bundled; extension runtime entrypoints are source-loaded by jiti.

## Key Implication

The `dist/` directory assembled by `postinstall.sh` is a Pi Package — it contains resource declarations (`package.json` with the `pi` key), extension source trees, skills, prompts, and themes. It does NOT contain `node_modules/` or manage npm dependencies. Dependencies are resolved from the workspace's hoisted `node_modules/` at runtime.

For directory-based extensions, `postinstall.sh` copies the extension's `src/` directory and `package.json` into `dist/extensions/<name>/`. Pi then reads that package-local `pi.extensions` entry and jiti loads `./src/index.ts` from the assembled dist tree.

## jiti Aliases

Pi's extension loader configures jiti with aliases for known packages:
- `@mariozechner/pi-coding-agent` → the pi package's `index.js`
- `@mariozechner/pi-tui` → the pi-tui package
- `@mariozechner/pi-ai` → the pi-ai package
- `@sinclair/typebox` → the typebox package

All other imports resolve via standard `node_modules/` resolution.

## New Module Gotcha

Adding a new module to a workspace package (e.g., `sandpiper-ai-core`) and re-exporting it requires a **full agent restart** — `/reload` does not re-resolve the module dependency graph. jiti caches the module graph in memory for the session lifetime.
