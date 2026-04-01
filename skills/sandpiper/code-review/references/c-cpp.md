# C / C++ — Code Review Reference

## Review Tooling

Run these on changed files before starting the qualitative review:

```bash
# Primary lint (needs compile_commands.json)
clang-tidy -checks='readability-function-cognitive-complexity,readability-function-size,bugprone-*,cert-*,misc-*' <changed-files>

# Bug finding (no compilation needed)
cppcheck --enable=all --suppress=missingInclude --xml <changed-files> 2>&1

# Per-function CC
lizard --csv <changed-files>
```

## Common Bugs to Catch

**Memory safety (the top priority in any C/C++ review):**
- Use-after-free: verify that no pointer is accessed after the memory it points to
  has been freed, goes out of scope, or is moved from.
- Double-free: verify that ownership is clear — exactly one owner frees each allocation.
- Buffer overflow: verify all array accesses are bounds-checked, especially with
  user-controlled indices or sizes. Check `memcpy`, `strcpy`, `strcat`, `sprintf`.
- Null pointer dereference: verify pointers returned from allocation or lookup are
  checked before use.
- Memory leaks: verify every `malloc`/`new` has a corresponding `free`/`delete` on
  all code paths including error paths. In C++, prefer smart pointers.
- Dangling references: returning reference/pointer to local variable, or iterating
  a container while modifying it.

**Undefined behavior (critical — compiler can do anything):**
- Signed integer overflow.
- Shift amounts ≥ bit width of the type.
- Accessing union members not last written.
- Strict aliasing violations (casting between unrelated pointer types).
- Sequence point violations: `a[i] = i++` is UB.
- Dereferencing null or invalid pointers.
- Reading uninitialized variables.

**Concurrency:**
- Data races on shared variables without atomics or mutexes.
- Lock ordering inconsistencies that can cause deadlocks.
- Missing volatile or atomic on variables accessed from signal handlers.
- TOCTOU (time-of-check to time-of-use) races on file operations.

**API contract violations:**
- Passing wrong size to `memcpy`, `memset`, `sizeof` (especially `sizeof(ptr)` vs
  `sizeof(*ptr)` or `sizeof(array)`).
- Mismatched `malloc`/`free` and `new`/`delete` (never mix them).
- Missing null terminators on strings passed to C string functions.
- Format string mismatches (`%d` for `long`, `%s` for non-string).

## Security Concerns

- **Format string vulnerabilities:** User input as the format argument to `printf` family.
  Always use `printf("%s", user_input)` not `printf(user_input)`.
- **Buffer overflows:** `gets()` (never use), `strcpy`/`strcat` without length checks,
  `scanf` without field width limits. Prefer `strncpy`, `snprintf`, `fgets`.
- **Integer overflow leading to buffer undersizing:** `malloc(n * sizeof(T))` when
  `n * sizeof(T)` overflows. Check with `SIZE_MAX / sizeof(T)`.
- **Use of unsafe functions:** `system()`, `popen()` with user-controlled strings.
- **Uninitialized memory disclosure:** Structs with padding bytes sent over network
  can leak stack data. Zero-initialize with `memset` or `= {}`.

## Idiom Violations to Flag

**C++:**
- Raw `new`/`delete` instead of `std::unique_ptr` or `std::shared_ptr`.
- C-style casts `(Type)expr` instead of `static_cast<Type>(expr)`.
- `NULL` or `0` instead of `nullptr`.
- Manual loops that could be `std::transform`, `std::find_if`, range-for.
- `using namespace std;` in headers.
- Copy constructors/assignment not following Rule of 0/3/5.
- `const` missing on methods that don't modify state.

**C:**
- Magic numbers without named constants.
- Functions longer than 60 lines without extraction.
- Global mutable state without documented synchronization requirements.
- Missing `const` on pointer parameters that don't modify the pointed-to data.

## Performance Traps

- Copying large structs/objects by value in loops — pass by const reference/pointer.
- `std::map` where `std::unordered_map` suffices (O(log n) vs O(1) lookup).
- `std::endl` in loops — use `'\n'` (endl flushes, which is slow).
- Virtual function calls in tight inner loops — consider CRTP or templates.
- Allocating in a loop — pre-allocate or use stack-based containers.
- `std::shared_ptr` where `std::unique_ptr` suffices — shared_ptr has atomic
  reference counting overhead.
