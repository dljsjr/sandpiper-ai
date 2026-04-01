# Swift — Code Review Reference

## Review Tooling

Run these on changed files before starting the qualitative review:

```bash
# Primary lint
swiftlint lint --reporter json <changed-files>

# Per-function CC
lizard --csv <changed-files>

# Dead code (requires successful build)
periphery scan --format json
```

## Common Bugs to Catch

**Optional handling:**
- Force-unwrap (`!`) outside of tests — every `!` is a potential runtime crash.
  Verify the value is guaranteed to be non-nil or flag it.
- Implicitly unwrapped optionals (`Type!`) on stored properties — acceptable for
  `@IBOutlet` in UIKit but a smell elsewhere. Prefer proper optionals or non-optional
  types with initialization.
- Optional chaining that silently returns nil when failure should be reported:
  `user?.settings?.theme` quietly returns nil if user doesn't exist — is that
  intentional or should it be an error?
- `guard let x = x else { return }` in functions where the caller needs to know
  about the failure — should it throw instead?

**Reference semantics surprises:**
- Class instances shared unintentionally — modifying a class property in one place
  affects all holders. Verify whether a struct (value semantics) would be more
  appropriate.
- Closures capturing `self` strongly in class methods — potential retain cycles.
  Verify `[weak self]` or `[unowned self]` is used where appropriate.
- `unowned` used where `weak` should be — `unowned` crashes if the referenced
  object is deallocated. Only use when the reference is guaranteed to outlive the
  holder.

**Concurrency (Swift Concurrency / async-await):**
- `@MainActor` missing on UI updates. All UI mutation must happen on the main actor.
- Data races in `nonisolated` methods that access actor state.
- `Task` created without cancellation handling — check `Task.isCancelled` or use
  `Task.checkCancellation()` in long-running work.
- Mixing GCD (`DispatchQueue`) and Swift Concurrency — avoid unless necessary, as
  the interaction is complex.

**SwiftUI-specific:**
- `@State` used in a non-View type (it only works correctly in View structs).
- `@ObservedObject` used where `@StateObject` should be — `@ObservedObject` doesn't
  own the lifecycle, so the object can be recreated unexpectedly.
- Expensive computation in View `body` — this runs on every render. Move to
  `onAppear`, `task`, or `onChange`.
- `@Published` property changed from background thread (must dispatch to main).

## Security Concerns

- **Keychain vs UserDefaults:** Sensitive data (tokens, passwords) stored in
  `UserDefaults` instead of Keychain. UserDefaults is readable in backups.
- **ATS exceptions:** `NSAllowsArbitraryLoads` in Info.plist disabling App Transport
  Security. Should have per-domain exceptions, not global bypass.
- **Logging secrets:** `print()` or `os_log` with sensitive data. Use `os_log` with
  `%{private}` for sensitive values.
- **URL scheme handling:** Deep link handlers that don't validate the source or
  sanitize parameters.

## Idiom Violations to Flag

- Using `if let` when `guard let` would reduce nesting.
- Manual nil checks (`if x != nil { x!.method() }`) instead of optional binding
  or optional chaining.
- `NSNotificationCenter` / `delegate` pattern where Combine or `async/await`
  would be more appropriate in modern Swift code.
- Force-casting (`as!`) when `as?` with handling would be safer.
- Using `AnyObject` or `Any` to avoid proper typing.
- Mutable `var` where `let` would work.
- Empty `else` blocks or empty `catch` blocks.
- Long `switch` cases without extraction — each case body should be a few lines
  at most, calling out to a focused function.

## Performance Traps

- Creating `DateFormatter` inside a function called frequently — it's expensive
  to initialize. Cache at a higher scope.
- `Array.contains` on large unsorted arrays — use `Set` for frequent lookups.
- `String` interpolation in hot paths — `String(format:)` can be more efficient
  for numeric formatting.
- Excessive use of `AnyView` in SwiftUI — erases type information and prevents
  diffing optimizations. Use `@ViewBuilder` or `some View` instead.
- Capturing `self` in escaping closures when only a property is needed — capture
  the property directly to avoid retaining the entire object.
