# ast-grep CLI Reference

Complete reference for all ast-grep subcommands and flags. The binary is `ast-grep` (alias `sg`).

## Table of Contents

1. [ast-grep run](#ast-grep-run)
2. [ast-grep scan](#ast-grep-scan)
3. [ast-grep test](#ast-grep-test)
4. [ast-grep new](#ast-grep-new)
5. [ast-grep lsp](#ast-grep-lsp)
6. [ast-grep completions](#ast-grep-completions)
7. [Common patterns](#common-patterns)

---

## ast-grep run

One-time search or rewrite from the command line. This is the **default subcommand** — `ast-grep -p 'foo()'` is equivalent to `ast-grep run -p 'foo()'`.

```
ast-grep run [OPTIONS] --pattern <PATTERN> [PATHS]...
```

**Arguments:**
- `[PATHS]...` — directories/files to search (default: `.`)

**Core options:**

| Flag | Description |
|------|-------------|
| `-p, --pattern <PATTERN>` | AST pattern to match (required) |
| `--selector <KIND>` | Extract sub-part of pattern by AST kind |
| `-r, --rewrite <REWRITE>` | Replacement string for matched nodes |
| `-l, --lang <LANG>` | Language (auto-detected from extension if omitted) |

**Match tuning:**

| Flag | Description |
|------|-------------|
| `--strictness <LEVEL>` | `cst`, `smart`, `ast`, `relaxed`, `signature` |
| `--debug-query[=<FORMAT>]` | Print pattern's parsed AST (requires `-l`) |

**Output control:**

| Flag | Description |
|------|-------------|
| `--json[=<STYLE>]` | Output as JSON: `pretty`, `stream`, `compact` |
| `--color <WHEN>` | `auto`, `always`, `ansi`, `never` |
| `--heading <WHEN>` | File name as heading: `auto`, `always`, `never` |
| `-A, --after <NUM>` | Context lines after match (default: 0) |
| `-B, --before <NUM>` | Context lines before match (default: 0) |
| `-C, --context <NUM>` | Context lines around match (default: 0) |

**Rewrite control:**

| Flag | Description |
|------|-------------|
| `-i, --interactive` | Interactive edit session (requires TTY — never use in scripts) |
| `-U, --update-all` | Apply all rewrites without confirmation |

**File discovery:**

| Flag | Description |
|------|-------------|
| `--follow` | Follow symbolic links |
| `--no-ignore <TYPE>` | Ignore .gitignore etc: `hidden`, `dot`, `exclude`, `global`, `parent`, `vcs` |
| `--globs <GLOBS>` | Include/exclude file paths by glob |
| `--stdin` | Read code from stdin instead of files |

**Performance:**

| Flag | Description |
|------|-------------|
| `-j, --threads <NUM>` | Thread count (default: heuristic) |

**Diagnostics:**

| Flag | Description |
|------|-------------|
| `--inspect <LEVEL>` | Debug file/rule discovery: `nothing`, `summary`, `entity` |

---

## ast-grep scan

Scan codebase using rule configurations (YAML files or inline rules).

```
ast-grep scan [OPTIONS] [PATHS]...
```

**Arguments:**
- `[PATHS]...` — directories/files to scan (default: `.`)

**Rule source (use one):**

| Flag | Description |
|------|-------------|
| `-c, --config <FILE>` | Path to `sgconfig.yml` (default: `sgconfig.yml` in cwd) |
| `-r, --rule <FILE>` | Scan with a single rule YAML file |
| `--inline-rules <TEXT>` | Scan with a rule defined as inline YAML text |
| `--filter <REGEX>` | Only run rules whose id matches this regex |

**Output control:**

| Flag | Description |
|------|-------------|
| `--json[=<STYLE>]` | JSON output: `pretty`, `stream`, `compact` |
| `--format <FORMAT>` | Machine-readable output: `github` (annotations), `sarif` |
| `--report-style <STYLE>` | Terminal output: `rich` (default), `medium`, `short` |
| `--include-metadata` | Include rule `metadata` in JSON output |
| `--color <WHEN>` | `auto`, `always`, `ansi`, `never` |
| `-A/B/C` | Context lines (same as `run`) |

**Severity overrides:**

| Flag | Description |
|------|-------------|
| `--error[=<ID>...]` | Set rule(s) to error severity |
| `--warning[=<ID>...]` | Set rule(s) to warning severity |
| `--info[=<ID>...]` | Set rule(s) to info severity |
| `--hint[=<ID>...]` | Set rule(s) to hint severity |
| `--off[=<ID>...]` | Disable rule(s) |

**Rewrite control:**

| Flag | Description |
|------|-------------|
| `-i, --interactive` | Interactive edit session (requires TTY) |
| `-U, --update-all` | Apply all fixes without confirmation |

**File discovery:** same as `run` (`--follow`, `--no-ignore`, `--globs`, `--stdin`).

**Performance:** `-j, --threads <NUM>`

**Diagnostics:** `--inspect <LEVEL>`

---

## ast-grep test

Run tests for ast-grep rules. Tests are YAML files with example code and expected matches.

```
ast-grep test [OPTIONS]
```

| Flag | Description |
|------|-------------|
| `-c, --config <FILE>` | Path to root `sgconfig.yml` |
| `-t, --test-dir <DIR>` | Directory containing test YAML files |
| `--snapshot-dir <DIR>` | Snapshot storage directory (default: `__snapshots__`) |
| `--skip-snapshot-tests` | Only validate test code, skip output checks |
| `-U, --update-all` | Update all changed snapshots |
| `-f, --filter <GLOB>` | Filter test cases by glob pattern |
| `--include-off` | Include `severity: off` rules in tests |
| `-i, --interactive` | Interactively review snapshot changes |

### Test YAML format

```yaml
id: rule-id-to-test
valid:                    # code that should NOT match
  - "safe_function(x)"
invalid:                  # code that SHOULD match
  - "console.log(x)"
```

Snapshots capture the exact match output. Update them with `-U` when rules change intentionally.

---

## ast-grep new

Scaffold new project items.

```
ast-grep new [COMMAND] [OPTIONS] [NAME]
```

**Subcommands:**

| Command | Description |
|---------|-------------|
| `project` | Create a new `sgconfig.yml` and directory structure |
| `rule` | Create a new rule YAML file |
| `test` | Create a new test case YAML file |
| `util` | Create a new global utility rule |

**Options:**

| Flag | Description |
|------|-------------|
| `[NAME]` | Id of the item to create |
| `-l, --lang <LANG>` | Language for the new item |
| `-y, --yes` | Accept all defaults (no interactive prompts) |
| `-b, --base-dir <DIR>` | Create in this directory (default: `.`) |

**Examples:**
```bash
ast-grep new project                    # interactive project setup
ast-grep new rule no-console -l js      # create rule with id
ast-grep new test no-console            # create test for rule
ast-grep new util is-function -l js     # create utility rule
ast-grep new project -y                 # accept all defaults
```

---

## ast-grep lsp

Start a Language Server Protocol server for editor integration (diagnostics from scan rules).

```
ast-grep lsp [OPTIONS]
```

| Flag | Description |
|------|-------------|
| `-c, --config <FILE>` | Path to `sgconfig.yml` |

Used by VS Code extension and other LSP-compatible editors.

---

## ast-grep completions

Generate shell completion scripts.

```
ast-grep completions [SHELL]
```

Supported shells: `bash`, `elvish`, `fish`, `powershell`, `zsh`

If `[SHELL]` is omitted, it is inferred from the environment.

**Example:**
```bash
# Add to your shell profile
ast-grep completions bash >> ~/.bashrc
ast-grep completions zsh >> ~/.zshrc
ast-grep completions fish > ~/.config/fish/completions/ast-grep.fish
```

---

## Common patterns

### Search and preview matches
```bash
ast-grep run -p 'TODO($$$)' -l python .
ast-grep run -p 'fetch($URL, $$$OPTS)' -l typescript --json=pretty .
```

### Search with context lines
```bash
ast-grep run -p 'unsafe { $$$BODY }' -l rust -C 3 .
```

### Replace across codebase (non-interactive)
```bash
ast-grep run -p 'require($MOD)' -r 'import $MOD from $MOD' -l javascript -U .
```

### Scan with inline rule (complex matching)
```bash
ast-grep scan --inline-rules '
id: find-it
language: Python
rule:
  pattern: print($$$ARGS)
  inside:
    kind: function_definition
    stopBy: end
' src/
```

### Scan with single rule file
```bash
ast-grep scan --rule rules/no-console.yml src/
```

### Scan full project
```bash
ast-grep scan                              # uses sgconfig.yml in cwd
ast-grep scan -c config/sgconfig.yml       # explicit config path
ast-grep scan --filter "no-console"        # only rules matching regex
```

### Test rules
```bash
ast-grep test                              # run all tests
ast-grep test -f "no-console*"             # filter by glob
ast-grep test -U                           # update snapshots
```

### Debug a pattern
```bash
ast-grep run --debug-query -l javascript -p 'async function $NAME($$$PARAMS) { $$$BODY }'
```

### Read from stdin
```bash
echo 'console.log("hi")' | ast-grep run --stdin -p 'console.log($$$)' -l javascript
```

### CI integration
```bash
# GitHub Actions annotations
ast-grep scan --format github

# SARIF output (for GitHub Advanced Security, etc.)
ast-grep scan --format sarif > results.sarif

# Fail CI on error-severity matches (exit code non-zero)
ast-grep scan --error
```

### Glob filtering
```bash
# Only search .ts files in src/
ast-grep run -p '$PATTERN' --globs 'src/**/*.ts' .

# Exclude test files
ast-grep run -p '$PATTERN' --globs '!**/*.test.ts' .
```
