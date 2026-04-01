# TypeScript / JavaScript Refactoring Reference

## Recommended Tool Stack

| Tool | Purpose | Speed |
|------|---------|-------|
| **Biome** | Linting, formatting, import sorting | Very fast (Rust-based) |
| **ESLint** (complexity rules only) | Cyclomatic complexity, max-depth, max-lines-per-function | Moderate |
| **lizard** | Per-function CC (cross-language) | Fast |
| **jscpd** | Clone detection | Fast |
| **knip** | Dead code / unused exports detection | Fast |

Biome is the primary linter for style and correctness. ESLint is used specifically for
its complexity measurement rules, which Biome does not replicate. If you want to avoid
running both, lizard provides per-function CC and can replace ESLint's complexity role.

## Tool Commands

### Biome — Primary linter and formatter

```bash
# Lint with diagnostics (JSON output)
biome lint --reporter json <path>

# Lint and format check together
biome check --reporter json <path>

# Auto-fix safe fixes
biome check --fix <path>

# Lint specific files
biome lint --reporter json src/utils.ts src/parser.ts
```

Biome covers: correctness rules, suspicious patterns, style enforcement, import
sorting, and nursery rules. It does NOT measure cyclomatic complexity or function
length metrics.

### ESLint — Complexity measurement

Use ESLint only for complexity rules. A minimal config targeting just complexity:

```json
// eslint.config.js (flat config)
export default [
  {
    rules: {
      "complexity": ["warn", { "max": 15 }],
      "max-depth": ["warn", { "max": 4 }],
      "max-lines-per-function": ["warn", { "max": 60, "skipBlankLines": true, "skipComments": true }],
      "max-params": ["warn", { "max": 4 }],
      "max-nested-callbacks": ["warn", { "max": 3 }]
    }
  }
];
```

```bash
# Run complexity rules with JSON output
eslint --format json <path>

# Run on specific files only
eslint --format json src/complex-module.ts
```

### knip — Dead code detection

```bash
# Find unused exports, files, dependencies
knip --reporter json

# Include specific entry points
knip --reporter json --entry src/index.ts
```

knip identifies: unused files, unused exports, unused dependencies, unused dev
dependencies, and unlisted dependencies. This is invaluable for cleanup — dead code
is the easiest refactoring target because removing it has zero behavioral risk.

## Language-Specific Refactoring Patterns

### Replace complex conditionals with object lookup

```typescript
// Before (CC contribution: +5)
function getStatusLabel(status: string): string {
  if (status === 'active') return 'Active';
  else if (status === 'inactive') return 'Inactive';
  else if (status === 'pending') return 'Pending Review';
  else if (status === 'archived') return 'Archived';
  else if (status === 'deleted') return 'Removed';
  else return 'Unknown';
}

// After (CC contribution: 0)
const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  pending: 'Pending Review',
  archived: 'Archived',
  deleted: 'Removed',
};

function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? 'Unknown';
}
```

### Simplify promise chains / async flows

```typescript
// Before: nested callbacks/thens
fetchUser(id)
  .then(user => {
    return fetchOrders(user.id)
      .then(orders => {
        return fetchItems(orders[0].id)
          .then(items => {
            // deeply nested
          });
      });
  });

// After: flat async/await
const user = await fetchUser(id);
const orders = await fetchOrders(user.id);
const items = await fetchItems(orders[0].id);
```

### Extract type guards to reduce conditional complexity

```typescript
// Before: repeated type checking
function process(input: string | number | Date | null) {
  if (input === null) { /* ... */ }
  else if (typeof input === 'string') { /* ... */ }
  else if (typeof input === 'number') { /* ... */ }
  else if (input instanceof Date) { /* ... */ }
}

// After: discriminated union with exhaustive handling
type Input =
  | { kind: 'text'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'date'; value: Date };

function process(input: Input) {
  switch (input.kind) {
    case 'text': return handleText(input.value);
    case 'number': return handleNumber(input.value);
    case 'date': return handleDate(input.value);
  }
}
```

### Replace class hierarchies with composition

TypeScript/JavaScript codebases often accumulate unnecessary class hierarchies.
Prefer composition:

```typescript
// Before: inheritance chain
class BaseService { /* shared logic */ }
class UserService extends BaseService { /* user logic */ }
class AdminService extends UserService { /* admin logic */ }

// After: composed functions/modules
function createUserService(db: Database, logger: Logger) {
  return {
    getUser: (id: string) => db.query('users', id),
    createUser: (data: UserData) => { /* ... */ },
  };
}
```

## TS/JS-Specific Anti-Patterns

- **Don't wrap everything in classes.** Plain functions and modules are simpler and
  more testable. Use classes only when you need stateful instances.
- **Don't create barrel files (index.ts re-exports) for small modules.** They obscure
  dependency graphs and hurt tree-shaking.
- **Don't use `any` to simplify refactoring.** It hides type errors that will surface
  later. Use `unknown` and narrow explicitly.
- **Don't create utility files named `utils.ts` or `helpers.ts`.** These become
  dumping grounds. Name files by what they contain: `string-formatting.ts`, `date-math.ts`.
