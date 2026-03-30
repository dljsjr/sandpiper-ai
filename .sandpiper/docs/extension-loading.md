# How Extensions Are Loaded

Read when: creating extensions, debugging import failures, changing extension package metadata, reasoning about `/reload`, or deciding whether an extension needs a build step.
Last verified: 2026-03-30

## Key Rules

- Pi uses jiti to load extension source `.ts` files directly. Source loading is the happy path.
- `tsconfig.json` path aliases help TypeScript, but jiti resolves imports using normal runtime resolution plus Pi's built-in aliases.
- `system.ts`, `shell-relay`, and `web-fetch` all load from source today; only true binaries from `packages/` are bundled.
- `postinstall.sh` must preserve extension `src/` trees and `package.json` files in `dist/` so package-local `pi.extensions` entries still resolve.
- Each extension gets its own jiti module scope. Do not rely on module-level state being shared across extensions.
- `/reload` reloads resources, but new cross-package exports or other module-graph changes may still require a full restart.

## Canonical Examples

- `extensions/system.ts`
- `extensions/shell-relay/package.json`
- `extensions/web-fetch/package.json`
- `devtools/postinstall.sh`
- `packages/core/package.json`

## Reference

## Pi's Extension Loader (jiti)

Pi uses **jiti** (a TypeScript-aware module loader) to load extensions at runtime:

1. **jiti loads `.ts` files directly** — no extension build step required.
2. **Module resolution** follows standard Node.js rules — imports resolve from `node_modules/` (hoisted by Bun), plus jiti aliases for Pi framework packages.
3. **`tsconfig.json` paths are for TypeScript type-checking only** — jiti does **not** use them. If an import works in `tsc` but fails at runtime, the module is not resolvable via normal runtime resolution.
4. **Each jiti load creates a separate module scope** — module-level state is not shared between extensions. Use `pi.events` for cross-extension communication.

## Our Extensions

All current extensions follow the source-loading model:

| Extension | Entry point | Build step | Notes |
| --- | --- | --- | --- |
| `system.ts` | Source `.ts` file | None | Single-file extension |
| `shell-relay` | `./src/index.ts` via `package.json` | None | Multi-file extension; source tree copied into dist |
| `web-fetch` | `./src/index.ts` via `package.json` | None | npm deps resolve from hoisted `node_modules/` |

This was normalized in TOOLS-10. Only actual binaries from `packages/` are bundled; extension runtime entrypoints are source-loaded by jiti.

## Dist Assembly Implication

The `dist/` directory assembled by `postinstall.sh` is a Pi Package. It contains resource declarations, extension source trees, skills, prompts, and themes. It does **not** contain `node_modules/` or manage npm dependencies.

For directory-based extensions, `postinstall.sh` copies the extension's `src/` directory and `package.json` into `dist/extensions/<name>/`. Pi then reads that package-local `pi.extensions` entry and jiti loads `./src/index.ts` from the assembled dist tree.

## jiti Aliases

Pi's extension loader configures jiti with aliases for known packages:

- `@mariozechner/pi-coding-agent`
- `@mariozechner/pi-tui`
- `@mariozechner/pi-ai`
- `@sinclair/typebox`

All other imports resolve via standard `node_modules/` resolution.

## New Module Gotcha

Adding a new module to a workspace package and re-exporting it often requires a **full agent restart**. `/reload` does not fully re-resolve the module dependency graph for the active session.

## Related Docs

- [build-system.md](build-system.md) — when to build, postinstall, and how `dist/` is assembled
- [pi-api-pitfalls.md](pi-api-pitfalls.md) — extension lifecycle and cross-extension behavior gotchas
