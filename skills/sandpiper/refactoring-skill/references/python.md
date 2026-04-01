# Python Refactoring Reference

## Recommended Tool Stack

| Tool | Purpose | Speed |
|------|---------|-------|
| **Ruff** | Linting, formatting, import sorting, complexity checks | Very fast (Rust-based) |
| **radon** | CC, Halstead, Maintainability Index (detailed) | Fast |
| **lizard** | Per-function CC (cross-language) | Fast |
| **jscpd** | Clone detection | Fast |
| **vulture** | Dead code detection | Fast |

Ruff is the primary tool — it replaces flake8, isort, pyflakes, and most of pylint
in a single Rust binary. It includes McCabe complexity checking (`C901`) and function
length rules. radon provides deeper metrics (Halstead, MI) and letter-grade CC when
you need more detail than Ruff provides.

## Tool Commands

### Ruff — Primary linter, formatter, and complexity checker

```bash
# Lint with JSON output
ruff check --output-format json <path>

# Enable complexity rules specifically (C901 = McCabe, PLR0911-0917 = function metrics)
ruff check --select C901,PLR0911,PLR0912,PLR0913,PLR0915 --output-format json <path>

# Lint and auto-fix safe fixes
ruff check --fix <path>

# Format check
ruff format --check <path>

# Show all available rules
ruff rule C901
```

Key Ruff rules for refactoring:
- `C901`: McCabe cyclomatic complexity (default threshold: 10)
- `PLR0911`: Too many return statements
- `PLR0912`: Too many branches
- `PLR0913`: Too many arguments (default: 5)
- `PLR0915`: Too many statements
- `PLR0904`: Too many public methods
- `PLR6301`: Method could be a function (no `self` usage)

### radon — Detailed complexity metrics

```bash
# Cyclomatic complexity per function with letter grades (A–F)
radon cc --json <path>

# Show only functions graded C or worse (CC ≥ 11)
radon cc --min C <path>

# Halstead metrics
radon hal --json <path>

# Maintainability Index (0–100, higher = better)
radon mi --json <path>

# Raw metrics (LOC, LLOC, SLOC, comments, blanks)
radon raw --json <path>
```

radon's CC grades: A (1–5), B (6–10), C (11–15), D (16–20), E (21–25), F (26+).
For refactoring triage, focus on D and worse.

### vulture — Dead code detection

```bash
# Find unused code
vulture <path>

# With confidence threshold (higher = fewer false positives)
vulture --min-confidence 80 <path>

# Generate allowlist for intentional unused code
vulture <path> --make-whitelist > whitelist.py
```

vulture finds: unused functions, unused classes, unused variables, unused imports,
and unreachable code. It has false positives with dynamic dispatch and framework
magic — use the confidence threshold and allowlist to manage them.

## Language-Specific Refactoring Patterns

### Replace nested conditionals with structural pattern matching (3.10+)

```python
# Before (CC: 5+)
def handle_response(response):
    if response.status == 200:
        if response.content_type == 'json':
            return parse_json(response.body)
        elif response.content_type == 'xml':
            return parse_xml(response.body)
        else:
            return response.body
    elif response.status == 404:
        raise NotFoundError(response.url)
    elif response.status >= 500:
        raise ServerError(response.status)

# After (flat, readable)
def handle_response(response):
    match (response.status, response.content_type):
        case (200, 'json'): return parse_json(response.body)
        case (200, 'xml'): return parse_xml(response.body)
        case (200, _): return response.body
        case (404, _): raise NotFoundError(response.url)
        case (s, _) if s >= 500: raise ServerError(s)
```

### Replace class with dataclass or NamedTuple

```python
# Before: boilerplate-heavy class
class Point:
    def __init__(self, x: float, y: float, z: float = 0.0):
        self.x = x
        self.y = y
        self.z = z

    def __eq__(self, other):
        return self.x == other.x and self.y == other.y and self.z == other.z

    def __repr__(self):
        return f"Point({self.x}, {self.y}, {self.z})"

# After: dataclass
@dataclass
class Point:
    x: float
    y: float
    z: float = 0.0
```

### Replace loops with comprehensions / generators (when simpler)

```python
# Before
results = []
for item in items:
    if item.is_valid():
        results.append(item.transform())

# After (if the logic is simple enough)
results = [item.transform() for item in items if item.is_valid()]

# But DON'T do this when the comprehension becomes complex:
# BAD — harder to read than the loop
results = [
    transform(item, config)
    for group in groups
    for item in group.items
    if item.is_valid() and item.category in allowed_categories
]
```

### Extract context managers for resource cleanup

```python
# Before: repeated try/finally
def process_file(path):
    f = open(path)
    try:
        lock = acquire_lock(path)
        try:
            data = f.read()
            # process data
        finally:
            release_lock(lock)
    finally:
        f.close()

# After: context manager
@contextmanager
def locked_file(path):
    with open(path) as f:
        lock = acquire_lock(path)
        try:
            yield f
        finally:
            release_lock(lock)

def process_file(path):
    with locked_file(path) as f:
        data = f.read()
        # process data
```

### Replace mutable default arguments

```python
# Before (classic Python bug)
def add_item(item, items=[]):
    items.append(item)
    return items

# After
def add_item(item, items=None):
    if items is None:
        items = []
    items.append(item)
    return items
```

## Python-Specific Anti-Patterns

- **Don't create single-method classes.** Use a plain function. A class with only
  `__init__` and one method is a function in disguise.
- **Don't use inheritance for code reuse.** Prefer composition or mixins for shared
  behavior. Deep inheritance chains (> 2 levels) are a smell.
- **Don't put logic in `__init__`.** Constructors should set state. Logic goes in
  methods or factory functions.
- **Don't use `**kwargs` to avoid defining parameters.** It hides the function's
  interface and makes it impossible to type-check.
- **Don't create God modules.** A 1000-line `utils.py` is a design failure. Split
  by domain: `string_utils.py`, `date_utils.py`, or better yet, name by what they
  do, not that they're "utils."
