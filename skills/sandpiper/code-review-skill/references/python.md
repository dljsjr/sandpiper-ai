# Python — Code Review Reference

## Review Tooling

Run these on changed files before starting the qualitative review:

```bash
# Primary lint + complexity (fast, Rust-based)
ruff check --select C901,PLR0911,PLR0912,PLR0913,PLR0915,S,B --output-format json <changed-files>

# Detailed complexity breakdown (if Ruff's C901 isn't granular enough)
radon cc --min C --json <changed-files>

# Dead code in affected area
vulture --min-confidence 80 <changed-files>
```

## Common Bugs to Catch

**Mutable default arguments (the classic Python bug):**
```python
# BUG: shared list across calls
def add(item, items=[]):
    items.append(item)
    return items
```
Flag ANY mutable default: `[]`, `{}`, `set()`, custom objects. The fix is `None`
with an explicit check.

**Variable scoping in closures and comprehensions:**
- Late-binding closures in loops: `lambda: x` in a loop captures the variable `x`,
  not its current value. All lambdas will use the final value of `x`.
- Leaked loop variables: after `for x in items:`, `x` remains bound to the last value
  in the enclosing scope.

**Exception handling:**
- Bare `except:` or `except Exception:` that swallows errors silently. Every except
  block should either re-raise, log, or handle the specific exception.
- `except` catching too broad: `except ValueError` when the try block contains code
  that could raise `ValueError` for unrelated reasons.
- Missing `from` in re-raises: `raise NewError()` should be `raise NewError() from e`
  to preserve the chain.

**String and encoding issues:**
- Mixing `str` and `bytes` — especially in network/file code. Check that encoding
  boundaries are explicit.
- f-strings with side effects: `f"{obj.method()}"` — if method() mutates state, this
  is hidden and order-dependent.
- `.format()` or `%` formatting with untrusted input — potential format string attack
  if the template itself is user-controlled.

**Concurrency bugs:**
- Shared mutable state between threads without locks.
- `asyncio` mixed with blocking I/O — a blocking call in an async function blocks the
  entire event loop.
- `time.sleep()` in async code (should be `await asyncio.sleep()`).

**Type annotation issues:**
- `Optional[X]` used where `X | None` (3.10+) is clearer.
- Missing `-> None` return annotation on functions that don't return.
- `Any` usage — same concern as TypeScript. Flag it.
- `cast()` usage — same concern as `as` in TypeScript. Verify it's safe.

## Security Concerns

- **SQL injection:** String formatting/concatenation into SQL. Must use parameterized
  queries. This includes ORM `.raw()` and `.extra()` calls.
- **Command injection:** `os.system()`, `subprocess.call(shell=True)` with
  user-controlled input. Use `subprocess.run()` with `shell=False` and argument lists.
- **Pickle/YAML deserialization:** `pickle.loads()` and `yaml.load()` (without
  `Loader=SafeLoader`) on untrusted data. Both allow arbitrary code execution.
- **Path traversal:** `os.path.join(base, user_input)` does NOT prevent `../` traversal
  if `user_input` starts with `/`. Use `pathlib` and validate the resolved path starts
  with the intended base.
- **XML attacks:** `xml.etree.ElementTree` is vulnerable to XML bombs and XXE attacks
  on untrusted input. Use `defusedxml`.
- **Hardcoded secrets:** API keys, passwords, tokens in source code. Check for
  variables named `password`, `secret`, `token`, `key`, `api_key`.
- **Insecure temp files:** `tempfile.mktemp()` is vulnerable to race conditions.
  Use `tempfile.mkstemp()` or `tempfile.NamedTemporaryFile()`.

## Idiom Violations to Flag

- Using `type(x) == SomeType` instead of `isinstance(x, SomeType)`.
- Manual resource management (`open`/`close`) instead of `with` statements.
- `for i in range(len(items)):` instead of `for item in items:` or `for i, item in enumerate(items):`.
- Manually building strings in loops instead of `str.join()`.
- Using `dict.keys()` in `if x in dict.keys():` — just use `if x in dict:`.
- Empty collections checked with `len(x) == 0` instead of `not x`.
- Class with only `__init__` and one method — should be a plain function.
- Using `@staticmethod` for methods that don't access the class — make it a
  module-level function unless the class namespace is semantically important.

## Performance Traps

- Creating large intermediate lists when a generator would suffice:
  `sum([x**2 for x in range(10**6)])` vs `sum(x**2 for x in range(10**6))`.
- Repeated dictionary lookups in a loop — cache the value in a local variable.
- String concatenation in a loop — use `str.join()` or `io.StringIO`.
- Global imports inside frequently-called functions (import overhead per call).
- `in` check on a list when a set would be O(1) instead of O(n).
- Pandas: iterating with `.iterrows()` instead of vectorized operations.
- Repeated regex compilation — use `re.compile()` at module level.
