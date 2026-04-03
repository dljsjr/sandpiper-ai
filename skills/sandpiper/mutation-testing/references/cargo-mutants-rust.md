# cargo-mutants — Rust Mutation Testing

cargo-mutants performs **source-level mutations** by parsing Rust source files with the
`syn` crate, modifying them, and running `cargo build` + `cargo test` for each mutant.
It requires zero configuration to get started.

## Installation and Basic Usage

```bash
cargo install cargo-mutants

# Run on current project (all functions)
cargo mutants

# Dry run — list mutants without testing them
cargo mutants --list

# Run on specific files
cargo mutants -f src/parser.rs -f src/lexer.rs

# Run on functions matching a regex
cargo mutants -F 'parse_.*'
```

## How It Generates Mutants

cargo-mutants' primary strategy is **function body replacement**: for each function, it
generates plausible return values based on the return type. It also applies binary operator
replacements and other transformations.

### Return Value Mutations by Type

| Return type | Replacement values |
|---|---|
| `bool` | `true`, `false` |
| `i8`..`i128`, `isize` | `0`, `1`, `-1` |
| `u8`..`u128`, `usize` | `0`, `1` |
| `f32`, `f64` | `0.0`, `1.0`, `-1.0` |
| `String` | `String::new()`, `"xyzzy".into()` |
| `&str` | `""`, `"xyzzy"` |
| `Vec<T>` | `vec![]`, `vec![Default::default()]` |
| `Option<T>` | `None`, `Some(...)` (with recursive inner values) |
| `Result<T, E>` | `Ok(...)` (with recursive inner values) |
| `()` | `()` (function body deleted entirely) |
| `Box<T>` | `Box::new(...)` |
| `Rc<T>`, `Arc<T>` | `Rc::new(...)`, `Arc::new(...)` |
| `HashMap`, `BTreeMap` | empty maps |

**Recursive nesting** is the key insight: `Result<Option<String>>` generates values like
`Ok(Some(String::new()))`, `Ok(Some("xyzzy".into()))`, `Ok(None)`, etc.

### Binary Operator Mutations

- Arithmetic: `+`↔`-`, `*`↔`/`, `%`↔`+`
- Comparison: `==`↔`!=`, `<`↔`>`, `<=`↔`>=`
- Logical: `&&`↔`||`
- Bitwise: `&`↔`|`, `^`↔`&`, `<<`↔`>>`
- Unary: remove `!`, remove `-`

Also: pattern/match arm deletion, struct literal field deletion.

## Configuration

### CLI Options

**WARNING: Never use `--in-place`.** This flag mutates your actual source files instead
of working on a temporary copy. It can leave mutations in committed code and corrupt
your working tree. Always let cargo-mutants use its default temporary directory.

```bash
# Parallel jobs (start conservative — 2-3)
cargo mutants -j 3

# Use nextest for faster test execution
cargo mutants --test-tool nextest

# Only test mutants in code changed since main
git diff main | cargo mutants --in-diff -

# Sharding for CI distribution (shard 1 of 4)
cargo mutants --shard 1/4

# Skip baseline test run (useful when sharding, baseline done separately)
cargo mutants --baseline=skip

# Timeout multiplier (default 5.0)
cargo mutants --timeout-multiplier 3.0

# Specific timeout cap
cargo mutants --timeout 120

# Regex exclusion
cargo mutants --exclude-re 'impl.*Display'
```

### Config File: `.cargo/mutants.toml`

```toml
# Exclude functions matching these patterns
exclude_re = [
    "impl .* Display",
    "impl .* Debug",
    "impl .* Default",
    "fn main",
    "fn log_.*",
]

# Additional cargo arguments
additional_cargo_args = ["--release"]

# Additional test arguments
additional_cargo_test_args = ["--", "--test-threads=1"]

# Timeout settings
timeout_multiplier = 3.0

# Custom test tool
test_tool = "nextest"

# Features
features = ["test-utils"]
```

### Skip Attribute

Mark individual functions to skip:

```rust
#[mutants::skip]  // skip this function entirely
fn trivial_getter(&self) -> &str {
    &self.name
}

#[cfg_attr(test, mutants::skip)]  // skip only during mutation testing
fn logging_helper(msg: &str) {
    eprintln!("{}", msg);
}
```

The `mutants` crate must be a **regular dependency** (not dev-dependency): `cargo add mutants`

It needs to be a regular dependency because `#[mutants::skip]` must compile during
`cargo build`, not just `cargo test`. The crate is tiny (just a no-op proc macro that
compiles away to nothing) so there is no runtime cost.

## Output Interpretation

cargo-mutants categorizes results into four outcomes:

- **caught** (test failed when mutant was applied) → good
- **missed** (all tests passed with mutant applied) → test gap, action needed
- **unviable** (mutant doesn't compile) → usually fine, skip
- **timeout** (test exceeded time limit) → counts as caught

**Exit codes**:
- `0`: All viable mutants caught
- `2`: Some mutants were missed
- `1` / `3` / `4`: Build or infrastructure errors

Output directory `mutants.out/` contains:
- `caught.txt`, `missed.txt`, `unviable.txt`, `timeout.txt`
- `outcomes.json` — machine-readable full results
- Per-mutant log files with build/test output

## Performance Optimization

Rust builds are slow, so per-mutant overhead matters. Key strategies:

```toml
# In Cargo.toml — add a fast-build profile for mutation testing
[profile.mutants]
inherits = "dev"
debug = "none"       # skip debug symbols
opt-level = 0
incremental = true
```

```bash
# Use the fast profile
cargo mutants -- --profile mutants

# Use a fast linker (mold or wild)
RUSTFLAGS="-C link-arg=-fuse-ld=mold" cargo mutants

# Place build directory on ramdisk
TMPDIR=/dev/shm cargo mutants

# Skip doctests (often slow, rarely catch mutants)
cargo mutants -- --all-targets

# Use nextest (parallel test execution)
cargo mutants --test-tool nextest

# Parallel mutation jobs
cargo mutants -j 4
```

## CI Integration

### GitHub Actions — Sharded

```yaml
jobs:
  mutants:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo install cargo-mutants
      - name: Run mutation shard
        run: cargo mutants --shard ${{ matrix.shard }}/4 --baseline=skip -j 2
```

### PR-only (diff-based)

```yaml
      - name: Mutation test changed code
        run: |
          git diff origin/main... > diff.patch
          cargo mutants --in-diff diff.patch -j 2
```

## Rust-Specific Design Insights

cargo-mutants is particularly good at revealing type system issues in Rust:

- **`Option<T>` vs `Result<Option<T>>`**: If replacing a function body with `None`
  goes undetected, consider whether the function conflates "error" with "not found."
  Refactoring to `Result<Option<T>>` makes both cases independently testable.

- **Builder pattern gaps**: If replacing a builder method body with `self` (no-op)
  survives, your tests aren't verifying the builder actually sets the value.

- **Trait implementation coverage**: `Display`, `Debug`, `Default`, `From` impls
  often survive mutation. Exclude trivial ones; test non-trivial ones explicitly.

- **Error handling**: If replacing error construction with a different error variant
  survives, tests aren't distinguishing between error cases.
