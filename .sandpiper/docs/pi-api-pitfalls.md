# Pi Extension API Pitfalls

Read when: working on extension lifecycle hooks, flags, cross-extension communication, shared state, or cross-package imports used by extensions.
Last verified: 2026-03-30

## Key Rules

- Register and read flags with bare names: `registerFlag("my-flag")` pairs with `getFlag("my-flag")`, not `getFlag("--my-flag")`.
- Use `session_directory` for CLI-style flags that do work and exit before a session is created.
- Treat module-level state as extension-local. Separate jiti loads do not share module instances.
- Use `pi.events` for cross-extension coordination, and dedupe listener effects across `/reload` cycles.
- For cross-package TypeScript imports, prefer project references plus package exports; do not widen `rootDir` to make types line up.
- Avoid `instanceof` across jiti boundaries; use duck typing for Pi/internal objects that may come from another module instance.

## Canonical Examples

- `extensions/system.ts`
- `packages/core/src/preflight.ts`
- `packages/core/package.json`
- `extensions/shell-relay/src/index.ts`

## Reference

Known issues and non-obvious behaviors in pi's extension API.

## `pi.getFlag()` uses bare names

Register and read flags **without** the `--` prefix:

```typescript
pi.registerFlag("my-flag", { type: "boolean" });
pi.getFlag("my-flag");     // ✅ returns the value
pi.getFlag("--my-flag");   // ❌ always returns undefined
```

The pi docs have historically shown `getFlag("--my-flag")`, but the implementation and working examples use bare names.

## `session_directory` for CLI-only early-exit flags

Use `session_directory` (not `session_start`) for flags that perform an action and exit:

- fires after flag values are populated
- fires before the session manager is created
- can safely call `process.exit()`
- receives only `event.cwd` — no `ctx`, no UI

## Module-level state is **not** shared across jiti instances

Each extension loaded by jiti gets its own module scope. A module-level array in `packages/core` will be a different instance in each extension. Use `pi.events` for cross-extension communication instead.

## `pi.events` **is** shared across extensions

`pi.events.on()` and `pi.events.emit()` are synchronous and work across all jiti-loaded extensions. This is the right channel for patterns like preflight check collection where one extension emits and others respond.

**Caution:** `pi.events.on()` listeners accumulate across `/reload` cycles because the event bus persists but extension factories re-register listeners. Deduplicate by key when collecting results.

## Cross-package TypeScript: use project references

When an extension imports from a workspace package, use TypeScript project references instead of widening `rootDir`:

```json
// packages/core/tsconfig.json
{ "compilerOptions": { "composite": true, "declaration": true } }

// extensions/shell-relay/tsconfig.json
{ "references": [{ "path": "../../packages/core" }] }
```

The referenced package must be built first (`tsc --build`). Use conditional exports in `package.json` to serve types from `dist/` and source from `src/`:

```json
{ "exports": { ".": { "types": "./dist/index.d.ts", "default": "./src/index.ts" } } }
```

## `instanceof` fails across jiti module boundaries

Do not use `instanceof` to check types of objects from other extensions or from Pi internals. Each jiti instance can have its own copy of class constructors. Use duck typing instead:

```typescript
// ❌ Fails across jiti boundaries
if (candidate instanceof Container) { ... }

// ✅ Duck typing
if (candidate && "addChild" in candidate) { ... }
```

## Related Docs

- [extension-loading.md](extension-loading.md) — how jiti loads extensions and where module-scope boundaries come from
- [agent-guidance-evolution.md](agent-guidance-evolution.md) — current prompt-side vs hook-side guidance plan
