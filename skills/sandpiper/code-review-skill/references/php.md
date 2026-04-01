# PHP — Code Review Reference

## Review Tooling

Run these on changed files before starting the qualitative review:

```bash
# Primary static analysis (level 5+ catches real bugs)
phpstan analyse --level 5 --error-format json <changed-files>

# Metrics on affected classes
phpmetrics --report-json=/tmp/phpmetrics-review.json <changed-path>

# Style check (dry-run)
php-cs-fixer fix --dry-run --diff --format json <changed-files>

# Per-function CC
lizard --csv <changed-files>

# Duplication
phpcpd --min-lines 5 <changed-path>
```

## Common Bugs to Catch

**Type coercion surprises (PHP's most treacherous feature):**
- Missing `declare(strict_types=1)` at the top of the file. Without it, PHP silently
  coerces types: `"0" == false` is true, `"0" == null` is false, `"" == null` is true.
  Flag any file without strict types unless the project has intentionally opted out.
- `==` used where `===` is needed. Loose comparison in PHP produces notoriously
  counterintuitive results: `0 == "foo"` is true in PHP 7 (fixed in 8.0, but the
  habit persists). Always use `===` unless there's an explicit reason not to.
- `in_array()` without the third argument (`true` for strict): `in_array(0, ['foo'])`
  returns true with loose comparison. Flag every `in_array` call without the strict flag.
- `array_search()` same issue — returns `0` (falsy) for the first element, which is
  indistinguishable from `false` (not found) without strict comparison.
- `empty()` on properties: `empty($this->count)` is true when `$count` is `0`, `"0"`,
  `""`, `null`, `false`, or `[]`. Verify this is actually the intended check.

**Null handling:**
- Null coalescing (`??`) vs ternary (`?:`): `$x ?? 'default'` checks for null only;
  `$x ?: 'default'` checks for any falsy value. Mixing them up causes bugs.
- Nullable return types (`?Type`) without null checks at the call site. Trace the
  return value — is `null` handled everywhere it's consumed?
- Method calls on potentially null objects without null-safe operator (`?->`).
  `$user->getAddress()->getCity()` crashes if `getAddress()` returns null. Use
  `$user->getAddress()?->getCity()` (PHP 8.0+).

**Array issues:**
- Accessing array keys that may not exist: `$data['key']` throws a notice if `key`
  is absent. Use `$data['key'] ?? null` or `array_key_exists()`.
- `array_merge()` in a loop — it re-indexes on every call. Use `array_push()`,
  spread operator, or collect and merge once.
- Modifying an array while iterating with `foreach` — the behavior depends on whether
  iterating by reference (`&$value`) or by value. Iterating by value uses a copy, so
  modifications to the array don't affect the loop, which is often surprising.
- `foreach ($items as &$item)` — the reference `$item` persists after the loop.
  The next `foreach` using the same variable name reuses the reference, modifying
  the last element of `$items`. Always `unset($item)` after a by-reference foreach.

**Session and state:**
- Session data used without checking if the session is started.
- Session data stored without serialization awareness — objects stored in sessions
  must be serializable and their classes must be autoloadable at deserialization time.
- Static properties/singletons in long-running processes (Swoole, RoadRunner,
  Laravel Octane) — state persists across requests, causing data leakage between users.

**Error handling:**
- `try/catch` catching `\Exception` too broadly — masks bugs. Catch specific types.
- `catch` blocks that only log and continue — verify the code is in a valid state
  after the exception. Swallowing exceptions in the middle of a multi-step operation
  often leaves state inconsistent.
- Missing `finally` for resource cleanup.
- Using `trigger_error()` instead of throwing exceptions — legacy pattern that
  bypasses structured error handling.

## Security Concerns

- **SQL injection:** String interpolation or concatenation in queries. Must use
  prepared statements with parameter binding (`PDO::prepare` + `execute`, or
  ORM query builder). This includes raw queries in Eloquent (`DB::raw()`,
  `whereRaw()`, `selectRaw()`).
- **XSS:** Outputting user data without escaping. In Blade: `{!! $var !!}` bypasses
  escaping (flag always). `{{ $var }}` is safe. In raw PHP: must use `htmlspecialchars()`
  with `ENT_QUOTES` and explicit encoding.
- **CSRF:** Forms without CSRF tokens. In Laravel: missing `@csrf` directive.
- **Command injection:** `exec()`, `shell_exec()`, `system()`, `passthru()`,
  backtick operator with user input. Use `escapeshellarg()` and `escapeshellcmd()`
  if unavoidable.
- **File inclusion attacks:** `include`/`require` with user-controlled paths.
  Never construct include paths from user input.
- **Deserialization:** `unserialize()` on untrusted data allows object injection
  attacks. Use `json_decode()` instead, or use `unserialize()` with `allowed_classes`.
- **File upload:** Verify file type validation uses MIME detection (not just the
  extension), file size limits are enforced, and files are stored outside webroot.
- **Mass assignment:** In Laravel: `$fillable` / `$guarded` not set, or
  `Model::create($request->all())` without filtering. Verify `$fillable` is
  restrictive and doesn't include sensitive fields like `role` or `is_admin`.
- **Open redirect:** `redirect($request->input('url'))` without validating the
  target is an internal URL.
- **Information disclosure:** Detailed error messages in production. Verify
  `APP_DEBUG=false` / `display_errors=Off` in production config.

## Idiom Violations to Flag

- `array()` syntax instead of `[]` (short syntax has been preferred since 5.4).
- `new ClassName` without parentheses for no-argument constructors — while valid,
  inconsistency is confusing.
- `isset($x) && $x` instead of `$x ?? false` or just `$x`.
- String concatenation with `.` for complex strings instead of `"interpolation {$var}"`.
- `count($array) == 0` instead of `empty($array)` (when the empty semantics are correct)
  or `$array === []`.
- `call_user_func` / `call_user_func_array` instead of first-class callable syntax
  `$fn(...)` (PHP 8.1+).
- Class constants without visibility modifiers (default public, but should be explicit
  since PHP 7.1).
- Using `final` on everything or nothing — prefer `final` by default (prevents
  accidental extension), open only intentionally.
- `list($a, $b) = $arr` instead of `[$a, $b] = $arr` (short destructuring, PHP 7.1+).

## Performance Traps

- `array_merge()` in a loop — O(n²). Collect items with `$result[] = $item` and
  merge once, or use the spread operator: `array_merge(...$arrays)`.
- `preg_match` inside a loop with the same pattern — the pattern is recompiled each
  time unless PHP's internal PCRE cache hits. For very hot loops, consider alternatives.
- N+1 queries in Eloquent: accessing relationships in a loop without `with()` /
  `load()` eager loading. Same as Rails — the #1 Laravel performance bug.
- `file_get_contents` for HTTP requests — no connection pooling, no timeouts by
  default. Use Guzzle or the HTTP client component.
- `serialize()` / `unserialize()` for caching complex objects — slower than
  `json_encode()` / `json_decode()` for simple data structures.
- Creating service objects inside loops instead of injecting once via the container.
- `DateTime` object creation in tight loops — reuse or use timestamps.
