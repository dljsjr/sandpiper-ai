---
name: ast-grep
description: >
  Use ast-grep (sg) for structural code search, lint, and rewrite using AST patterns.
  Prefer ast-grep over grep/ripgrep/sed whenever the task involves matching code by
  syntactic structure rather than plain text — e.g. finding function calls with specific
  argument shapes, locating patterns inside particular contexts (a call inside a loop,
  an import inside a class), renaming symbols while respecting scope, enforcing lint
  rules based on AST node kinds, or performing large-scale codemod rewrites. Also use
  during refactoring to find all call sites of a function, all instances of an error
  handling pattern (like .map_err closures), all trait method implementations, or any
  repeated code pattern you want to extract or replace. Triggers: "ast-grep", "sg",
  "structural search", "codemod", "code pattern", "syntax-aware search", "find all
  call sites", "find everywhere we use", or any code search where the shape of the
  code matters more than the literal text.
compatibility: Requires ast-grep CLI installed (brew install ast-grep / npm i -g @ast-grep/cli / cargo install ast-grep --locked / pip install ast-grep-cli).
---

# ast-grep — Structural Code Search, Lint & Rewrite

ast-grep (`sg`) matches code by its Abstract Syntax Tree, not by text. Patterns look like ordinary code with metavariable wildcards. It supports 25+ languages out of the box.

## When to use ast-grep vs text search

- **Use ast-grep** when you need to match code *structure*: specific function signatures, call patterns with certain argument shapes, expressions inside certain contexts, or rewrites that must preserve syntactic correctness.
- **Use grep/ripgrep** for plain-text or regex-over-text searches where syntax doesn't matter (log messages, comments, string literals).

## Quick-start workflow

### 1. One-liner search with `ast-grep run`

```bash
# Find all console.log calls (any language auto-detected from file extension)
ast-grep run -p 'console.log($$$ARGS)' .

# Specify language explicitly
ast-grep run -p 'fmt.Println($$$ARGS)' -l go .

# Search and replace
ast-grep run -p '$A && $A()' -r '$A?.()' -l tsx .

# Interactive rewrite (prompts before each change)
ast-grep run -p '$A && $A()' -r '$A?.()' -l tsx -i .

# Apply all rewrites without prompts
ast-grep run -p '$A && $A()' -r '$A?.()' -l tsx -U .

# JSON output for programmatic consumption
ast-grep run -p 'console.log($$$ARGS)' --json .
```

`run` is the default subcommand — `ast-grep -p 'foo()'` is equivalent to `ast-grep run -p 'foo()'`.

### 2. Rule-based search with `ast-grep scan --inline-rules`

For anything beyond a simple pattern, use `scan --inline-rules` to pass a full YAML rule:

```bash
ast-grep scan --inline-rules '
id: find-target
language: JavaScript
rule:
  pattern: console.log($ARG)
  inside:
    kind: function_declaration
    stopBy: end
' .
```

### 3. Project-level scanning with `ast-grep scan`

For reusable lint rules, create an `sgconfig.yml` project and rule YAML files, then:

```bash
ast-grep scan                    # scan with sgconfig.yml in cwd
ast-grep scan -c path/to/sgconfig.yml
ast-grep scan --rule path/to/single-rule.yml
```

## Pattern syntax

Patterns are valid code snippets with metavariable wildcards:

| Syntax | Meaning | Example |
|--------|---------|---------|
| `$VAR` | Match exactly one AST node | `console.log($ARG)` |
| `$$$VARS` | Match zero or more nodes | `console.log($$$ARGS)` |
| `$_VAR` | Non-capturing (each occurrence independent) | `$_FN($_ARG)` |
| `$$VAR` | Capture unnamed nodes | `$$OP` |

**Metavariable names**: `$` + uppercase letters/digits/underscores. E.g. `$A`, `$MY_VAR`, `$ARG1`.

**Capturing**: Same-name metavariables must match identical subtrees. `$A == $A` matches `x == x` but not `x == y`.

**Pattern must be valid syntax** that tree-sitter can parse. If a snippet is ambiguous, use the object form in YAML:

```yaml
pattern:
  context: 'class Foo { $FIELD }'
  selector: field_definition
```

## Rule YAML structure

A rule YAML has these sections (see `references/rule_reference.md` for full details):

```yaml
id: rule-id                  # unique identifier
language: JavaScript         # required
rule:                        # how to find matches — see rule object below
  pattern: console.log($ARG)
severity: warning            # hint | info | warning | error | off
message: "Avoid console.log in production"
note: "Use a logger instead"
fix: logger.log($ARG)       # optional auto-fix (string or FixConfig)
constraints:                 # filter metavariable matches
  ARG:
    kind: number
```

