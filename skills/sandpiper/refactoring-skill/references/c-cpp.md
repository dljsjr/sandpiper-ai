# C / C++ Refactoring Reference

## Recommended Tool Stack

| Tool | Purpose | Speed |
|------|---------|-------|
| **clang-tidy** | Linting, modernization, complexity checks | Moderate (needs compile_commands.json) |
| **cppcheck** | Bug finding, style, unused code | Fast (no compilation needed) |
| **lizard** | Per-function CC (cross-language) | Fast |
| **jscpd** | Clone detection | Fast |
| **include-what-you-use** | Unused/missing header detection | Moderate |

clang-tidy is the primary tool for complexity and modernization. cppcheck supplements
with bug-finding that doesn't require a compilation database. lizard is the fastest
path to per-function CC when you don't have compile_commands.json set up.

## Tool Commands

### clang-tidy — Primary linter and modernizer

clang-tidy requires a `compile_commands.json` file. Generate it with CMake
(`-DCMAKE_EXPORT_COMPILE_COMMANDS=ON`) or Bear (`bear -- make`).

```bash
# Run with specific checks
clang-tidy -checks='-*,readability-function-cognitive-complexity,readability-function-size,misc-no-recursion,readability-simplify-boolean-expr' <file.cpp>

# Run on all files in compile_commands.json
run-clang-tidy -checks='-*,readability-*,modernize-*'

# Export fixes as YAML
clang-tidy -checks='modernize-*' -export-fixes=fixes.yaml <file.cpp>

# Apply fixes automatically
clang-tidy -checks='modernize-*' -fix <file.cpp>
```

Key checks for refactoring:
- `readability-function-cognitive-complexity`: Cognitive complexity threshold (default 25, set to 15)
- `readability-function-size`: Lines, statements, branches, parameters, nesting
- `readability-simplify-boolean-expr`: Simplifiable boolean expressions
- `readability-isolate-declaration`: Multiple declarations on one line
- `modernize-use-auto`: Replace verbose type declarations with auto
- `modernize-use-nullptr`: Replace NULL/0 with nullptr
- `modernize-use-override`: Add override keyword
- `modernize-loop-convert`: Convert C-style loops to range-for
- `misc-unused-parameters`: Unused function parameters

Configure in `.clang-tidy`:
```yaml
Checks: >
  readability-function-cognitive-complexity,
  readability-function-size,
  modernize-*,
  misc-unused-parameters
CheckOptions:
  - key: readability-function-cognitive-complexity.Threshold
    value: 15
  - key: readability-function-size.LineThreshold
    value: 60
  - key: readability-function-size.StatementThreshold
    value: 40
  - key: readability-function-size.ParameterThreshold
    value: 5
  - key: readability-function-size.NestingThreshold
    value: 4
```

### cppcheck — Bug finder and style checker

```bash
# Run with all checks, XML output
cppcheck --enable=all --xml <path> 2>&1

# Suppress specific false positives
cppcheck --enable=all --suppress=missingInclude --xml <path> 2>&1

# Check specific files
cppcheck --enable=style,performance,unusedFunction <file.cpp>

# Find unused functions across the project
cppcheck --enable=unusedFunction <path>
```

cppcheck does not measure CC but catches: unused functions, unused variables,
redundant conditions, memory leaks, null pointer dereferences, and style issues.

### include-what-you-use — Header cleanup

```bash
# Run on a single file
include-what-you-use -p compile_commands.json <file.cpp>

# Apply suggested changes
include-what-you-use -p compile_commands.json <file.cpp> 2>&1 | fix_includes.py
```

## Language-Specific Refactoring Patterns

### Replace preprocessor conditionals with constexpr if (C++17)

```cpp
// Before: preprocessor spaghetti
#ifdef USE_SSL
    auto conn = make_ssl_connection(host, port);
#else
    auto conn = make_plain_connection(host, port);
#endif

// After: constexpr if
template<bool UseSSL>
auto make_connection(const std::string& host, int port) {
    if constexpr (UseSSL) {
        return make_ssl_connection(host, port);
    } else {
        return make_plain_connection(host, port);
    }
}
```

### Replace raw pointer ownership with smart pointers

```cpp
// Before: manual memory management
class ResourceManager {
    Resource* resource_;
public:
    ResourceManager() : resource_(new Resource()) {}
    ~ResourceManager() { delete resource_; }
    // Missing copy/move constructors = bug
};

// After
class ResourceManager {
    std::unique_ptr<Resource> resource_;
public:
    ResourceManager() : resource_(std::make_unique<Resource>()) {}
    // Copy/move handled correctly by default
};
```

### Replace output parameters with structured returns (C++17)

```cpp
// Before
bool parse(const std::string& input, int& value, std::string& error) {
    // ...
}

// After
struct ParseResult {
    std::optional<int> value;
    std::string error;
};

ParseResult parse(const std::string& input) {
    // ...
}

// Or with std::expected (C++23)
std::expected<int, std::string> parse(const std::string& input);
```

### Extract RAII wrappers for C-style resource management

```cpp
// Before: repeated acquire/release
void process() {
    FILE* f = fopen("data.txt", "r");
    if (!f) return;
    mutex_lock(&mtx);
    // ... work ...
    mutex_unlock(&mtx);
    fclose(f);  // easy to miss on error paths
}

// After: RAII
void process() {
    auto f = std::unique_ptr<FILE, decltype(&fclose)>(
        fopen("data.txt", "r"), &fclose);
    if (!f) return;
    std::lock_guard lock(mtx);
    // ... work ...
}   // automatic cleanup
```

## C/C++-Specific Anti-Patterns

- **Don't use `#define` for constants.** Use `constexpr` variables or `enum class`.
- **Don't write C-style casts in C++ code.** Use `static_cast`, `dynamic_cast`, etc.
- **Don't create deep inheritance hierarchies.** Prefer composition. If your class
  hierarchy is more than 3 levels deep, reconsider the design.
- **Don't use `using namespace std;` in headers.** It pollutes every includer's namespace.
- **Don't hand-roll containers or algorithms.** Use the STL unless you have a measured
  performance reason not to.
- **Don't ignore compiler warnings.** Compile with `-Wall -Wextra -Wpedantic` and
  fix all warnings. They often indicate real bugs.
