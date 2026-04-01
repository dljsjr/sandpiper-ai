# Lua — Code Review Reference

## Review Tooling

Run these on changed files before starting the qualitative review:

```bash
# Primary lint
luacheck --formatter plain --codes --ranges <changed-files>

# Per-function CC
lizard --csv <changed-files>
```

luacheck is the standard Lua linter. It catches unused variables, undefined globals,
shadowing, unreachable code, and style issues. It supports `.luacheckrc` configuration
and outputs machine-parseable formats. For Lua projects embedded in larger applications
(game engines, Neovim plugins, OpenResty), configure the globals for the host
environment to avoid false positives.

## Common Bugs to Catch

**Table semantics (Lua's unified data structure — arrays and dicts are the same):**
- Tables with mixed integer and string keys behave unpredictably with `#` (length
  operator), `ipairs`, and `table.sort`. Verify tables are either array-like (integer
  keys 1..n) or map-like (string keys), not a mix.
- `#t` returns the length of the array part only and may not equal the number of
  elements if there are holes (nil values in the sequence). Using `#` on a table
  with holes is undefined behavior in Lua 5.x.
- `table.remove` shifts indices — iterating with `for i=1,#t` while removing causes
  skipped elements. Iterate in reverse or collect indices to remove.
- Tables are compared by reference, not by value: `{1,2} == {1,2}` is `false`.
  Verify deep equality comparisons use a custom function or library.

**Nil-related bugs:**
- Accessing a missing key returns `nil` silently — no "key not found" error.
  This means typos in field names produce nil instead of errors:
  `config.timout` (typo) returns nil instead of failing.
- `nil` in tables creates holes. Inserting nil into an array breaks `#` and `ipairs`.
- Function calls with missing arguments receive nil — no arity checking. A function
  expecting 3 args called with 2 silently gets `nil` for the third.
- `if x then` is false for both `nil` and `false`. If `false` is a valid value,
  use `if x ~= nil then`.

**Scope and variable issues:**
- Missing `local` keyword — variables are global by default. This is the most common
  Lua bug. Every variable should be `local` unless intentionally global. luacheck
  catches this, but verify in code where luacheck may not run.
- Upvalue capture in loops — all closures in a loop share the same upvalue. The
  classic `for i=1,10 do callbacks[i] = function() return i end end` captures the
  same `i`. Use an extra `do` block or an immediately-invoked function to create
  a new scope.
- Shadowing: `local x = x` is a common pattern (localizing a global for speed)
  but can cause confusion. Verify intent when variables shadow outer scope.

**String and number coercion:**
- Lua automatically coerces strings to numbers in arithmetic: `"5" + 3 == 8`. This
  can mask type errors. Verify that string/number boundaries are intentional.
- `tonumber()` returns nil on failure, not an error. Check the return value.
- String concatenation with `..` on nil raises an error — check for nil first.

**Metatables and OOP:**
- Missing `self` parameter in method calls: `obj.method()` vs `obj:method()`. The
  colon syntax passes `self` automatically; the dot syntax does not. Mixing them up
  is a common bug.
- Metatable `__index` chains — verify they don't create cycles (infinite recursion
  on lookup). Also verify that deeply chained `__index` lookups don't hide
  performance problems.
- `__newindex` not handling rawset correctly — can cause infinite recursion.
- Missing `__tostring` metamethod on objects used in string contexts — Lua will
  produce `table: 0x...` instead of useful output.

**Coroutine issues:**
- `coroutine.resume` swallows errors by default (returns `false, error_message`).
  Verify that callers check the return value and don't silently discard errors.
- Yielding across C call boundaries (in embedded Lua) — not allowed in standard
  Lua 5.1. LuaJIT and Lua 5.2+ handle this differently.

## Security Concerns

- **Code injection:** `loadstring()` / `load()` on untrusted input — equivalent
  to `eval()` in other languages. Always flag.
- **Sandbox escapes:** If Lua is embedded as a scripting language with a sandbox,
  verify that `os`, `io`, `debug`, `loadfile`, and `dofile` are not accessible.
  The `debug` library is particularly dangerous (can modify any upvalue).
- **Path traversal:** Same as other languages — validate file paths from user input.
- **Denial of service:** Untrusted Lua scripts without CPU/memory limits. In embedded
  contexts, verify that `debug.sethook` or a custom allocator limits execution.
- **Module loading:** `require()` searches `package.path` and `package.cpath` —
  verify these don't include user-writable directories.

## Idiom Violations to Flag

- `if x == true then` instead of `if x then` (unless distinguishing true from truthy).
- `if x == nil then` instead of `if not x then` (unless `false` is a valid value).
- Using `table.getn(t)` (deprecated since 5.1) instead of `#t`.
- Using `unpack` instead of `table.unpack` (Lua 5.2+ moved it).
- String building with `..` in a loop — use `table.concat` (much faster for many
  concatenations).
- Using globals for module-internal state. Modules should return a table of public
  functions and keep state in local upvalues.
- Module files that set globals instead of returning a table — this is the pre-5.1
  pattern and breaks `require()` caching semantics.
- `pairs()` used where `ipairs()` is appropriate — `pairs` has undefined order,
  which matters for arrays where order is significant.

## Performance Traps

- String concatenation in loops: `s = s .. chunk` creates a new string each iteration
  (Lua strings are immutable). Use `table.insert(parts, chunk)` then `table.concat(parts)`.
- Global variable access in hot paths — localize globals at the top of the function:
  `local pairs = pairs`, `local type = type`. This is idiomatic Lua for performance.
- Creating closures in hot loops — each iteration allocates a new closure object.
  If the closure doesn't capture loop-varying state, hoist it outside the loop.
- `table.insert(t, 1, v)` shifts all elements — O(n). If you need a queue, use
  a double-ended structure or track head/tail indices.
- `string.find`/`string.match` with complex patterns on large strings — Lua patterns
  don't have the same backtracking risks as PCRE, but they're still O(n*m) worst case.
- In LuaJIT: avoid `pairs()` in hot loops (not JIT-compiled). Use array-style
  iteration with `for i=1,n` instead.
