# Rust — Code Review Reference

## Review Tooling

Run these on changed files before starting the qualitative review:

```bash
# Primary lint with complexity checks
cargo clippy --message-format=json -- \
  -W clippy::cognitive_complexity \
  -W clippy::too_many_lines \
  -W clippy::too_many_arguments \
  -W clippy::pedantic 2>&1 | jq 'select(.reason == "compiler-message")'

# Per-function CC
lizard --csv src/

# Line count / maintenance burden (first-class review signal)
scc --format json --by-file <path>
```

Treat `scc` as a first-class code health metric alongside `lizard` and `jscpd`.
Line count is strongly correlated with maintenance burden and defect density
at the file level.

### Interpreting lizard CC for Rust

`lizard` counts Rust's `?` (try) operator as a branch point, which inflates
cyclomatic complexity for functions that do a lot of error propagation. A
function full of `row.get(N)?` calls may report CC 16 but contain no actual
decision logic — just linear data extraction with early-exit on error.

When a Rust function exceeds the CC threshold, check whether the complexity
comes from real branching (if/match/loops/nesting) or from `?`-heavy error
propagation in flat code. The former is genuinely actionable; the latter is
a tool artifact and should be weighted lower in review findings.

The threshold is still useful as a signal — just interpret it with this
context before deciding whether refactoring is warranted.

## Common Bugs to Catch

**Ownership and lifetime issues (even with the borrow checker):**
- `.clone()` used to satisfy the borrow checker without understanding why — often
  a sign of a design problem. Ask: is cloning necessary, or should the data structure
  be reorganized?
- `Rc<RefCell<T>>` or `Arc<Mutex<T>>` used pervasively — indicates shared mutable
  state that could be restructured as message passing or ownership transfer.
- Lifetime elision hiding surprising semantics — when a function returns a reference,
  verify the elided lifetime connects to the right input.

**Error handling:**
- `.unwrap()` in library code or production paths. Acceptable in tests, prototyping,
  and cases provably safe (document with a comment explaining why).
- `.expect()` with unhelpful messages: `.expect("failed")`. The message should explain
  why the None/Err case is believed impossible.
- Using `Box<dyn Error>` or `anyhow::Error` in library APIs (fine for applications).
  Libraries should define typed errors.
- Silently mapping errors to a less specific type, losing diagnostic information.
- Missing `?` propagation — manual match on Result when `?` would be clearer.

**Unsafe code:**
- Every `unsafe` block must have a SAFETY comment explaining why the invariants hold.
  Flag any `unsafe` without a justification.
- Verify that unsafe code doesn't violate aliasing rules (no mutable aliasing),
  doesn't create dangling references, and maintains type invariants.
- `unsafe impl Send/Sync` — verify the type actually satisfies the safety contract.
  Getting this wrong causes undefined behavior.
- Transmute — almost always wrong. Prefer `from_ne_bytes`, pointer casts, or
  `bytemuck` for reinterpretation.

**Concurrency:**
- `Mutex` held across `.await` points — can deadlock. Use `tokio::sync::Mutex` for
  async code or restructure to hold the lock for shorter duration.
- Spawning blocking operations on the async executor — use `spawn_blocking`.
- Missing `Send` bounds on futures that cross thread boundaries.

**Integer overflow:**
- Arithmetic operations in release mode silently wrap. Use `checked_*`, `saturating_*`,
  or `wrapping_*` when overflow is possible and the behavior matters.

## Security Concerns

- **Unsafe FFI boundaries:** Verify that data passed through FFI has correct sizes,
  alignments, and lifetimes. Null pointers must be checked before dereferencing.
- **Untrusted deserialization:** `serde` will happily deserialize into any type.
  Validate deserialized data before using it, especially from network input.
- **Path traversal:** Same as other languages — validate resolved paths.
- **Timing attacks:** Constant-time comparison for secrets/tokens. Use
  `subtle::ConstantTimeEq` instead of `==`.

## Idiom Violations to Flag

- Manual `match` on `Option`/`Result` when combinators would be clearer:
  `.map()`, `.and_then()`, `.unwrap_or_else()`, `.ok_or()`.
- `if let Some(x) = opt { x } else { default }` → use `opt.unwrap_or(default)`.
- `if condition { true } else { false }` → just `condition`.
- `vec.iter().filter(...).count() > 0` → `vec.iter().any(...)`.
- Building `String` with `.push_str()` in a loop → use `format!()`, `join()`, or
  `write!()` to a `String`.
- `&Vec<T>` in function signatures → use `&[T]`. `&String` → use `&str`.
  `&Box<T>` → use `&T`.
- `impl` block with 20+ methods — split into trait impls or separate inherent
  impl blocks by logical grouping.

## Performance Traps

- `.collect::<Vec<_>>()` followed by `.iter()` — often the intermediate collection
  is unnecessary. Chain iterators directly.
- `String` allocation in hot paths when `&str` or `Cow<str>` would suffice.
- `HashMap` with small key counts (< 20) where a `Vec` linear scan would be faster.
- `to_string()` / `format!()` in Display implementations — causes recursive
  allocation. Use `write!()` instead.
- Excessive monomorphization from generics — each concrete type generates a separate
  copy of the function. Consider trait objects for code that handles many types.
