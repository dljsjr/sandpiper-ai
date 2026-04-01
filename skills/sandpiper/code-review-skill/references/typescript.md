# TypeScript / JavaScript — Code Review Reference

## Review Tooling

Run these on changed files before starting the qualitative review:

```bash
# Primary lint (fast, Rust-based)
biome lint --reporter json <changed-files>

# Complexity measurement (Biome doesn't measure CC)
lizard --csv <changed-files>
# OR: ESLint with complexity rules
eslint --rule '{"complexity": ["warn", 15], "max-depth": ["warn", 4]}' --format json <changed-files>

# Dead exports in the affected area
knip --reporter json
```

## Common Bugs to Catch

**Async/Promise issues (highest bug density in JS/TS reviews):**
- Missing `await` on async function calls — the code "works" but runs out of order.
  Look for async functions called without `await` whose return value is used.
- Unhandled promise rejections — any `.then()` without a `.catch()`, or any `await`
  not inside a try/catch when the failure mode matters.
- `Promise.all` used where `Promise.allSettled` is needed — if one failure shouldn't
  abort the others.
- `forEach` with `async` callback — `Array.forEach` does not await async callbacks.
  Use `for...of` or `Promise.all(items.map(...))`.
- Fire-and-forget async calls that silently swallow errors.

**Type system escape hatches:**
- `any` usage — every `any` is a bug waiting to happen. Flag it. If there's a
  legitimate reason, it should be `unknown` with explicit narrowing.
- Type assertions (`as Type`) — these bypass the type checker. Verify they're safe.
  Prefer type guards (`if (isType(x))`) over assertions.
- Non-null assertions (`!`) — equivalent to "trust me, this isn't null." Verify the
  claim is actually true, especially when the value comes from external data.
- `// @ts-ignore` or `// @ts-expect-error` — read the suppressed error. Is the
  suppression justified, or is it hiding a real type error?

**Equality and truthiness:**
- `==` instead of `===` — almost always a bug in disguise. The only acceptable uses
  are `x == null` (checks both null and undefined) and comparison with known same-type values.
- Truthiness checks on values where `0`, `""`, or `false` are valid: `if (count)`
  fails when `count` is `0`. Use `if (count !== undefined)` or `if (count != null)`.

**Closure and reference issues:**
- Closures over `let` in loops — verify the variable is captured at the right time.
- `this` binding in callbacks — arrow functions capture `this` from the enclosing
  scope; regular functions do not. Mixing them up is a common bug.
- Object mutation via shared reference — check whether objects passed to functions
  are mutated when the caller doesn't expect it.

**Array/Object methods:**
- `.sort()` mutates the original array. Use `.toSorted()` (ES2023) or spread first.
- `.splice()` modifies in place and returns the removed items — verify the author
  isn't accidentally using the return value as the modified array.
- Object spread `{...a, ...b}` silently drops properties when keys overlap.

## Security Concerns

- **DOM injection:** Any use of `innerHTML`, `dangerouslySetInnerHTML`, `document.write`,
  or template literal interpolation into HTML without escaping. Flag these always.
- **eval and friends:** `eval()`, `new Function()`, `setTimeout/setInterval` with
  string arguments. Flag these always.
- **Regex denial of service:** User-controlled input in `new RegExp()` without
  sanitization. Catastrophic backtracking is a real DoS vector.
- **Prototype pollution:** `Object.assign` or spread with untrusted input that could
  contain `__proto__`, `constructor`, or `prototype` keys.
- **Path traversal:** String concatenation for file paths without sanitizing `..`.
- **Open redirects:** Redirecting to user-provided URLs without validating the domain.

## Idiom Violations to Flag

- Manually iterating with index when `.map()`, `.filter()`, `.reduce()`, or `for...of`
  would be clearer.
- Creating a class with only static methods — should be plain functions or a module.
- Using `let` where `const` would work (no reassignment).
- Barrel files (`index.ts` re-exporting everything) in application code — obscures
  dependencies and hurts tree-shaking.
- Using `namespace` in TypeScript — a legacy pattern; use modules.
- Callback-based APIs when the underlying operation supports promises.
- String concatenation for building complex strings — use template literals.

## Performance Traps

- Creating objects or arrays inside render loops (React: triggers unnecessary re-renders).
- `JSON.parse(JSON.stringify(x))` for deep cloning — use `structuredClone()`.
- Unnecessary `await` in return position: `return await fn()` adds a tick vs `return fn()`.
  Exception: inside `try/catch`, `return await` is needed to catch rejection.
- Regex compiled inside a loop — move it to a constant.
- Large synchronous operations on the main thread (Node: file I/O without streaming).
