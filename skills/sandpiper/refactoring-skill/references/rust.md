# Rust Refactoring Reference

## Recommended Tool Stack

| Tool | Purpose | Speed |
|------|---------|-------|
| **clippy** | Linting (complexity, style, correctness, perf) | Fast (part of toolchain) |
| **lizard** | Per-function CC (cross-language) | Fast |
| **cargo-bloat** | Binary/function size analysis | Moderate |
| **cargo-udeps** | Unused dependency detection | Moderate |
| **jscpd** | Clone detection | Fast |

clippy is the primary tool. It includes cognitive complexity warnings
(`cognitive_complexity`), function length hints, and hundreds of correctness/style
lints. lizard supplements with cross-language CC comparisons.

## Tool Commands

### clippy — Primary linter

```bash
# Run with all lint groups, JSON output
cargo clippy --message-format=json 2>&1 | jq 'select(.reason == "compiler-message")'

# Run with specific complexity-related lints
cargo clippy -- \
  -W clippy::cognitive_complexity \
  -W clippy::too_many_lines \
  -W clippy::too_many_arguments \
  -W clippy::fn_params_excessive_bools

# Set cognitive complexity threshold (default 25, recommended: 15)
cargo clippy -- -W clippy::cognitive_complexity

# Run pedantic lints (stricter)
cargo clippy -- -W clippy::pedantic
```

Key clippy lints for refactoring:
- `clippy::cognitive_complexity`: Warns on high cognitive complexity (configurable threshold)
- `clippy::too_many_lines`: Function body too long
- `clippy::too_many_arguments`: Too many function parameters (default: 7)
- `clippy::fn_params_excessive_bools`: Too many bool parameters
- `clippy::large_enum_variant`: Enum variant much larger than others
- `clippy::type_complexity`: Type is too complex
- `clippy::needless_pass_by_value`: Argument taken by value but only used by reference

Configure in `clippy.toml`:
```toml
cognitive-complexity-threshold = 15
too-many-arguments-threshold = 5
too-many-lines-threshold = 60
```

### cargo-bloat — Size analysis

```bash
# Show largest functions
cargo bloat --release -n 20

# Show largest crates
cargo bloat --release --crates
```

Useful for identifying over-monomorphized generics or functions that have exploded
in size due to excessive inlining.

### cargo-udeps — Unused dependencies

```bash
# Find unused dependencies (requires nightly)
cargo +nightly udeps
```

## Language-Specific Refactoring Patterns

### Replace nested match with early returns

```rust
// Before
fn process(input: Option<Result<Data, Error>>) -> Output {
    match input {
        Some(result) => match result {
            Ok(data) => {
                if data.is_valid() {
                    // actual logic
                    transform(data)
                } else {
                    Output::Invalid
                }
            }
            Err(e) => Output::Error(e),
        },
        None => Output::Empty,
    }
}

// After
fn process(input: Option<Result<Data, Error>>) -> Output {
    let result = match input {
        Some(r) => r,
        None => return Output::Empty,
    };
    let data = match result {
        Ok(d) => d,
        Err(e) => return Output::Error(e),
    };
    if !data.is_valid() {
        return Output::Invalid;
    }
    transform(data)
}

// Or with let-else (Rust 1.65+)
fn process(input: Option<Result<Data, Error>>) -> Output {
    let Some(result) = input else { return Output::Empty };
    let Ok(data) = result else { return Output::Error(result.unwrap_err()) };
    if !data.is_valid() { return Output::Invalid; }
    transform(data)
}
```

### Replace complex trait hierarchies with composition

```rust
// Before: deep trait hierarchy
trait Animal: Living + Moving + Eating { /* ... */ }
trait Pet: Animal + Named + Trainable { /* ... */ }
trait ServiceAnimal: Pet + Certified + TaskTrained { /* ... */ }

// After: compose behaviors
struct Dog {
    name: String,
    movement: MovementConfig,
    training: TrainingRecord,
}

impl Dog {
    fn perform_task(&self, task: &Task) -> Result<(), TaskError> {
        // direct implementation
    }
}
```

### Use iterators instead of manual loops

```rust
// Before: manual accumulation
let mut total = 0;
let mut count = 0;
for item in &items {
    if item.is_active() {
        total += item.value();
        count += 1;
    }
}
let average = if count > 0 { total / count } else { 0 };

// After: iterator chain
let (total, count) = items.iter()
    .filter(|item| item.is_active())
    .fold((0, 0), |(sum, n), item| (sum + item.value(), n + 1));
let average = if count > 0 { total / count } else { 0 };
```

### Extract error types to simplify Result handling

```rust
// Before: scattered error conversion
fn load_config(path: &Path) -> Result<Config, Box<dyn std::error::Error>> {
    let contents = std::fs::read_to_string(path)?;
    let parsed: RawConfig = serde_json::from_str(&contents)?;
    let validated = validate(parsed).map_err(|e| Box::new(e))?;
    Ok(Config::from(validated))
}

// After: dedicated error enum with thiserror
#[derive(Debug, thiserror::Error)]
enum ConfigError {
    #[error("failed to read config file: {0}")]
    Io(#[from] std::io::Error),
    #[error("invalid config format: {0}")]
    Parse(#[from] serde_json::Error),
    #[error("config validation failed: {0}")]
    Validation(#[from] ValidationError),
}

fn load_config(path: &Path) -> Result<Config, ConfigError> {
    let contents = std::fs::read_to_string(path)?;
    let parsed: RawConfig = serde_json::from_str(&contents)?;
    let validated = validate(parsed)?;
    Ok(Config::from(validated))
}
```

## Rust-Specific Anti-Patterns

- **Don't over-use generics.** Every generic parameter multiplies monomorphized code.
  If a function is only ever called with one concrete type, don't make it generic.
- **Don't create deeply nested module hierarchies.** `crate::foo::bar::baz::qux` is
  hard to navigate. Prefer flat or 2-level module structures.
- **Don't use `Arc<Mutex<T>>` everywhere.** If you find yourself wrapping everything
  in shared mutable state, reconsider the architecture — channel-based communication
  or task-local state is often simpler.
- **Don't implement traits you don't need.** Derive what's useful; skip the rest.
  Not every struct needs `Clone`, `Debug`, and `Default`.
- **Don't create builder patterns for structs with < 5 fields.** A constructor function
  is simpler. Use builders when construction has complex validation or many optional fields.
