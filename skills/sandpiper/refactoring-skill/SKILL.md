---
name: refactoring
description: >
  Use this skill whenever performing code cleanup, refactoring, reducing complexity, improving
  code health, removing duplication, or restructuring existing code. Triggers include: any mention
  of "refactor", "cleanup", "code health", "code quality", "reduce complexity", "simplify",
  "tech debt", "code smell", "dead code", "duplication", requests to "clean up" a file or module,
  or when metrics indicate a file needs attention (high cyclomatic complexity, deep nesting,
  excessive length). Also trigger when the user asks to "improve" or "tidy up" existing code,
  or when working on a file that is clearly overgrown or poorly structured. This skill covers
  the full refactoring workflow: measurement, target identification, safe transformation, and
  verification. Always consult this skill before performing non-trivial refactoring — it contains
  metric thresholds, tool commands, language-specific guidance, and anti-patterns to avoid.
---

# Code Refactoring & Health Improvement

This skill provides a structured workflow for improving code health through measured,
verified refactoring. It is language-agnostic at the core, with language-specific
reference files for tooling and idioms.

## Language-Specific References

After reading this file, read the appropriate reference for the target language:

| Language | Reference file | When to read |
|----------|---------------|--------------|
| TypeScript / JavaScript | `references/typescript.md` | Any .ts, .tsx, .js, .jsx, .mjs, .cjs files |
| Python | `references/python.md` | Any .py files |
| Rust | `references/rust.md` | Any .rs files, Cargo projects |
| Go | `references/go.md` | Any .go files |
| C / C++ | `references/c-cpp.md` | Any .c, .cpp, .h, .hpp files |
| Swift | `references/swift.md` | Any .swift files |
| Ruby | `references/ruby.md` | Any .rb files |
| Java / Kotlin | `references/java-kotlin.md` | Any .java, .kt, .kts files |
| Lua | `references/lua.md` | Any .lua files, Neovim plugins, Love2D, OpenResty, embedded scripting |
| PHP | `references/php.md` | Any .php files, Laravel, Symfony, WordPress |

Always read the relevant language reference before starting work. If working across
multiple languages, read all relevant references.

---

## The Refactoring Workflow

Every refactoring follows five phases. Do not skip phases.

### Phase 1: Measure (before)

Capture baseline metrics on the target files before making any changes.

**Universal tools (run these regardless of language):**

```bash
# Line counts, complexity estimate, and COCOMO for the target path
scc --format json --by-file <path>

# Per-function cyclomatic complexity (supports 16+ languages)
lizard --csv <path>

# Clone detection across the target directory
jscpd <path> --reporters json --output /tmp/jscpd-report

# Structural anti-pattern scan (catches what linters miss)
# Customize patterns for the language — these are TypeScript examples:
ast-grep run -p 'catch ($ERR) { }' -l ts <path>                # empty catch blocks
ast-grep run -p 'catch ($ERR) { console.log($$$) }' -l ts <path>  # log-and-swallow
ast-grep run -p 'as any' -l ts <path>                           # type-safety escapes

# Architectural health snapshot (if sentrux is available)
sentrux snapshot --label before-refactor
```

Then run the language-specific linter/analyzer (see language reference).

**What to capture from this phase:**
- List of functions with CC > 10, noting any > 15 or > 20
- List of functions longer than 60 lines
- List of functions with nesting depth > 3
- Duplication percentage and specific clone locations
- Structural anti-patterns found by ast-grep (silent catches, type escapes, etc.)
- sentrux composite score (if available)

### Phase 2: Identify Targets

Prioritize refactoring targets using this hierarchy:

1. **Critical (fix first):** Functions with CC > 20, files with duplicated blocks that
   have diverged (inconsistent clones), dead code (unreachable branches, unused exports)
2. **High (fix next):** Functions with CC 15–20, functions longer than 60 lines,
   nesting depth > 4 levels, high fan-out (> 10 imports from distinct modules)
3. **Medium (fix if touching):** Functions with CC 10–15, functions 25–60 lines,
   nesting depth of 4, moderate duplication
4. **Low (note for later):** Style inconsistencies, minor naming issues, missing
   type annotations on internal code

**Hotspot heuristic:** If git history is available, prioritize files that are both
complex AND frequently modified:

```bash
# Find files with most commits in last 6 months
git log --since="6 months ago" --format='' --name-only | sort | uniq -c | sort -rn | head -20
```

