---
name: mutation-testing
description: >
  Use this skill whenever mutation testing is relevant. Triggers: "mutation testing", "mutation
  score", "mutant", "mutants", "PIT", "pitest", "cargo-mutants", "Stryker", "stryker-mutator",
  "mutmut", "mutation operators", "killed mutant", "survived mutant", "equivalent mutant",
  "test quality", "test effectiveness", "test the tests", "mutation analysis", "are my tests good
  enough", "is my coverage meaningful", "do my tests actually catch bugs". Also trigger when
  verifying test thoroughness, setting up CI quality gates for test effectiveness, or discussing
  why 100% code coverage is insufficient. Covers theory, all major frameworks, result
  interpretation, and the critical insight that survived mutants almost always mean "improve your
  tests" not "fix your code". Always consult before doing mutation testing work — it prevents
  the most common agent mistake of treating survived mutants like regular test failures.
---

# Mutation Testing

Mutation testing measures test suite quality by injecting small faults (mutations) into
production code and checking whether the existing tests catch them. If unit tests and
integration tests test your *code*, mutation tests *test your tests*.

This is a supplemental testing technique — it does not replace unit tests, integration tests,
or any other form of testing. It validates that existing tests are effective.

## The Critical Mental Model

**Read this section carefully. It is the most important part of this skill.**

