# Swift Refactoring Reference

## Recommended Tool Stack

| Tool | Purpose | Speed |
|------|---------|-------|
| **SwiftLint** | Linting, complexity, style | Fast |
| **lizard** | Per-function CC (cross-language) | Fast |
| **Periphery** | Unused code detection | Moderate (needs build) |
| **jscpd** | Clone detection | Fast |

SwiftLint is the primary tool — it includes cyclomatic complexity, function body
length, file length, nesting, and type body length rules with configurable thresholds.

## Tool Commands

### SwiftLint — Primary linter

```bash
# Run with JSON output
swiftlint lint --reporter json <path>

# Run on specific files
swiftlint lint --reporter json --path Sources/Parser.swift

# Auto-correct fixable violations
swiftlint lint --fix <path>

# Analyze (deeper checks, requires compile log)
swiftlint analyze --reporter json --compiler-log-path build.log
```

Configure in `.swiftlint.yml`:
```yaml
opt_in_rules:
  - closure_body_length
  - collection_alignment
  - discouraged_optional_boolean
  - empty_count
  - fatal_error_message
  - function_default_parameter_at_end
  - prefer_self_in_static_references
  - unavailable_function

cyclomatic_complexity:
  warning: 10
  error: 15
  ignores_case_statements: true

function_body_length:
  warning: 40
  error: 60

file_length:
  warning: 400
  error: 500

type_body_length:
  warning: 200
  error: 300

nesting:
  type_level: 2
  function_level: 3

function_parameter_count:
  warning: 4
  error: 6
```

### Periphery — Dead code detection

```bash
# Find unused code (requires built Xcode project or SPM package)
periphery scan --format json

# For SPM packages
periphery scan --format json --project-type spm

# Exclude test targets
periphery scan --format json --exclude-targets MyAppTests
```

Periphery finds: unused classes, structs, protocols, functions, properties,
enum cases, and typealiases. It requires a successful build to perform its analysis.

## Language-Specific Refactoring Patterns

### Replace complex optionals with guard-let chains

```swift
// Before: nested optional binding (pyramid of doom)
func processUser(_ data: Data?) -> String {
    if let data = data {
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let name = json["name"] as? String {
                if let age = json["age"] as? Int, age >= 18 {
                    return "\(name), age \(age)"
                }
            }
        }
    }
    return "Unknown"
}

// After: flat guard-let
func processUser(_ data: Data?) -> String {
    guard let data = data,
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let name = json["name"] as? String,
          let age = json["age"] as? Int,
          age >= 18 else {
        return "Unknown"
    }
    return "\(name), age \(age)"
}
```

### Replace delegate protocols with closures (for simple callbacks)

```swift
// Before: protocol + delegate (boilerplate-heavy for simple cases)
protocol DataLoaderDelegate: AnyObject {
    func didLoad(_ data: Data)
    func didFail(_ error: Error)
}

class DataLoader {
    weak var delegate: DataLoaderDelegate?
    // ...
}

// After: closure-based (simpler for single-use callbacks)
class DataLoader {
    func load(completion: @escaping (Result<Data, Error>) -> Void) {
        // ...
    }
}
```

### Use Result builders for complex configuration

```swift
// Before: imperative configuration
func buildMenu() -> Menu {
    var items: [MenuItem] = []
    items.append(MenuItem(title: "Home", icon: .house))
    if user.isAdmin {
        items.append(MenuItem(title: "Admin", icon: .gear))
    }
    items.append(MenuItem(title: "Settings", icon: .wrench))
    return Menu(items: items)
}

// After: result builder (declarative)
@MenuBuilder
func buildMenu() -> Menu {
    MenuItem(title: "Home", icon: .house)
    if user.isAdmin {
        MenuItem(title: "Admin", icon: .gear)
    }
    MenuItem(title: "Settings", icon: .wrench)
}
```

### Replace stringly-typed APIs with enums

```swift
// Before
func setTheme(_ name: String) {
    switch name {
    case "light": applyLight()
    case "dark": applyDark()
    case "auto": applyAuto()
    default: break // silent failure
    }
}

// After
enum Theme: String {
    case light, dark, auto
}

func setTheme(_ theme: Theme) {
    switch theme {
    case .light: applyLight()
    case .dark: applyDark()
    case .auto: applyAuto()
    }  // exhaustive, no default needed
}
```

## Swift-Specific Anti-Patterns

- **Don't force-unwrap optionals (`!`) outside of tests and known-safe contexts.**
  Use `guard let`, `if let`, or nil-coalescing (`??`) instead.
- **Don't create massive view controllers / views.** Extract child views, view models,
  and coordinators. A 500-line SwiftUI view or UIViewController is a design failure.
- **Don't abuse protocol extensions for code sharing.** Protocol extensions that add
  default behavior are powerful but obscure the call graph. Prefer explicit composition.
- **Don't create protocols with only one conformer.** It's premature abstraction.
  Extract a protocol when you genuinely need polymorphism.
- **Don't use `Any` or `AnyObject` to avoid type specificity.** It hides bugs that
  the type system would otherwise catch.
