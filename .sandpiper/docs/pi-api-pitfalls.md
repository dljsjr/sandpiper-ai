# Pi Extension API Pitfalls

Known issues and non-obvious behaviors in pi's extension API.

## `pi.getFlag()` uses bare names

Register and read flags **without** the `--` prefix:

```typescript
pi.registerFlag("my-flag", { type: "boolean" });
pi.getFlag("my-flag");     // ✅ returns the value
pi.getFlag("--my-flag");   // ❌ always returns undefined
```

The pi docs show `getFlag("--my-flag")` but this is incorrect. The plan-mode example and the implementation both use bare names. Flags are stored in `extension.flags` by the name passed to `registerFlag`.

## `session_directory` for CLI-only early-exit flags

Use `session_directory` (not `session_start`) for flags that perform an action and exit:

- Fires **after** flag values are populated (second arg parse pass)
- Fires **before** session manager is created — no session to clean up
- Can call `process.exit()` safely
- Receives only `event.cwd` — no `ctx` (no UI access)

## Module-level state is NOT shared across jiti instances

Each extension loaded by jiti gets its own module scope. A module-level array in `packages/core` will be a different instance in each extension. Use `pi.events` (the shared runtime event bus) for cross-extension communication instead.

## `pi.events` IS shared across extensions

`pi.events.on()` and `pi.events.emit()` are synchronous and work across all jiti-loaded extensions. Use this for patterns like preflight check collection where one extension emits and others respond.

**Caution:** `pi.events.on()` listeners accumulate across `/reload` cycles — the event bus persists but extension factories re-register listeners. Deduplicate by key when collecting results.

## Cross-package TypeScript: use project references

When an extension imports from a workspace package (e.g., `sandpiper-ai-core`), use TypeScript project references instead of widening `rootDir`:

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

Don't use `instanceof` to check types of objects from other extensions or from Pi internals. Each jiti instance has its own copy of class constructors. Use duck typing instead:

```typescript
// ❌ Fails across jiti boundaries
if (candidate instanceof Container) { ... }

// ✅ Duck typing
if (candidate && 'addChild' in candidate) { ... }
```
