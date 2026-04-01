# StrykerJS — JavaScript / TypeScript Mutation Testing

StrykerJS supports JS and TS projects with all major test runners. It uses AST-level
source transformations and coverage-guided test selection for performance.

## Installation and Setup

```bash
npm install --save-dev @stryker-mutator/core

# Interactive setup (detects test runner, creates config)
npx stryker init

# Run
npx stryker run
```

## Configuration

Config file: `stryker.config.mjs` (or `.cjs`, `.json`)

```javascript
// stryker.config.mjs
/** @type {import('@stryker-mutator/core').PartialStrykerOptions} */
export default {
  // Files to mutate (glob patterns)
  mutate: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/**/*.d.ts',
  ],

  // Test runner — install matching plugin package
  testRunner: 'jest',           // @stryker-mutator/jest-runner
  // testRunner: 'vitest',      // @stryker-mutator/vitest-runner
  // testRunner: 'mocha',       // @stryker-mutator/mocha-runner
  // testRunner: 'karma',       // @stryker-mutator/karma-runner
  // testRunner: 'jasmine',     // @stryker-mutator/jasmine-runner
  // testRunner: 'cucumber',    // @stryker-mutator/cucumber-runner
  // testRunner: 'tap',         // @stryker-mutator/tap-runner

  // Coverage analysis (perTest is fastest — maps tests to mutants)
  coverageAnalysis: 'perTest',

  // TypeScript type-checking (kills type-invalid mutants early)
  checkers: ['typescript'],     // requires @stryker-mutator/typescript-checker

  // Thresholds
  thresholds: {
    high: 80,   // Green in reports
    low: 60,    // Yellow in reports
    break: null // Set to a number to fail CI below this score
  },

  // Parallel workers
  concurrency: 4,

  // Incremental mode (dramatically faster repeat runs)
  incremental: true,
  incrementalFile: 'reports/stryker-incremental.json',

  // Reporters
  reporters: ['html', 'clear-text', 'progress'],

  // Disable specific mutators
  mutator: {
    excludedMutations: [
      'StringLiteral',       // Often produces noise in template strings
      'ObjectLiteral',       // Empty object mutations are rarely useful
    ]
  },
};
```

## Test Runner Plugin Installation

Install the plugin matching your test runner:

```bash
# Jest
npm install --save-dev @stryker-mutator/jest-runner

# Vitest
npm install --save-dev @stryker-mutator/vitest-runner

# Mocha
npm install --save-dev @stryker-mutator/mocha-runner

# TypeScript checker (recommended for TS projects)
npm install --save-dev @stryker-mutator/typescript-checker
```

## Mutation Operators

StrykerJS applies these mutation categories:

**Arithmetic**: `+`↔`-`, `*`↔`/`, `%`↔`*`
**Equality**: `===`↔`!==`, `==`↔`!=`, `<=`↔`<`, `>=`↔`>`
**Logical**: `&&`↔`||`, `!a`→`a`
**Unary**: `+a`↔`-a`, `~a`→`a`
**Boolean substitution**: `true`↔`false`
**String literal**: `"foo"`→`""`, `""`→`"Stryker was here!"`
**Array declaration**: `[a, b]`→`[]`
**Object literal**: `{a: b}`→`{}`
**Block statement**: Remove block contents
**Conditional expression**: `cond ? a : b`→`true ? a : b` / `false ? a : b`
**Optional chaining**: `foo?.bar`→`foo.bar`
**Arrow function**: `() => expr`→`() => undefined`
**Regex**: Remove regex flags, simplify patterns
**Method expression**: `startsWith`↔`endsWith`, `toUpperCase`↔`toLowerCase`,
  `trim`↔`trimStart`↔`trimEnd`, `charAt`→``, `filter`↔`some`↔`every`

## Inline Exclusions

```typescript
// Stryker disable next-line all: reason for disabling
const x = a + b;

// Stryker disable all
function untestableBoilerplate() { /* ... */ }
// Stryker restore all

// Stryker disable next-line EqualityOperator,BooleanSubstitution: specific operators
if (a === b && flag) { /* ... */ }
```

## Incremental Mode

When `incremental: true` is set, Stryker saves results to `incrementalFile` and on
subsequent runs performs a diff-based comparison — reusing results when neither the
mutant source nor the killing test has changed. This typically reduces subsequent run
times by 80%+ for codebases with small changes.

Cache the incremental file in CI:

```yaml
- uses: actions/cache@v4
  with:
    path: reports/stryker-incremental.json
    key: stryker-${{ github.ref }}
    restore-keys: stryker-
```

## Dashboard Integration

Stryker offers a cloud dashboard at dashboard.stryker-mutator.io for:
- HTML mutation reports hosted in the cloud
- Mutation score badge for README
- Historical score tracking

Configure with:

```javascript
reporters: ['html', 'dashboard'],
dashboard: {
  project: 'github.com/your-org/your-repo',
  version: 'main',
  reportType: 'full',
}
```

Requires `STRYKER_DASHBOARD_API_KEY` environment variable.

## CI Integration

```yaml
# GitHub Actions
- name: Run Stryker
  run: npx stryker run
  env:
    STRYKER_DASHBOARD_API_KEY: ${{ secrets.STRYKER_DASHBOARD_API_KEY }}

# PR comment with score
- name: Post mutation score
  if: github.event_name == 'pull_request'
  run: |
    SCORE=$(cat reports/mutation/mutation.json | jq '.schemaVersion' -r)
    echo "Mutation score: $SCORE%" >> $GITHUB_STEP_SUMMARY
```

## Troubleshooting

- **"No tests found"**: Verify `testRunner` matches your actual test framework
- **Very slow**: Enable `coverageAnalysis: 'perTest'`, add `incremental: true`,
  reduce `mutate` scope
- **TypeScript errors in mutants**: Add `checkers: ['typescript']` to filter
  type-invalid mutations before test execution
- **React/JSX issues**: Ensure your Stryker config handles JSX transformation
  (usually automatic with Jest/Vitest)
- **ES modules**: Use `.mjs` config file extension
