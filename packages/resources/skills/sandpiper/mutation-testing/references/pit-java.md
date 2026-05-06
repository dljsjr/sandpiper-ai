# PIT (pitest) — Java / JVM Mutation Testing

PIT operates on **compiled bytecode** via the ASM library, not source code. Mutations are
held in memory and never written to disk. This makes it significantly faster than
source-level mutation tools.

## How PIT Works Internally

1. Runs line-level coverage analysis to map tests → lines
2. For each mutant, runs only the tests that cover the mutated line
3. Prioritizes tests by execution speed for fast fail detection
4. Classifies each mutant as killed, survived, timed out, or no coverage

## Installation

### Maven

Add to `pom.xml` in `<build><plugins>`:

```xml
<plugin>
    <groupId>org.pitest</groupId>
    <artifactId>pitest-maven</artifactId>
    <version>1.17.4</version> <!-- check for latest -->
    <dependencies>
        <!-- Required for JUnit 5 -->
        <dependency>
            <groupId>org.pitest</groupId>
            <artifactId>pitest-junit5-plugin</artifactId>
            <version>1.2.1</version>
        </dependency>
    </dependencies>
    <configuration>
        <targetClasses>
            <param>com.example.myproject.*</param>
        </targetClasses>
        <targetTests>
            <param>com.example.myproject.*</param>
        </targetTests>
        <mutators>
            <mutator>DEFAULTS</mutator>
        </mutators>
        <threads>4</threads>
    </configuration>
</plugin>
```

Run with: `mvn org.pitest:pitest-maven:mutationCoverage`
For changed-files-only: `mvn org.pitest:pitest-maven:scmMutationCoverage`

### Gradle

In `build.gradle`:

```groovy
plugins {
    id 'info.solidsoft.pitest' version '1.15.0'
}

pitest {
    targetClasses = ['com.example.myproject.*']
    targetTests = ['com.example.myproject.*']
    mutators = ['DEFAULTS']
    threads = 4
    junit5PluginVersion = '1.2.1'
}
```

Run with: `./gradlew pitest`

## Mutator Groups

PIT organizes operators into escalating groups:

**DEFAULTS** (recommended starting point):
- Conditionals boundary (`<` → `<=`, `>=` → `>`)
- Increments (`i++` → `i--`)
- Invert negatives (remove unary `-`)
- Math (`+`↔`-`, `*`↔`/`, etc.)
- Negate conditionals (`==` → `!=`, `<` → `>=`)
- Void method calls (remove void method invocations)
- Empty returns (`return x` → `return ""` / `Collections.emptyList()` / etc.)
- False returns (`return x` → `return false`)
- True returns (`return x` → `return true`)
- Null returns (`return x` → `return null`)
- Primitive returns (`return x` → `return 0`)

**STRONGER** (adds to DEFAULTS):
- Remove conditionals (replace `if(cond)` with `if(true)` / `if(false)`)
- Experimental switch mutations

**ALL** (not recommended for production — includes unstable research operators)

Use `DEFAULTS` for everyday use. Move to `STRONGER` once your score plateaus.

## Key Configuration Parameters

```xml
<configuration>
    <!-- Classes to mutate (glob patterns) -->
    <targetClasses><param>com.example.*</param></targetClasses>

    <!-- Tests to run (glob patterns) -->
    <targetTests><param>com.example.*Test</param></targetTests>

    <!-- Mutator group -->
    <mutators><mutator>DEFAULTS</mutator></mutators>

    <!-- Parallel threads -->
    <threads>4</threads>

    <!-- Fail build if mutation score below this (0-100) -->
    <mutationThreshold>60</mutationThreshold>

    <!-- Timeout: factor × normal test time + constant -->
    <timeoutFactor>1.25</timeoutFactor>
    <timeoutConstant>3000</timeoutConstant>

    <!-- Methods to skip (regex patterns) -->
    <excludedMethods>
        <param>hashCode</param>
        <param>equals</param>
        <param>toString</param>
    </excludedMethods>

    <!-- Classes to skip -->
    <excludedClasses>
        <param>com.example.generated.*</param>
        <param>com.example.dto.*</param>
    </excludedClasses>

    <!-- Incremental analysis (dramatically faster repeat runs) -->
    <historyInputFile>target/pit-history.bin</historyInputFile>
    <historyOutputFile>target/pit-history.bin</historyOutputFile>
</configuration>
```

## Incremental Analysis

PIT tracks bytecode hashes and test results between runs. When neither the mutated class
nor its killing test has changed, PIT reuses the previous result. This can make repeat
runs 10–50× faster.

Enable with `withHistory` flag (Maven) or the `historyInputFile`/`historyOutputFile`
parameters. In CI, cache `target/pit-history.bin` between runs.

The `scmMutationCoverage` goal restricts mutations to files changed according to your
SCM (git), combining well with incremental analysis for PR pipelines.

## Reading PIT Reports

PIT generates HTML reports in `target/pit-reports/`. Source files are color-coded:

- **Dark green line**: All mutations on this line were killed — tests are strong here
- **Dark pink/red line**: Line is covered by tests but mutations survived — action needed
- **Light pink line**: Line has no test coverage at all
- **Light green line**: Line was covered and had some mutations killed

Focus on **dark pink lines** — these are the highest-value findings. The tests reach
the code but don't assert on the behavior strongly enough.

## CI Integration

```yaml
# GitHub Actions example
- name: Run PIT mutation testing
  run: mvn org.pitest:pitest-maven:mutationCoverage
  env:
    MAVEN_OPTS: "-Xmx2g"

# Cache history for incremental analysis
- uses: actions/cache@v4
  with:
    path: target/pit-history.bin
    key: pit-history-${{ github.ref }}
    restore-keys: pit-history-
```

## Common Exclusion Patterns

```xml
<excludedMethods>
    <param>hashCode</param>
    <param>equals</param>
    <param>toString</param>
    <param>compareTo</param>
    <param>get*</param>    <!-- simple getters -->
    <param>set*</param>    <!-- simple setters -->
    <param>is*</param>     <!-- boolean getters -->
</excludedMethods>
```

For Lombok-generated code, exclude the classes or use `@Generated` annotations
(PIT skips methods annotated with any `@Generated` annotation by default).

## Troubleshooting

- **"No mutations found"**: Check `targetClasses` glob matches your package structure
- **Very slow**: Reduce scope, add `threads`, enable incremental analysis, exclude
  test-heavy modules initially
- **JUnit 5 tests not found**: Ensure `pitest-junit5-plugin` dependency is present
- **OutOfMemoryError**: Increase heap with `jvmArgs` configuration parameter
- **Flaky results**: Investigate non-deterministic tests; PIT amplifies flakiness
