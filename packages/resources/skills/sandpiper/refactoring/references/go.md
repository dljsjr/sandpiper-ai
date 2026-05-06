# Go Refactoring Reference

## Recommended Tool Stack

| Tool | Purpose | Speed |
|------|---------|-------|
| **golangci-lint** | Meta-linter (runs 100+ linters) | Fast |
| **lizard** | Per-function CC (cross-language) | Fast |
| **jscpd** | Clone detection | Fast |
| **deadcode** | Unused code detection | Fast |

golangci-lint is the single entry point — it bundles gocyclo, gocognit, funlen,
nestif, dupl, and dozens of other analyzers. No need to run individual linters.

## Tool Commands

### golangci-lint — Primary meta-linter

```bash
# Run with JSON output
golangci-lint run --out-format json ./...

# Enable specific complexity linters
golangci-lint run --enable gocyclo,gocognit,funlen,nestif,dupl,goconst --out-format json ./...

# Run on specific packages
golangci-lint run --out-format json ./pkg/parser/...

# Show which linters are enabled
golangci-lint linters
```

Key linters for refactoring (enable in `.golangci.yml`):
```yaml
linters:
  enable:
    - gocyclo          # Cyclomatic complexity
    - gocognit         # Cognitive complexity
    - funlen           # Function length
    - nestif           # Nesting depth
    - dupl             # Code duplication
    - goconst          # Repeated strings/numbers → constants
    - unparam          # Unused function parameters
    - deadcode         # Unused code
    - unconvert        # Unnecessary type conversions

linters-settings:
  gocyclo:
    min-complexity: 15
  gocognit:
    min-complexity: 15
  funlen:
    lines: 60
    statements: 40
  nestif:
    min-complexity: 4
  dupl:
    threshold: 100
```

### deadcode — Unused code detection

```bash
# Find unreachable functions
deadcode ./...
```

Part of the `golang.org/x/tools` suite. Identifies functions and methods that are
never called from any entry point.

## Language-Specific Refactoring Patterns

### Flatten error handling with early returns

Go's `if err != nil` pattern naturally supports guard clauses:

```go
// Before: nested error handling
func processFile(path string) (*Result, error) {
    file, err := os.Open(path)
    if err == nil {
        defer file.Close()
        data, err := io.ReadAll(file)
        if err == nil {
            result, err := parse(data)
            if err == nil {
                return result, nil
            } else {
                return nil, fmt.Errorf("parse: %w", err)
            }
        } else {
            return nil, fmt.Errorf("read: %w", err)
        }
    } else {
        return nil, fmt.Errorf("open: %w", err)
    }
}

// After: flat guard clauses (idiomatic Go)
func processFile(path string) (*Result, error) {
    file, err := os.Open(path)
    if err != nil {
        return nil, fmt.Errorf("open: %w", err)
    }
    defer file.Close()

    data, err := io.ReadAll(file)
    if err != nil {
        return nil, fmt.Errorf("read: %w", err)
    }

    result, err := parse(data)
    if err != nil {
        return nil, fmt.Errorf("parse: %w", err)
    }
    return result, nil
}
```

### Replace large switch statements with maps

```go
// Before
func statusText(code int) string {
    switch code {
    case 200: return "OK"
    case 201: return "Created"
    case 400: return "Bad Request"
    case 404: return "Not Found"
    case 500: return "Internal Server Error"
    default:  return "Unknown"
    }
}

// After
var statusTexts = map[int]string{
    200: "OK",
    201: "Created",
    400: "Bad Request",
    404: "Not Found",
    500: "Internal Server Error",
}

func statusText(code int) string {
    if text, ok := statusTexts[code]; ok {
        return text
    }
    return "Unknown"
}
```

### Extract interface at point of use

```go
// Before: depending on a large concrete type
func SendReport(client *http.Client, url string, data []byte) error {
    resp, err := client.Post(url, "application/json", bytes.NewReader(data))
    // ...
}

// After: depend on minimal interface (defined at call site, not provider)
type Poster interface {
    Post(url, contentType string, body io.Reader) (*http.Response, error)
}

func SendReport(client Poster, url string, data []byte) error {
    resp, err := client.Post(url, "application/json", bytes.NewReader(data))
    // ...
}
```

### Replace init() with explicit initialization

```go
// Before: hidden init
var db *sql.DB

func init() {
    var err error
    db, err = sql.Open("postgres", os.Getenv("DATABASE_URL"))
    if err != nil {
        log.Fatal(err)
    }
}

// After: explicit, testable
func NewDB(dsn string) (*sql.DB, error) {
    return sql.Open("postgres", dsn)
}

func main() {
    db, err := NewDB(os.Getenv("DATABASE_URL"))
    if err != nil {
        log.Fatal(err)
    }
    // pass db explicitly to handlers
}
```

## Go-Specific Anti-Patterns

- **Don't create interfaces before you need them.** Go interfaces are satisfied
  implicitly — define them at the consumer, not the provider, and only when you
  have 2+ implementations or need testability.
- **Don't create packages named `util`, `common`, or `misc`.** Name packages by
  what they provide: `auth`, `storage`, `httputil`.
- **Don't use `context.Value` for passing dependencies.** It hides the dependency
  graph. Pass dependencies explicitly via function parameters or struct fields.
- **Don't create God structs.** A struct with 15 fields and 20 methods is doing too
  much. Split by responsibility.
- **Don't suppress errors with `_ =`.** Handle them or document why they're safe to ignore.
- **Don't use global variables.** They make testing hard and hide dependencies.
  Pass state explicitly.
