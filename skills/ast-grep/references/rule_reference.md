# ast-grep Rule & Configuration Reference

Complete reference for rule YAML files and the rule object. Use this when writing complex rules, transforms, or project configurations.

## Table of Contents

1. [Rule YAML top-level keys](#rule-yaml-top-level-keys)
2. [Rule object](#rule-object)
3. [Constraints](#constraints)
4. [Utility rules](#utility-rules)
5. [Transform](#transform)
6. [Fix](#fix)
7. [Rewriters](#rewriters)
8. [Linting fields](#linting-fields)
9. [Globbing](#globbing)
10. [sgconfig.yml project config](#sgconfigyml-project-config)

---

## Rule YAML top-level keys

A rule YAML file contains one or more rule documents separated by `---`. Each document is an object:

```yaml
# === Basic info (required) ===
id: rule-id                    # unique string identifier
language: JavaScript           # language name or alias

# === Finding (required) ===
rule: { ... }                  # Rule object — see below
constraints: { ... }           # optional metavariable filters
utils: { ... }                 # optional local utility rules

# === Patching (optional) ===
transform: { ... }            # metavariable transformations
fix: "replacement"             # string or FixConfig
rewriters: [ ... ]             # rewriter rules for transform.rewrite

# === Linting (optional) ===
severity: warning              # hint | info | warning | error | off
message: "Why this fired"      # single-line, can reference $META_VARS
note: "How to fix"             # markdown, cannot reference meta vars
labels: { ... }                # customize highlighting per metavar
url: "https://..."             # documentation link

# === Globbing (optional) ===
files: [ "src/**/*.ts" ]       # only match in these paths
ignores: [ "test/**" ]         # skip these paths

# === Other (optional) ===
metadata:                      # arbitrary key-value for external tools
  author: my-team
```

### Language aliases

| Language | Aliases |
|----------|---------|
| JavaScript | `javascript`, `js`, `jsx` |
| TypeScript | `typescript`, `ts` |
| TSX | `tsx` |
| Python | `python`, `py` |
| Rust | `rust`, `rs` |
| Go | `go`, `golang` |
| C | `c` |
| C++ | `cpp`, `cc`, `c++`, `cxx` |
| C# | `csharp`, `cs` |
| Java | `java` |
| Kotlin | `kotlin`, `kt` |
| Ruby | `ruby`, `rb` |
| PHP | `php` |
| Bash | `bash` |
| CSS | `css` |
| HTML | `html` |
| JSON | `json` |
| YAML | `yml` |
| Go | `go`, `golang` |
| Lua | `lua` |
| Scala | `scala` |
| Swift | `swift` |
| Elixir | `elixir`, `ex` |
| Haskell | `haskell`, `hs` |
| HCL | `hcl` |
| Nix | `nix` |
| Solidity | `solidity`, `sol` |

---

## Rule object

The `rule:` key accepts a rule object. A rule object is a dictionary with keys from three categories. All keys are optional, but at least one **positive** key must be present. A rule is "positive" if it constrains the node kind (e.g. `pattern`, `kind`, or composites containing them). `regex` and `not` alone are not positive.

### Atomic rules

#### `pattern`

Match a single AST node by code pattern.

**String form:**
```yaml
rule:
  pattern: console.log($ARG)
```

**Object form** (for ambiguous snippets that need parsing context):
```yaml
rule:
  pattern:
    context: "class Foo { $FIELD }"   # full parseable code
    selector: field_definition         # AST kind to extract
    strictness: smart                  # optional: cst|smart|ast|relaxed|signature
```

Strictness levels:
- `cst` — exact concrete syntax tree match (whitespace-sensitive)
- `smart` — default; ignores trivial syntax differences
- `ast` — ignores all unnamed nodes
- `relaxed` — ignores missing optional nodes
- `signature` — only matches function signatures

#### `kind`

Match by AST node kind name. Look up kind names in the ast-grep playground.

```yaml
rule:
  kind: call_expression
```

Supports limited ESQuery child syntax (ast-grep 0.39+):
```yaml
rule:
  kind: "call_expression > identifier"
```

#### `regex`

Match node text against a Rust-flavor regular expression. Must match the **entire** text.

```yaml
rule:
  regex: "^console\\."
```

Perl-like syntax but no lookaround or backreferences.

#### `nthChild`

Match by position in parent's named-children list (1-based indexing).

```yaml
# Number form — exact position
rule:
  nthChild: 1

# An+B formula string
rule:
  nthChild: "2n+1"

# Object form
rule:
  nthChild:
    position: "2n+1"
    reverse: true            # count from end
    ofRule:                  # filter sibling list
      kind: function_declaration
```

#### `range`

Match by source position (0-based lines and columns, start inclusive, end exclusive).

```yaml
rule:
  range:
    start: { line: 0, column: 0 }
    end: { line: 0, column: 3 }
```

---

### Relational rules

All relational rules accept a sub-rule object plus `stopBy` and (for `inside`/`has`) `field`.

#### `inside`

Target node must be inside a node matching the sub-rule.

```yaml
rule:
  pattern: console.log($ARG)
  inside:
    kind: function_declaration
    stopBy: end
    field: body               # optional: restrict to a specific child field
```

#### `has`

Target node must contain a descendant matching the sub-rule.

```yaml
rule:
  kind: function_declaration
  has:
    pattern: await $EXPR
    stopBy: end
    field: body
```

#### `precedes`

Target node must appear before a sibling matching the sub-rule. No `field` option.

```yaml
rule:
  kind: import_statement
  precedes:
    kind: function_declaration
    stopBy: end
```

#### `follows`

Target node must appear after a sibling matching the sub-rule. No `field` option.

```yaml
rule:
  kind: function_declaration
  follows:
    kind: import_statement
    stopBy: end
```

#### `stopBy`

Controls how far to search for the relational match:

| Value | Behavior |
|-------|----------|
| `neighbor` | (default) Only check the immediate surrounding node |
| `end` | Search all the way to root/leaf/first-sibling/last-sibling |
| `{rule}` | Stop when a surrounding node matches this rule (inclusive) |

**Critical**: almost always use `stopBy: end` for `inside` and `has`. The default `neighbor` only checks one level, which rarely matches real code.

#### `field`

A string naming a tree-sitter field on the parent/child. Only available on `inside` and `has`. Restricts matching to that specific structural position.

---

### Composite rules

#### `all`

Array of rules. The target node must satisfy **every** sub-rule. Meta-variables from all sub-rules are merged.

```yaml
rule:
  all:
    - kind: call_expression
    - has:
        pattern: $CALLBACK
        field: arguments
```

#### `any`

Array of rules. The target node must satisfy **at least one** sub-rule. Only the matched sub-rule's meta-variables are captured.

```yaml
rule:
  any:
    - pattern: console.log($$$ARGS)
    - pattern: console.warn($$$ARGS)
    - pattern: console.error($$$ARGS)
```

#### `not`

Single rule. Target node must **not** match. **Not positive** — must be combined with a positive rule.

```yaml
rule:
  all:
    - kind: call_expression
    - not:
        pattern: console.log($$$)
```

#### `matches`

Reference a utility rule by its string id.

```yaml
rule:
  matches: is-function
```

---

## Constraints

`constraints` filters metavariable captures after the `rule` matches. Keys are metavariable names without `$`. Values are rule objects.

Only works on single metavariables (`$ARG`), **not** multi-metavariables (`$$$ARGS`).

```yaml
rule:
  pattern: $FN($ARG)
constraints:
  ARG:
    kind: string_fragment
  FN:
    regex: "^(log|warn|error)$"
```

Constrained metavariables usually do not work inside `not`.

---

## Utility rules

`utils` defines local reusable rules referenced via `matches`:

```yaml
utils:
  is-function:
    any:
      - kind: function_declaration
      - kind: function
      - kind: arrow_function
rule:
  all:
    - matches: is-function
    - has:
        pattern: console.log($$$)
        stopBy: end
```

Global utility rules live in files under `utilDirs` in `sgconfig.yml`.

---

## Transform

`transform` creates new metavariables from existing ones via string operations. Keys are new variable names (used as `$NEW_VAR` in `fix`). Values are transformation objects.

### `replace`

Regex replace on a metavariable's text.

```yaml
transform:
  CLEAN_ARGS:
    replace:
      source: $ARGS        # must be prefixed with $
      replace: "^\\s+"     # Rust regex
      by: ""                # replacement string (supports capture groups)
```

### `substring`

Slice characters (Python-style: inclusive start, exclusive end, negative indices supported).

```yaml
transform:
  INNER:
    substring:
      source: $STR
      startChar: 1       # optional
      endChar: -1         # optional
```

### `convert`

Change string case. Source should ideally be an identifier.

```yaml
transform:
  KEBAB_NAME:
    convert:
      source: $NAME
      toCase: kebabCase    # lowerCase|upperCase|capitalize|camelCase|snakeCase|kebabCase|pascalCase
      separatedBy: [Underscore, CaseChange]  # optional: Dash|Dot|Space|Slash|Underscore|CaseChange
```

### `rewrite`

Apply rewriter rules to transform content within a metavariable's AST subtree.

```yaml
transform:
  REWRITTEN:
    rewrite:
      source: $BODY        # single ($VAR) or multi ($$$VAR)
      rewriters: [rule1, rule2]  # references to `rewriters` section
      joinBy: "\n"          # optional: join rewritten nodes with this string
```

Higher-level AST nodes are matched first. For a single node, rewriters are tried in order; first match wins.

---

## Fix

### String fix

Replace the matched node with a string. Metavariables are expanded. Not parsed by tree-sitter so metavariables can appear anywhere.

```yaml
fix: logger.log($$$ARGS)
```

Use empty string to delete:
```yaml
fix: ""
```

### FixConfig (object form)

For list-item deletions where surrounding punctuation (commas, semicolons) must also be removed:

```yaml
fix:
  template: ""                   # replacement text
  expandEnd:                     # expand fix range until rule stops matching
    regex: ","
  # expandStart also available
```

`expandStart` and `expandEnd` are rule objects with an optional `stopBy`.

---

## Rewriters

Defined at the top level of a rule YAML. Each rewriter is a mini-rule with finding + patching fields and an `id`. Used by `transform.rewrite`.

```yaml
rewriters:
  - id: stringify
    rule:
      pattern: "'' + $A"
    fix: "String($A)"

rule:
  pattern: $EXPR
transform:
  CLEANED:
    rewrite:
      source: $EXPR
      rewriters: [stringify]
fix: $CLEANED
```

---

## Linting fields

| Field | Type | Description |
|-------|------|-------------|
| `severity` | string | `hint`, `info`, `warning`, `error`, or `off` |
| `message` | string | Single-line description. Can use `$META_VAR`. |
| `note` | string | Markdown elaboration. Cannot use metavariables. |
| `url` | string | Link to documentation. |
| `labels` | map | Per-metavariable highlight config: `{style: primary\|secondary, message: "..."}` |
| `metadata` | map | Arbitrary key-value for external tools (output with `--json --include-metadata`) |

---

## Globbing

### `files`

Array of globs. Rule only applies to matching files. Paths relative to `sgconfig.yml`.

```yaml
files:
  - "src/**/*.ts"
  - glob: "*.tsx"
    caseInsensitive: true
```

### `ignores`

Array of globs. Matching files are excluded before `files` is checked.

```yaml
ignores:
  - "test/**"
  - "node_modules/**"
```

**Do not prefix with `./`** — ast-grep won't recognize the path.

Evaluation order:
1. If `ignores` configured and file matches → skip (files not tested).
2. If `files` configured and file matches → include.
3. If neither configured → include by default.

---

## sgconfig.yml project config

The project root config file. Required for `ast-grep scan` (without `--inline-rules` or `--rule`).

```yaml
# Required
ruleDirs:
  - rules                    # directories containing rule YAML files

# Optional
testConfigs:
  - testDir: tests
    snapshotDir: __snapshots__

utilDirs:
  - utils                    # global utility rules

# Override language-to-extension mapping
languageGlobs:
  html: ["*.vue", "*.svelte", "*.astro"]
  json: [".eslintrc"]
  tsx: ["*.ts"]              # useful for rule reuse between similar langs

# Register custom tree-sitter languages
customLanguages:
  mojo:
    libraryPath: mojo.so
    extensions: [mojo]
    expandoChar: "_"          # replaces $ in patterns

# Experimental: embedded language support
languageInjections:
  - hostLanguage: js
    rule:
      pattern: "styled.$TAG`$CONTENT`"
    injected: css
```

All paths in `sgconfig.yml` are relative to the file's own directory.

Create a new project scaffold: `ast-grep new project`
Create a new rule: `ast-grep new rule`
Create a new test: `ast-grep new test`
Create a new utility rule: `ast-grep new util`