When a mutation test reports a "survived mutant" (a fault that your tests didn't catch),
the correct response is almost always to **improve the test suite**, not to change the
production code. The production code is presumably correct — the mutation tool deliberately
broke it, and your tests failed to notice. The fix is a better test.

This is the opposite of normal test failure semantics, where a failing test usually means
the code is wrong. Agents that don't internalize this distinction will waste enormous effort
"fixing" production code that was never broken.

**The rare exception**: Sometimes a survived mutant reveals that the production code has
ambiguous semantics that make it genuinely hard to test. For example, a Rust function
returning `Option<String>` where `None` means invalid input, `Some("")` means valid input
with no result, and `Some("value")` means valid input with a result. The mutation tool
replaces the body with `None` and tests don't catch it because the distinction between
"invalid" and "empty valid" isn't observable. The fix here is to refactor the code —
e.g., to `Result<Option<String>, Error>` — making the semantics explicit and testable.
But this is the exception, not the rule. When in doubt, improve the tests first.

## How It Works

1. **Generate mutants**: Apply small syntactic transformations (mutation operators) to
   production code, producing many variants each containing exactly one change.
2. **Run the test suite** against each mutant independently.
3. **Classify results**:
   - **Killed**: At least one test failed → good, your tests caught the fault
   - **Survived**: All tests passed despite the fault → bad, a test gap exists
   - **Equivalent**: The mutation doesn't change observable behavior → can't be killed
   - **Timed out**: The mutation caused an infinite loop → counts as killed
4. **Calculate mutation score**: `killed / (total − equivalent) × 100%`

For a test to kill a mutant, three conditions must hold (the RIP model):
- **Reach**: The test must execute the mutated statement
- **Infect**: The mutation must alter program state
- **Propagate**: The altered state must reach an assertion that checks it

This is precisely why 100% code coverage is insufficient — coverage guarantees
Reachability but says nothing about Infection or Propagation. A test that calls
`calculator.add(1, 2)` without asserting the result achieves full line coverage
of the `add` method but kills zero mutants.

## Mutation Operator Categories

These categories apply across all languages and frameworks:

**Arithmetic operator replacement (AOR)**: `+`↔`-`, `*`↔`/`, `%`→`*`
**Relational operator replacement (ROR)**: `==`↔`!=`, `<`↔`>=`, `>`↔`<=`
**Conditional boundary mutations**: `<`→`<=`, `>=`→`>` (catches off-by-one errors)
**Boolean/logical operator replacement**: `&&`↔`||`, `true`↔`false`, remove `!`
**Return value mutations**: Replace returns with defaults (`null`, `""`, `0`, `false`, empty collections)
**Void method/function call removal**: Delete calls to side-effecting functions
**Statement deletion**: Remove entire blocks or statements
**Increment/decrement mutations**: `i++`→`i--`, `++i`→`--i`
**Constant mutations**: Change literal values (`0`→`1`, `"foo"`→`""`)

## Framework-Specific References

After reading this file, consult the appropriate reference for the project's language:

| Language | Framework | Reference file | When to read |
|----------|-----------|---------------|--------------|
| Java / JVM | PIT (pitest) | `references/pit-java.md` | Any .java, .kt, .scala on JVM |
| Rust | cargo-mutants | `references/cargo-mutants-rust.md` | Any .rs files, Cargo projects |
| JS / TS | StrykerJS | `references/stryker-js-ts.md` | Any .js, .ts, .jsx, .tsx |
| C# / .NET | Stryker.NET | `references/stryker-dotnet.md` | Any .cs, .NET projects |
| Scala | Stryker4s | `references/stryker-scala.md` | Scala projects (sbt) |
| Python | mutmut | `references/mutmut-python.md` | Any .py files |

If the project uses a framework not listed here, the principles in this file still apply.
The user may need to identify or configure a mutation testing tool manually.

## Interpreting Results: The Decision Tree

When reviewing mutation testing output, classify each survived mutant:

### 1. Valuable Survivor → Write a Better Test

The mutant exposes a genuine gap. Examples:
- A boundary mutation (`>=` → `>`) survives because no test checks the exact boundary
- A return value mutation (`return result` → `return null`) survives because no test
  asserts on the return value
- A void call removal survives because no test verifies the side effect

**Action**: Write a targeted test that specifically covers the mutated behavior.
When writing this test, name it descriptively (e.g., `test_boundary_at_exactly_18`
not `test_mutation_1`) and add a comment explaining what gap it fills.

**Technique for comparison operator survivors (ROR)**: When `<`, `<=`, `==`, `>`,
or `>=` mutations survive, the fix is systematic boundary testing:
- Test a value **below** the threshold (should/shouldn't enter the branch)
- Test a value **at exactly** the threshold (the boundary itself)
- Test a value **above** the threshold
- Test **extreme values** (negative, zero, MAX) to distinguish `<` from `==` and `>`

If boundary tests are awkward to write, the code representation may need restructuring.
A range comparison like `x < 1` that really means "x is zero" should be rewritten as
`x == 0` — exact comparisons are inherently more testable. Also consider testing internal
functions directly with boundary inputs rather than only through the public API.

### 2. Equivalent Mutant → Exclude or Accept (last resort)

The mutation doesn't change observable behavior. Examples:
- Replacing `x * 1` with `x * -1` when `x` is always 0
- Negating a condition in dead code
- Changing iteration order when order doesn't matter

**Action**: Exclude via tool configuration or accept the score impact. Do not write
meaningless tests just to kill equivalent mutants.

**Important**: "equivalent mutant" should be the **last conclusion**, not the first.
Before accepting equivalence, work through this progression:
1. Is it actually a **test gap**? Most survivors mean missing coverage.
2. Does it expose a **design smell** at a parse/serialization boundary? Survivors
   in serde defaults, tiny helper functions, or duplicated validation often mean
   the boundary should be refactored so the behavior becomes explicit and testable.
3. Is it **overlapping validation**? Two checks catching the same input for different
   reasons — a parse-don't-validate smell.
4. Only then conclude it is genuinely equivalent.

Treating survivors as equivalent too quickly is the most common agent mistake in
mutation testing interpretation. It short-circuits the learning that mutation
testing is designed to produce.

### 3. Noisy Survivor → Exclude via Configuration

The mutant is in boilerplate that isn't worth testing exhaustively. Examples:
- Getters/setters, `toString()`, `hashCode()`, `equals()` (Java)
- Logging statements
- Generated code (DTOs, protobuf stubs)
- Debug/trace instrumentation

**Action**: Add exclusion rules to the mutation tool's configuration. Every framework
supports method-level, file-level, or pattern-based exclusions.

### 4. Design-Revealing Survivor → Refactor the Code

Rare but valuable. The mutant survives because the code's design makes the behavior
genuinely ambiguous or untestable. Signals include:
- Multiple semantic meanings overloaded onto a single return type
- Side effects that are invisible to callers
- State changes that bypass the public API
- Functions that do too many things to test atomically

**Action**: Refactor the production code to make the distinct behaviors separately
observable, then write tests for each.

## Setting Thresholds

First-time mutation scores of 30–50% are normal even with high line coverage.
Do not panic. Adopt a progressive approach:

- **Starting out**: Set a non-breaking threshold at your current score minus 5 points.
  The goal is to prevent regression, not to immediately achieve perfection.
- **Established**: Target 60–70% as a warning threshold, with a hard break at 50%.
- **Mature/critical code**: Target 80%+ for production-critical modules.
  100% is neither achievable nor desirable due to equivalent mutants.

In CI, configure the tool's threshold to fail the build only when the score drops
below the ratchet. Raise the ratchet by 5 points each quarter.

## Performance: Making Mutation Testing Practical

Mutation testing multiplies test suite runtime by the number of mutants. Five strategies
make this tractable:

1. **Incremental analysis**: Only re-test mutants where either the code or its killing
   test has changed. All major frameworks support this (see reference files).

2. **Changed-code-only**: Restrict mutations to files modified in the current PR/commit.
   This is the recommended approach for CI on pull requests.

3. **Parallelism**: Distribute mutants across CPU cores or CI machines. Every framework
   supports parallel execution; some support cross-machine sharding.

4. **Coverage-guided filtering**: Only generate mutants on lines that have test coverage.
   Mutating uncovered lines is pointless — you already know there's no test.

5. **Scope restriction**: Exclude non-critical code (DTOs, generated code, logging),
   use reduced operator sets for initial runs, and set appropriate timeouts.

**Recommended CI pattern**:
- Full mutation run: nightly or weekly (scheduled)
- Incremental/diff-based run: on every PR (fast, focused)
- Cache mutation history between runs to preserve incremental benefits

## Workflow: When the User Asks You to Do Mutation Testing

Follow this sequence:

### Step 1: Identify the Framework
Determine the project language and check if a mutation testing tool is already configured.
Look for configuration files: `pom.xml` or `build.gradle` (PIT plugin), `.cargo/mutants.toml`,
`stryker.config.mjs` or `stryker-config.json`, `setup.cfg` or `pyproject.toml` (mutmut).
Read the appropriate reference file.

### Step 2: Verify Baseline Tests Pass
Before mutation testing, confirm the existing test suite passes cleanly. Mutation testing
assumes a green test suite — if tests are already failing, fix those first.

### Step 3: Run Mutation Testing
Start with a focused scope — a single module or the files changed in a PR. Running
mutation testing on an entire large codebase the first time will be slow and overwhelming.

### Step 4: Triage Survivors
Review each survived mutant using the decision tree above. Categorize before acting.
Do NOT reflexively modify production code.

### Step 5: Improve Tests (Not Code)
For each valuable survivor, write a targeted test. Be specific about what the test
covers and why it was missing.

### Step 6: Re-run and Verify
After improving tests, re-run mutation testing to confirm the new tests kill the
previously surviving mutants. Update thresholds if appropriate.

## Common Agent Mistakes to Avoid

1. **Modifying production code to make mutants "pass"**: The production code was correct.
   The mutation tool broke it on purpose. Improve the tests instead.

2. **Treating mutation score like coverage**: Coverage says "this line ran." Mutation
   score says "changing this line was detected." They measure different things.
   A module can have 100% coverage and 30% mutation score.

3. **Trying to kill every mutant**: Some mutants are equivalent (unkillable) and some
   are in code not worth testing exhaustively. Exclude them. A pragmatic 80% score
   on important code beats a forced 95% achieved by writing meaningless tests.

4. **Running full mutation suites on every commit**: This is too slow for most projects.
   Use incremental/diff-based analysis for PRs, full runs on a schedule.

5. **Ignoring timeout mutants**: Timeouts count as killed. If you see many timeouts,
   consider increasing the timeout multiplier — some tests are legitimately slow
   when code is mutated (e.g., a loop bound change causing 10x more iterations).

6. **Conflating mutation testing with fuzz testing**: Fuzz testing generates random
   *inputs*. Mutation testing generates deliberate *code changes*. They are
   complementary but fundamentally different techniques.

## Combining with Other Testing Techniques

Mutation testing is most powerful when combined with:

- **Property-based testing**: PBT explores diverse inputs; mutation testing verifies
  assertions are strong enough to catch faults. Together they cover both input space
  and fault space.
- **Code coverage**: Use coverage as a pre-filter (only mutate covered lines) and as
  a complementary metric. Coverage finds untested code; mutation testing finds
  undertested code.
- **Contract/invariant testing**: Design-by-contract assertions create strong
  specifications that naturally kill many mutants.
