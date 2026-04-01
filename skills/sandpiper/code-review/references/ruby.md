# Ruby — Code Review Reference

## Review Tooling

Run these on changed files before starting the qualitative review:

```bash
# Primary linter with metrics
rubocop --only Metrics,Security,Lint --format json <changed-files>

# ABC pain score
flog --threshold 25 <changed-files>

# Structural duplication
flay <changed-files>

# Per-function CC
lizard --csv <changed-files>
```

## Common Bugs to Catch

**Nil-related bugs (Ruby's most common runtime error):**
- Calling methods on potentially nil values without `&.` (safe navigation) or
  explicit nil checks. `NoMethodError: undefined method for nil:NilClass` is the
  most common Ruby exception in production.
- `Array#first`, `Hash#[]`, `find`, `detect` all return nil on no match — verify
  the nil case is handled.
- Difference between `nil?` and `blank?`/`present?` in Rails — `""`, `[]`, `{}`
  are not nil but are blank.

**Symbol/String confusion:**
- Symbols are immutable and interned; strings are mutable and allocated. Using
  user-controlled strings as hash keys (`hash[user_input]`) when symbols are
  expected causes silent lookup failures.
- `to_sym` on untrusted input — in older Ruby, symbols are never GC'd, causing
  memory leaks. Ruby 2.2+ garbage-collects dynamic symbols, but it's still a
  code smell.

**Block/Proc/Lambda differences:**
- `Proc.new` vs `lambda` — procs use the caller's return context (a `return` in
  a proc returns from the enclosing method), while lambdas return from themselves.
  Verify the author chose the right one.
- Missing block arity checks — procs silently ignore extra/missing arguments,
  while lambdas enforce arity. If argument count matters, use lambda.

**Rails-specific:**
- N+1 queries: accessing associations in a loop without eager loading
  (`includes`, `preload`, `eager_load`). This is the #1 Rails performance bug.
- Mass assignment: verify `strong_parameters` (`.permit()`) is used and doesn't
  over-permit (e.g., `.permit!` or permitting `role`, `admin`, `id`).
- Callbacks that can fail silently: `before_save` returning `false` halts the
  chain (legacy behavior). `throw :abort` is the modern way.
- `find_by` returns nil on no match; `find` raises. Verify the caller handles
  the return correctly for the method used.
- Scope leaks: class-level mutable state (`@@` or `class << self`) that's shared
  across requests in threaded servers.

## Security Concerns

- **SQL injection:** `where("name = '#{params[:name]}'")` — must use parameterized:
  `where(name: params[:name])` or `where("name = ?", params[:name])`.
- **XSS:** Any `raw()` or `html_safe` call — verify the content is actually safe.
  ERB auto-escapes by default, but these disable it.
- **CSRF:** Verify `protect_from_forgery` is active and not globally skipped.
- **Insecure deserialization:** `Marshal.load`, `YAML.load` on untrusted data.
  Use `YAML.safe_load`.
- **Open redirect:** `redirect_to params[:url]` — must validate the URL is internal.
- **File upload:** Verify uploaded files are validated (type, size) and stored
  outside the document root.
- **Regular expression DoS:** Ruby's regex engine is susceptible to catastrophic
  backtracking. Verify user-controlled input isn't used in complex patterns.

## Idiom Violations to Flag

- `if !condition` instead of `unless condition` (for simple cases).
- Explicit `return` at the end of a method (Ruby returns the last expression).
- `self.method_name` when `self` is not required (it's required only for assignment
  and disambiguation).
- Using `for x in collection` instead of `collection.each`.
- `begin/rescue/end` wrapping an entire method — use the method body as the
  implicit begin block.
- String concatenation with `+` instead of interpolation: `"Hello " + name` →
  `"Hello #{name}"`.
- `and`/`or` used for control flow — these have different precedence than `&&`/`||`
  and cause subtle bugs. Use `&&`/`||`.

## Performance Traps

- N+1 queries (mentioned above — the single biggest Rails performance issue).
- `ActiveRecord#all.count` instead of `ActiveRecord#count` (loads all records
  into memory just to count them).
- `pluck` or `select` not used when only specific columns are needed.
- Creating ActiveRecord objects in loops with individual `save` calls instead
  of `insert_all` or `upsert_all`.
- `String#gsub` with a regex for simple character replacement — use `tr` instead.
- Excessive middleware in the Rack/Rails stack for simple API endpoints.