Cross-reference this list with the complexity data from Phase 1. Files appearing in
both the "high complexity" and "high churn" lists are the highest-ROI refactoring targets.

### Phase 3: Transform

Apply refactorings in order of safety (least likely to break behavior first):

**Safe refactorings (do freely):**
- Extract function/method (reduces CC and length)
- Flatten nesting with early returns / guard clauses
- Replace magic numbers/strings with named constants
- Remove dead code (unused variables, unreachable branches, commented-out code)
- Rename for clarity (variables, functions, parameters)

**Bulk structural transforms with ast-grep:**

ast-grep can apply safe, pattern-based rewrites across an entire codebase in one
command. Use it for mechanical transformations where the pattern is unambiguous:

```bash
# Preview what would change (always preview first)
ast-grep run -p '<old-pattern>' -r '<new-pattern>' -l <lang> <path>

# Apply all changes
ast-grep run -p '<old-pattern>' -r '<new-pattern>' -l <lang> -U <path>
```

Common safe ast-grep transforms:
```bash
# Replace && guard calls with optional chaining
ast-grep run -p '$A && $A()' -r '$A?.()' -l ts -U <path>

# Replace string concatenation with template literals (preview first)
ast-grep run -p '$A + $B' -l ts <path>  # inspect matches, then apply selectively

# Add readonly to interface properties
ast-grep run --rule ast-grep/transforms/readonly-interface-props.yml -U <path>

# Find and preview all type-safety escapes before deciding how to fix
ast-grep run -p 'as any' -l ts <path>
```