### Rule object (the `rule:` key)

Three categories of rules, composable together:

**Atomic rules** — match a single node:
- `pattern`: code pattern string or `{context, selector, strictness}` object
- `kind`: AST node kind name (e.g. `call_expression`, `function_declaration`)
- `regex`: Rust regex that must match the node's full text

**Relational rules** — filter by position relative to other nodes:
- `inside`: node must be inside a node matching the sub-rule
- `has`: node must contain a descendant matching the sub-rule
- `precedes` / `follows`: sibling order

Each relational rule accepts `stopBy` (`neighbor` | `end` | Rule) and optionally `field`.

**Composite rules** — logic operators:
- `all`: array of rules, all must match
- `any`: array of rules, at least one must match
- `not`: single rule, must not match
- `matches`: reference a utility rule by id

### Example: combining rules

```yaml
id: no-console-in-async
language: JavaScript
rule:
  all:
    - pattern: console.log($$$ARGS)
    - inside:
        kind: function_declaration
        has:
          kind: async
        stopBy: end
severity: warning
message: "Remove console.log from async functions"
fix: ""
```

## Gotchas

- **Always set `stopBy: end` on relational rules** when you want to search all the way up/down. The default `stopBy: neighbor` only checks the immediate parent/child, which almost never matches deeply nested code.
- **`-i` (interactive mode) requires a TTY**. Never use `-i` in non-interactive contexts (scripts, piped commands, CI). Use `-U` (update-all) to apply all changes without confirmation, or `--json` to inspect matches first.
- **Pattern code must parse**. If your pattern looks like a fragment (e.g. a bare object key), wrap it in an object-style pattern with `context` and `selector`.
- **Language is auto-detected from file extension**. Use `-l <lang>` explicitly when reading from stdin or when the extension is non-standard.
- **Metavariable `$X` matches one node, `$$$X` matches zero or more**. Forgetting `$$$` for variadic arguments is the most common mistake.
- **`constraints` only work on single metavariables** (`$ARG`), not multi-metavariables (`$$$ARGS`).
- **`not` is not positive** — it cannot be the only rule. Combine it with a positive rule via `all`:
  ```yaml
  rule:
    all:
      - kind: call_expression
      - not: { pattern: console.log($$$) }
  ```
- **`all`/`any` filter a single node, not multiple nodes.** `all` means "this one node must satisfy every sub-rule", not "find nodes that each satisfy a different sub-rule".
- **Globs in rule YAML `files`/`ignores`**: do NOT prefix with `./`. Paths are relative to `sgconfig.yml`.
- **Multiple rules in one file**: separate with `---` (YAML document separator).
- **JSON output**: use `--json=compact` for streaming/piping, `--json=pretty` for reading.

## Developing and testing rules iteratively

1. **Start simple**: write a minimal pattern, run it, inspect results.
2. **Narrow with relational rules**: add `inside`, `has`, `not` to filter false positives.
3. **Inspect AST structure**: use `--debug-query -l <lang>` to see how your pattern parses:
   ```bash
   ast-grep run --debug-query -l javascript -p 'console.log($ARG)'
   ```
4. **Test with inline rules**: use `scan --inline-rules` to iterate on complex YAML rules without creating files.
5. **Validate fixes**: always preview with `--json` or `-i` before applying with `-U`.

## Project setup (sgconfig.yml)

```yaml
ruleDirs:
  - rules              # directories containing rule YAML files
testConfigs:
  - testDir: tests     # test YAML files
    snapshotDir: __snapshots__
utilDirs:
  - utils              # global utility rules
```

Create scaffolding: `ast-grep new project`

## Supported languages

Bash, C, C++, C#, CSS, Elixir, Go, Haskell, HCL, HTML, Java, JavaScript (jsx),
JSON, Kotlin, Lua, Nix, PHP, Python, Ruby, Rust, Scala, Solidity, Swift,
TypeScript, TSX, YAML.

Custom languages can be registered via `customLanguages` in `sgconfig.yml`.

## Further reference

- For the **complete rule object reference** (all atomic, relational, composite rules, transforms, fix config, rewriters): read `references/rule_reference.md`
- For the **full CLI flags and subcommands**: read `references/cli_reference.md`
- If the above references are not sufficient for an edge case, read `references/llms-full.txt` — this is the complete concatenated documentation bundle from ast-grep's official site (guides, reference pages, examples, advanced topics, and FAQs). It is large, so only load it when the curated references above do not answer the question.
