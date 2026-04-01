# Go — Code Review Reference

## Review Tooling

Run these on changed files before starting the qualitative review:

```bash
# Primary meta-linter with complexity checks
golangci-lint run --enable gocyclo,gocognit,funlen,nestif,dupl,goconst,unparam,bodyclose \
  --out-format json ./...

# Per-function CC (cross-language)
lizard --csv <changed-files>

# Unreachable code
deadcode ./...
```

## Common Bugs to Catch

**Error handling (the most common Go review issue):**
- `err` checked with `if err != nil` but the happy path proceeds regardless — verify
  the error path actually returns or prevents continued execution.
- Error variable shadowed by `:=` in an inner scope:
  ```go
  var err error
  if condition {
      result, err := doSomething()  // shadows outer err!
  }
  ```
- Errors ignored with `_`: `_ = file.Close()`. Acceptable for some cases (like
  closing a file opened for reading), but verify. Write operations that return errors
  on Close (e.g., buffered writers, database transactions) must NOT be ignored.
- Error wrapping without `%w`: `fmt.Errorf("failed: %v", err)` should use `%w` if
  callers need to unwrap with `errors.Is()` or `errors.As()`.
- Multiple error returns without wrapping — loses context about where the error occurred.

**Goroutine leaks:**
- Goroutines started without a shutdown mechanism. Every `go func()` should have a
  way to be signaled to stop (context cancellation, done channel, WaitGroup).
- Channel sends/receives without timeout — can hang forever if the other side dies.
- Goroutines reading from channels that are never closed — they'll block forever.

**Nil issues:**
- Interface nil check: an interface holding a nil pointer is NOT nil.
  `var p *MyStruct; var i interface{} = p; i == nil` is `false`. Flag any code that
  compares interfaces to nil when concrete types might be nil pointers.
- Nil map writes: reading from a nil map returns zero values, but writing panics.
  Verify maps are initialized before write operations.
- Nil slice vs empty slice: `var s []int` (nil) vs `s := []int{}` (empty). Both have
  length 0, but they marshal to JSON differently (`null` vs `[]`).

**Resource leaks:**
- `http.Response.Body` not closed — verify every HTTP response body is closed,
  including on error paths. Use `defer resp.Body.Close()` immediately after the
  error check.
- `sql.Rows` not closed — same pattern.
- `context.WithCancel` or `context.WithTimeout` without calling the cancel function.
  Always `defer cancel()`.
- File descriptors in loops — opening files in a loop with `defer` closes them all
  at function exit, not per-iteration.

**Data race candidates:**
- Shared state accessed from multiple goroutines without synchronization. Look for
  global variables, struct fields accessed from goroutines, and map access.
- `sync.WaitGroup` misuse: calling `wg.Add()` inside the goroutine instead of before it.

## Security Concerns

- **SQL injection:** Same as all languages — verify parameterized queries.
- **Command injection:** `exec.Command` is generally safe (no shell), but
  `exec.Command("bash", "-c", userInput)` is not.
- **Path traversal:** `filepath.Join` does NOT sanitize `..`. Use `filepath.Clean`
  and verify the result starts with the expected base.
- **HTTP response headers:** Missing security headers (CORS, CSP, HSTS) on web services.
- **TLS configuration:** Verify `InsecureSkipVerify` is not `true` in production.
- **Integer overflow:** Go integers wrap silently (like C). Verify arithmetic on
  user-controlled values.

## Idiom Violations to Flag

- Returning `(result, error)` but never checking the error at the call site.
- Using `init()` for anything beyond trivial setup — prefer explicit initialization.
- Creating interfaces at the provider rather than the consumer.
- `panic()` in library code (should return errors).
- `sync.Mutex` embedded in a struct without a comment about what it protects.
- Using `reflect` for operations that can be done with generics (Go 1.18+).
- Named return values used for their zero-value effect rather than documentation.
- `context.TODO()` left in production code.
- `log.Fatal()` or `os.Exit()` anywhere except `main()` — kills the process without
  running defers.

## Performance Traps

- String concatenation in loops — use `strings.Builder`.
- `append` without pre-allocating when the final size is known — use `make([]T, 0, n)`.
- `sync.Pool` for small objects (the overhead exceeds the benefit).
- Pointer receivers used unnecessarily on small structs — causes heap allocation.
  Value receivers for small, immutable structs can stay on the stack.
- Converting `[]byte` to `string` for comparison — use `bytes.Equal` instead.
- JSON marshaling/unmarshaling in hot paths — consider code-generated alternatives
  or binary formats.
