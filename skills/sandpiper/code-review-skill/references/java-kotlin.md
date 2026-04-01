# Java / Kotlin — Code Review Reference

## Review Tooling

Run these on changed files before starting the qualitative review:

```bash
# Java: PMD with bug-finding and design rules
pmd check -d <path> -R category/java/errorprone.xml,category/java/design.xml,category/java/bestpractices.xml,category/java/security.xml -f json

# Java: CPD duplication detection
pmd cpd --dir <path> --minimum-tokens 50 --format json --language java

# Kotlin: detekt
detekt --input <path> --report json:detekt-report.json

# Per-function CC
lizard --csv <changed-files>
```

## Common Bugs to Catch

**Null handling (Java's billion-dollar mistake):**
- `@Nullable` return values used without null checks. Trace every nullable return
  to its consumers.
- `Optional` misuse: calling `.get()` without `.isPresent()` — prefer `.orElse()`,
  `.orElseThrow()`, `.map()`, `.ifPresent()`.
- `Optional` used as a method parameter or field — it's designed for return values only.
- In Kotlin: platform types from Java interop (`Type!`) — these bypass null safety.
  Add explicit nullability annotations at the boundary.
- In Kotlin: `!!` (non-null assertion) — same concern as Swift's `!`. Flag every use.

**Concurrency:**
- Shared mutable state without synchronization. Check for non-volatile, non-atomic
  fields accessed from multiple threads.
- `HashMap` used in concurrent context — must be `ConcurrentHashMap`.
- `SimpleDateFormat` used across threads — it's not thread-safe. Use `DateTimeFormatter`
  (immutable).
- `synchronized` on wrong monitor: `synchronized(this)` in a class where callers
  synchronize on a different object.
- `CompletableFuture` chains without exception handling — unhandled exceptions
  are silently swallowed.

**Resource leaks:**
- `InputStream`, `Connection`, `ResultSet`, `BufferedReader` not closed in finally
  or try-with-resources. This is the most common Java bug in reviews.
- In Kotlin: missing `.use {}` (the equivalent of try-with-resources).
- JDBC resources: verify that `Connection`, `PreparedStatement`, AND `ResultSet`
  are all closed — closing one does not always close the others.

**Equality and identity:**
- `==` on objects (compares identity, not value). Use `.equals()`. Exception:
  enums and `null` checks.
- `.equals()` without null check: `a.equals(b)` throws NPE if `a` is null. Use
  `Objects.equals(a, b)`.
- `hashCode()` not overridden when `equals()` is — breaks `HashMap`/`HashSet`.
- In Kotlin: `==` does structural equality (correct), but `===` does identity
  comparison. Verify the right one is used.

**Generics and type safety:**
- Raw types: `List` instead of `List<String>` — disables type checking.
- Unchecked casts with `@SuppressWarnings("unchecked")` — verify the cast is safe.
- Type erasure surprises: `List<String>` and `List<Integer>` are the same type
  at runtime. Method overloading based on generic type parameters doesn't work.

**Exception handling:**
- Catching `Exception` or `Throwable` — too broad. Catch specific types.
- Empty catch blocks (`catch (Exception e) {}`) — at minimum, log the exception.
- `throws Exception` on method signatures — too broad. Declare specific exceptions.
- In Kotlin: treating all exceptions as unchecked doesn't mean they shouldn't be
  handled. Check what the called Java code might throw.

## Security Concerns

- **SQL injection:** String concatenation in queries. Must use `PreparedStatement`
  with parameter binding, or JPA/Hibernate parameterized queries.
- **XXE attacks:** `DocumentBuilderFactory`, `SAXParser`, `XMLInputFactory` without
  disabling external entities. Set `FEATURE_SECURE_PROCESSING` and disable
  `EXTERNAL_GENERAL_ENTITIES`.
- **Deserialization:** `ObjectInputStream.readObject()` on untrusted data allows
  arbitrary code execution. Use allowlists or avoid Java serialization entirely.
- **Path traversal:** `new File(base, userInput)` doesn't prevent `../`. Use
  `Path.normalize()` and verify the result starts with the expected base.
- **Log injection:** Untrusted data in log messages can inject fake log entries
  or exploit log4j-style vulnerabilities. Sanitize newlines and control characters.
- **SSRF:** Fetching URLs from user input without validating the target (no internal
  IPs, no file:// scheme).
- **Hardcoded credentials:** Search for `password`, `secret`, `apiKey` in source.

## Idiom Violations to Flag

**Java:**
- Verbose patterns that modern Java has replaced: anonymous inner classes for
  single-method interfaces → use lambdas. `StringBuffer` in single-threaded
  code → use `StringBuilder`. `Vector`/`Hashtable` → use `ArrayList`/`HashMap`.
- Not using records (16+) for simple data carriers.
- Not using `var` (10+) where the type is obvious from the right side.
- `if (x != null && x.equals(y))` → use `Objects.equals(x, y)`.
- `Collections.unmodifiableList(new ArrayList<>(list))` → use `List.copyOf(list)` (10+).
- Getters/setters on every field without justification.

**Kotlin:**
- Using Java collection types instead of Kotlin's `List`/`Map`/`Set`.
- `if (x != null) { x.method() }` → use `x?.method()`.
- `lateinit var` used where constructor initialization is possible.
- `companion object` containing utility functions that should be top-level.
- `data class` with mutable properties (`var`) — defeats the purpose of value semantics.
- `it` used in deeply nested lambdas where named parameters would be clearer.
- `when` without exhaustive coverage on sealed types — compiler warning since 1.7.

## Performance Traps

- Autoboxing in loops: `List<Integer>` + loop with `int` → boxing on every add.
  Use primitive arrays or specialized collections for hot paths.
- String concatenation in loops: use `StringBuilder` or `StringJoiner`.
- `Stream` with `collect(Collectors.toList())` → use `.toList()` (Java 16+).
- Creating `Pattern` inside frequently-called methods → compile once, store as
  a constant.
- `Optional` creation in hot paths — it allocates an object each time. For
  performance-critical code, use null with explicit checks.
- Hibernate/JPA: lazy loading triggering N+1 queries. Use `@EntityGraph` or
  `JOIN FETCH`.
- `LinkedList` used as a general-purpose list — `ArrayList` is almost always faster
  due to cache locality.