For complex transforms, use `scan --inline-rules` with a YAML rule to combine
structural matching with relational constraints (e.g., "find console.log only
inside async functions"):

```bash
ast-grep scan --inline-rules '
id: find-target
language: TypeScript
rule:
  pattern: console.log($$$ARGS)
  inside:
    kind: function_declaration
    has:
      kind: async
    stopBy: end
' <path>
```

**Always preview ast-grep rewrites with `--json` or without `-U` before applying.**
ast-grep operates on syntax trees, not text — it's safer than sed, but still verify.

**Moderate refactorings (verify with tests):**
- Extract class / module (split large files)
- Replace conditional with polymorphism
- Introduce parameter object (for functions with > 4 params)
- Consolidate duplicate code into shared function
- Simplify boolean expressions

**Structural refactorings (require careful review):**
- Change function signatures / public APIs
- Move code between modules (affects import graphs)
- Introduce or remove abstraction layers
- Change data structures or state management

**Rules during transformation:**
- Make one logical change per step. Don't combine "extract function" with "change algorithm."
- After each step, verify the code still compiles/parses.
- If tests exist, run them after each structural change.
- Never change behavior during a refactoring. If you spot a bug, fix it in a separate step.
- Preserve the existing test suite. Never modify tests to make refactored code pass —
  if tests fail, the refactoring introduced a regression.

### Phase 4: Measure (after)

Re-run exactly the same measurement commands from Phase 1 on the modified files.

```bash
scc --format json --by-file <path>
lizard --csv <path>
jscpd <path> --reporters json --output /tmp/jscpd-report-after

# If sentrux was used before
sentrux snapshot --label after-refactor
sentrux diff before-refactor after-refactor
```

**Verify the ratchet:**
- No function's CC should be higher than before (unless a justified new function was added)
- Overall duplication percentage should not increase
- Total lines of code should decrease or stay the same (refactoring rarely needs more code)
- sentrux score should improve or stay constant
- If any metric worsened, investigate and fix before proceeding

### Phase 5: Verify

- Run the full test suite. All tests must pass.
- Run the language-specific linter. No new warnings should be introduced.
- If the refactoring changed public APIs, verify all callers have been updated.
- Summarize: list what changed, which metrics improved, and by how much.

---

## Metric Thresholds

These thresholds are grounded in empirical research. Treat them as starting points,
not absolute rules. Context matters — a CC of 12 in a well-tested parser may be
fine; a CC of 8 in an untested utility function may be dangerous.

| Metric | Good | Investigate | Refactor | Source |
|--------|------|-------------|----------|--------|
| Cyclomatic complexity (per function) | ≤ 10 | 11–15 | > 15 | NIST 500-235; McCabe 1976 |
| Cognitive complexity (per function) | ≤ 10 | 11–15 | > 15 | SonarSource; ESEM 2020 |
| Function length (lines) | 5–25 | 26–60 | > 60 | Hatton 1997; consensus |
| Nesting depth | ≤ 3 | 4 | > 4 | Antinyan et al. 2017 |
| Parameter count | ≤ 4 | 5–6 | > 6 | Clean Code; cognitive load |
| File length (lines) | < 300 | 300–500 | > 500 | Experience-based |
| Code duplication | < 3% | 3–5% | > 5% | SonarQube defaults; Juergens 2009 |
| Coupling (imports from distinct modules) | < 8 | 8–12 | > 12 | CK metrics research |

## Tool Reference (Universal)

### scc — Fast line/complexity counting

```bash
# JSON output, per-file breakdown
scc --format json --by-file .

# Filter to specific languages
scc --format json --include-ext py,rs .

# Just get totals
scc --format json .
```

Output includes: lines, code, comments, blanks, complexity (branch-keyword count),
and COCOMO estimates per file. Complexity is approximate (not AST-based) but useful
for triage. Extremely fast — runs in milliseconds on large repos.

### lizard — Per-function cyclomatic complexity

```bash
# CSV output (function name, file, NLOC, CC, tokens, params, start line, end line)
lizard --csv <path>

# Filter to functions above a CC threshold
lizard -T cyclomatic_complexity=15 <path>

# Specific languages only
lizard -l python -l javascript <path>

# Include modified CCN (penalizes nesting)
lizard --csv -Ens <path>

# Sort by complexity, show worst offenders
lizard -s cyclomatic_complexity <path>
```

lizard is the most important tool in this workflow. It gives you per-function CC
without needing compilation, header files, or language servers. Supports: C/C++,
Java, C#, JavaScript, TypeScript, Python, Ruby, Go, Rust, Swift, PHP, Kotlin, Lua,
Scala, GDScript, and more.

### jscpd — Clone detection

```bash
# Detect duplicates with JSON report
jscpd <path> --reporters json --output /tmp/jscpd-report

# Minimum token threshold (default 50, lower = more sensitive)
jscpd <path> --min-tokens 30 --reporters json --output /tmp/jscpd-report

# Ignore specific patterns
jscpd <path> --ignore "**/*.test.*,**/generated/**" --reporters json
```

Output includes: clone locations (file, start line, end line), duplication percentage,
and clone groups. Focus on clones in non-test, non-generated code.

### sentrux — Architectural health monitoring

```bash
# Take a snapshot of current state
sentrux snapshot --label <name>

# Compare two snapshots
sentrux diff <before-label> <after-label>

# Analyze current state without snapshot
sentrux analyze <path>
```

sentrux measures five architectural dimensions: modularity, acyclicity, depth,
equality, and redundancy. Its composite score uses geometric mean, making it
resistant to gaming by improving one dimension at the expense of others.

Use it as a directional signal for architectural health. A declining score after
refactoring suggests you may have introduced coupling or structural problems
even if function-level metrics improved.

### ast-grep — Structural pattern search and rewrite

ast-grep matches code by its AST, not by text. Patterns look like ordinary code
with `$WILDCARD` placeholders. This makes it precise — it finds function *calls*,
not comments mentioning the function name. Use the `ast-grep` binary (not `sg`,
which collides with another common tool).

```bash
# Find all functions — map a module's structure
ast-grep run -p 'export function $NAME($$$PARAMS)' -l ts <path>

# Find structural anti-patterns
ast-grep run -p 'catch ($ERR) { }' -l ts <path>           # empty catch blocks
ast-grep run -p 'as any' -l ts <path>                     # type-safety escapes
ast-grep run -p 'process.exit($$$)' -l ts <path>          # hard exits

# Find all call sites of a specific function
ast-grep run -p 'processEvent($$$ARGS)' -l ts <path>

# Search and replace (preview)
ast-grep run -p '$A && $A()' -r '$A?.()' -l ts <path>

# Apply all replacements
ast-grep run -p '$A && $A()' -r '$A?.()' -l ts -U <path>

# JSON output for programmatic consumption
ast-grep run -p 'console.log($$$ARGS)' --json <path>
```

Supports 25+ languages: TypeScript, JavaScript, Python, Rust, Go, C, C++, Java,
Kotlin, Swift, Ruby, PHP, Lua, and more.

For complex queries (e.g., "find console.log only inside async functions"), use
`scan --inline-rules` with a YAML rule:

```bash
ast-grep scan --inline-rules '
id: find-target
language: TypeScript
rule:
  pattern: console.log($$$ARGS)
  inside:
    kind: function_declaration
    has:
      kind: async
    stopBy: end
' <path>
```

**Key gotchas:**
- Always set `stopBy: end` on relational rules (`inside`, `has`). The default
  `stopBy: neighbor` only checks the immediate parent/child.
- `$VAR` matches one AST node; `$$$VARS` matches zero or more. Forgetting `$$$`
  for variadic arguments is the most common mistake.
- Preview all rewrites before applying with `-U`. Use `--json` for programmatic review.
- `-i` (interactive mode) requires a TTY — use `-U` in automated/agent contexts.

---

## Common Refactoring Patterns

### Flatten nesting with guard clauses

Before:
```
function process(data) {
    if (data) {
        if (data.isValid) {
            if (data.items.length > 0) {
                // actual logic here (deeply nested)
            }
        }
    }
}
```

After:
```
function process(data) {
    if (!data) return;
    if (!data.isValid) return;
    if (data.items.length === 0) return;

    // actual logic here (flat)
}
```

### Extract function to reduce complexity

When a function has CC > 15, identify independent branches or blocks and extract
them into well-named helper functions. Each extracted function should:
- Do exactly one thing
- Have a name that describes what it does, not how
- Take only the parameters it needs (not a god-object)
- Return a value rather than mutating shared state, when possible

### Consolidate duplicated blocks

When jscpd identifies clones:
1. Verify the clones are truly identical in intent (not just similar-looking)
2. Extract the shared logic into a single function
3. Replace all clone sites with calls to the shared function
4. If the clones have small variations, parameterize the shared function

### Replace complex conditionals

When a function has a long chain of if/else-if or a switch with many cases:
- Consider a lookup table (map/dict) if each branch returns a value
- Consider polymorphism if each branch has complex behavior
- Consider the strategy pattern only if you have 3+ strategies that change independently

### Reduce parameter count

When a function takes > 5 parameters:
- Group related parameters into a struct/object/dataclass
- Check if some parameters are always passed together (indicates a missing abstraction)
- Check if some parameters have defaults that are rarely overridden (make them optional)
- Check if the function is doing too many things (split it)

---

## Anti-Patterns: What NOT to Do

**Don't game metrics.** Splitting a function at an arbitrary point to get CC from 16 to
two functions of 8 is worse than leaving it at 16. The split must reflect a genuine
logical boundary.

**Don't over-abstract.** Adding a factory, a builder, an interface, and a DI container
to "reduce coupling" creates more complexity than it removes. Simple, direct code
with moderate coupling is better than complex code with low measured coupling.

**Don't refactor everything at once.** Focus on the highest-impact targets first.
A codebase with 100 functions at CC 12 is fine — don't waste time bringing them
all to CC 8. Focus on the 5 functions at CC 25.

**Don't refactor without tests.** If the code has no tests, write characterization
tests for the current behavior before refactoring. If you can't write tests (too
tightly coupled), that's the first refactoring: make it testable.

**Don't change behavior during refactoring.** Bug fixes and refactorings should be
separate steps. This makes each step independently verifiable.

**Don't chase duplication below 3%.** Some duplication is fine. Removing it often
introduces coupling or abstraction overhead that is worse than the duplication itself.
Focus on clones that are maintained inconsistently (diverged clones).

**Don't create tiny functions.** Very short functions (1–3 lines) that are only called
once increase the vocabulary a reader must learn. Inline them unless the name adds
genuine clarity or the function is reused.

---

## SonarQube (Optional, Heavy)

If a SonarQube server is running locally (Docker), use it for comprehensive analysis:

```bash
# Run scanner against local server (assumes server at localhost:9000)
sonar-scanner \
  -Dsonar.projectKey=<project-key> \
  -Dsonar.sources=<path> \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.token=<token>

# Fetch results via API
curl -s "http://localhost:9000/api/issues/search?componentKeys=<project-key>&types=CODE_SMELL&severities=CRITICAL,MAJOR" | jq
```

SonarQube provides cognitive complexity, code smells, technical debt estimation, and
quality gates across 30+ languages. Use it as a verification gate, not for the inner loop —
startup and analysis times are measured in minutes, not milliseconds.
