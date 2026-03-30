# How Extensions Are Loaded

## Pi's Extension Loader (jiti)

Pi uses **jiti** (a TypeScript-aware module loader) to load extensions at runtime:

1. **jiti loads `.ts` files directly** — no build step required. This is Pi's happy path.
2. **Module resolution** follows standard Node.js rules — imports resolve from `node_modules/` (hoisted by bun), plus jiti aliases for Pi framework packages.
3. **`tsconfig.json` paths are for TypeScript type-checking only** — jiti does NOT use them. If an import works in `tsc` but fails at runtime, the module isn't resolvable via standard Node.js resolution.
4. **Each jiti load creates a separate module scope** — module-level state is NOT shared between extensions. Use `pi.events` for cross-extension communication.

## Our Extensions

| Extension | Entry point | Build step | Why |
|-----------|------------|------------|-----|
| `system.ts` | Source `.ts` | None | Happy path — jiti loads directly |
| `shell-relay` | Bundled `.js` | `bun build` | Historical — bundles all modules into single file |
| `web-fetch` | Compiled `.js` | `tsc` | Has npm deps (jsdom, etc.) that need hoisted node_modules |

The ideal state is for all extensions to load from source `.ts` files (like `system.ts`), with jiti resolving dependencies at runtime from the hoisted `node_modules/`. See TOOLS-10 for the investigation into unbundling.

## Key Implication

The `dist/` directory assembled by `postinstall.sh` is a Pi Package — it contains resource declarations (`package.json` with the `pi` key), extension entry points, skills, prompts, and themes. It does NOT contain `node_modules/` or manage npm dependencies. Dependencies are resolved from the workspace's hoisted `node_modules/` at runtime.

## jiti Aliases

Pi's extension loader configures jiti with aliases for known packages:
- `@mariozechner/pi-coding-agent` → the pi package's `index.js`
- `@mariozechner/pi-tui` → the pi-tui package
- `@mariozechner/pi-ai` → the pi-ai package
- `@sinclair/typebox` → the typebox package

All other imports resolve via standard `node_modules/` resolution.

## New Module Gotcha

Adding a new module to a workspace package (e.g., `sandpiper-ai-core`) and re-exporting it requires a **full agent restart** — `/reload` does not re-resolve the module dependency graph. jiti caches the module graph in memory for the session lifetime.
