# mutmut — Python Mutation Testing

mutmut prioritizes ease of use. Version 3+ uses **libcst** (Meta's Concrete Syntax Tree
library) for formatting-preserving mutations and a trampoline mechanism that rewrites
functions with wrappers for dynamic mutant activation. It only mutates functions that
are actually called during tests.

## Installation and Basic Usage

```bash
pip install mutmut

# Run on entire project
mutmut run

# Run on specific module
mutmut run "mypackage/parser*"

# List surviving mutants
mutmut results

# Show a specific mutant
mutmut show <mutant_id>

# Interactive browser (v3+)
mutmut browse
```

## Requirements

- Python 3.8+
- Linux or macOS (requires `fork()` — use WSL on Windows)
- pytest (default) or unittest

## Configuration

In `pyproject.toml`:

```toml
[tool.mutmut]
# Paths to mutate
paths_to_mutate = "src/"

# Test runner command (default: pytest)
runner = "python -m pytest -x --assert=plain"

# Files/patterns to exclude
do_not_mutate = [
    "*/migrations/*",
    "*/generated/*",
    "*/conftest.py",
    "setup.py",
]

# Only mutate lines with test coverage (faster)
mutate_only_covered_lines = true

# Maximum call stack depth for test relevance
max_stack_depth = 8

# Type checker for filtering type-invalid mutants
type_check_command = "mypy --no-error-summary"
# type_check_command = "pyrefly check"
```

Alternatively in `setup.cfg`:

```ini
[mutmut]
paths_to_mutate=src/
runner=python -m pytest -x --assert=plain
```

## Mutation Operators

mutmut applies these transformations:

**Arithmetic**: `+`↔`-`, `*`↔`/`, `//`↔`/`, `**`→`*`, `%`→`/`
**Comparison**: `>`↔`>=`, `<`↔`<=`, `==`↔`!=`, `is`↔`is not`,
  `in`↔`not in`
**Logical**: `and`↔`or`
**Boolean**: `True`↔`False`
**Integer mutations**: `n`→`n + 1` (e.g., `0`→`1`, `5`→`6`)
**String mutations**: `"foo"`→`"XXfooXX"`, `""`→`"mutmut"`
**Return values**: `return x`→`return None`
**Control flow**: `break`→`continue`
**Argument removal**: `foo(bar)`→`foo(None)`
**Fstring mutations**: Mutate f-string contents
**Keyword argument mutations**: Mutate default values

## Inline Exclusions

```python
x = complex_calculation()  # pragma: no mutate

# For entire functions, exclude via do_not_mutate config pattern
```

## Understanding v3 Output

mutmut v3 uses emoji-coded results:

- 🎉 **Killed** — test caught the mutation (good)
- ⏰ **Timeout** — mutation caused infinite loop (counts as killed)
- 🤔 **Suspicious** — test result was ambiguous
- 🙁 **Survived** — no test caught the mutation (action needed)
- 🔇 **Skipped** — excluded by configuration

The `mutmut browse` TUI lets you interactively explore results, view diffs for each
mutant, and re-run individual mutations.

## v3 Trampoline Mechanism

mutmut v3 works differently from v2. Instead of rewriting source files for each mutant,
it rewrites functions once with a "trampoline" wrapper that can dynamically switch between
the original and mutated implementations. This means:

- Only functions that are called during tests get mutated
- The mutation switching is faster than file rewriting
- Module-level code outside functions is NOT mutated in v3
- Class-level assignments outside methods are NOT mutated

If you need to test module-level constants, either wrap them in functions or use v2.

## Workflow for Addressing Survivors

```bash
# 1. Run mutation testing
mutmut run

# 2. See summary
mutmut results

# 3. Inspect specific survivors
mutmut show 42
# Shows the diff: what was changed and in which file

# 4. Write a test that catches the mutation
# (Remember: fix the TEST, not the code)

# 5. Re-run just that mutant to verify
mutmut run --rerun-surviving
```

## CI Integration

```yaml
# GitHub Actions
- name: Install mutmut
  run: pip install mutmut

- name: Run mutation testing
  run: mutmut run --CI

# Cache mutants directory for incremental runs
- uses: actions/cache@v4
  with:
    path: mutants/
    key: mutmut-${{ github.ref }}-${{ hashFiles('src/**/*.py') }}
    restore-keys: mutmut-${{ github.ref }}-
```

## Combining with pytest-cov

Run coverage first to speed up mutation testing:

```bash
# Generate coverage data
pytest --cov=mypackage --cov-report=xml

# Use covered-lines-only mode
# (set mutate_only_covered_lines = true in config)
mutmut run
```

This skips mutations on uncovered lines — you already know those need tests.

## Troubleshooting

- **"fork() not available"**: mutmut requires fork(); use Linux/macOS or WSL on Windows
- **Very slow**: Add `mutate_only_covered_lines = true`, restrict `paths_to_mutate`,
  use `-x` flag in pytest runner to fail fast
- **Module-level code not mutated (v3)**: This is by design in v3; wrap constants
  in functions or use v2 if needed
- **pytest assertion rewriting interference**: Use `--assert=plain` in runner config
  if you see unexpected behavior
- **Django projects**: Set `DJANGO_SETTINGS_MODULE` in the runner command:
  `runner = "DJANGO_SETTINGS_MODULE=myapp.settings python -m pytest -x"`
- **Async code**: mutmut handles async functions, but ensure your test runner
  supports async (e.g., pytest-asyncio)
