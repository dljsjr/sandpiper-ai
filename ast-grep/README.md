# ast-grep Configuration

Structural code analysis, queries, and transforms for the sandpiper-ai monorepo.

## Directory Layout

```
ast-grep/
├── rules/          # Lint rules — run by `ast-grep scan` (via sgconfig.yml)
├── queries/        # Ad-hoc code queries — run individually with --rule
├── transforms/     # Code transforms — run individually with --rule
└── utils/          # Shared utility rules (referenced by other rules)
```

## Usage

### Lint scan (CI / pre-commit)

```sh
ast-grep scan                    # Uses sgconfig.yml at repo root
bun check:ast-grep               # Same, via package.json script
```

### Ad-hoc queries

```sh
# Find all exported functions in a module
ast-grep scan --rule ast-grep/queries/find-exported-functions.yml extensions/shell-relay/

# Find all pi framework imports (verify architecture boundaries)
ast-grep scan --rule ast-grep/queries/find-pi-imports.yml extensions/

# Count test assertions
ast-grep scan --rule ast-grep/queries/find-test-assertions.yml extensions/ 2>&1 | grep -c "┌─"

# Find all error throw sites
ast-grep scan --rule ast-grep/queries/find-error-throws.yml packages/sandpiper-tasks-cli/

# Find all async functions
ast-grep scan --rule ast-grep/queries/find-async-functions.yml extensions/shell-relay/
```

### Transforms (preview before applying)

```sh
# Preview: find interface props missing readonly
ast-grep scan --rule ast-grep/transforms/readonly-interface-props.yml extensions/

# Apply: add readonly to interface props
ast-grep scan --rule ast-grep/transforms/readonly-interface-props.yml extensions/ -U

# Find execSync candidates for async conversion
ast-grep scan --rule ast-grep/transforms/execsync-to-spawn.yml packages/

# Find string concatenation candidates for template literals
ast-grep scan --rule ast-grep/transforms/string-concat-to-template.yml packages/
```

## Rules

| Rule | Severity | Description |
|------|----------|-------------|
| `no-any-type` | warning | Flags `any` type annotations |
| `no-ts-ignore` | error | Flags `@ts-ignore` / `@ts-expect-error` |
| `no-console-in-source` | warning | Flags `console.*` in non-CLI source |
| `no-unsafe-catch` | info | Notes catch blocks with only comments |
| `prefer-node-protocol` | warning | Flags bare node module imports |
| `no-process-exit` | warning | Flags `process.exit()` calls |

## Queries

| Query | Description |
|-------|-------------|
| `find-exported-functions` | Map a module's public function API |
| `find-exported-interfaces` | Map a module's public type API |
| `find-pi-imports` | Verify framework import boundaries |
| `find-test-assertions` | Count test assertion density |
| `find-error-throws` | Map error handling paths |
| `find-async-functions` | Identify async boundaries |

## Transforms

| Transform | Description |
|-----------|-------------|
| `readonly-interface-props` | Add `readonly` to interface properties |
| `execsync-to-spawn` | Find sync subprocess calls (manual review) |
| `string-concat-to-template` | Find string concatenation candidates |
