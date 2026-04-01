# Stryker4s — Scala Mutation Testing

Stryker4s uses a unique **mutation switching** technique: all mutants are compiled into
the code simultaneously via Scala pattern matches, then activated one at a time via
environment variable. This means the (slow) Scala compilation step happens only once,
making Stryker4s much faster than a naive compile-per-mutant approach.

## Installation

### sbt Plugin

In `project/plugins.sbt`:

```scala
addSbtPlugin("io.stryker-mutator" % "sbt-stryker4s" % "0.16.1") // check for latest
```

Run with: `sbt stryker`

### Maven Plugin

```xml
<plugin>
    <groupId>io.stryker-mutator</groupId>
    <artifactId>stryker4s-maven-plugin</artifactId>
    <version>0.16.1</version>
</plugin>
```

Run with: `mvn stryker4s:run`

## Configuration

Config file: `stryker4s.conf` (HOCON format) in project root.

```hocon
stryker4s {
  # Files to mutate (glob patterns)
  mutate = ["**/main/scala/**/*.scala"]

  # Files to exclude
  excluded-mutations = ["StringLiteral"]

  # Base directory
  base-dir = "."

  # Test runner
  test-runner {
    command = "sbt"
    args = "test"
  }

  # Thresholds
  thresholds {
    high = 80
    low = 60
    break = 0
  }

  # Reporters
  reporters = ["console", "html"]

  # Dashboard
  dashboard {
    base-url = "https://dashboard.stryker-mutator.io"
    report-type = "full"
    project = "github.com/your-org/your-repo"
    version = "main"
  }
}
```

## Scala-Specific Mutation Operators

Beyond standard operators, Stryker4s adds Scala-specific mutations:

**Collection method mutations**:
- `filter`↔`filterNot`
- `exists`↔`forall`
- `take`↔`drop`
- `isEmpty`↔`nonEmpty`
- `indexOf`↔`lastIndexOf`
- `max`↔`min`, `maxBy`↔`minBy`

**String mutations**: `"foo"`→`""`, `""`→`"Stryker was here!"`
**Method expression swaps**: `a.isInstanceOf[T]`→`!a.isInstanceOf[T]`
**Regex removal**: Remove regex patterns
**Equality**: `==`↔`!=`, `eq`↔`ne`

## Suppressing Individual Mutations

```scala
@SuppressWarnings(Array("stryker4s.mutation.BooleanLiteral"))
def alwaysTrue: Boolean = true

// Multiple operators
@SuppressWarnings(Array(
  "stryker4s.mutation.EqualityOperator",
  "stryker4s.mutation.LogicalOperator"
))
def complexCondition(a: Int, b: Int): Boolean = a == b && a > 0
```

## How Mutation Switching Works

Stryker4s identifies all possible mutations at compile time and rewrites the source to
include all variants, guarded by an environment variable check:

```scala
// Original
def isAdult(age: Int): Boolean = age >= 18

// Rewritten (conceptual — actual implementation is more complex)
def isAdult(age: Int): Boolean = {
  sys.env.get("ACTIVE_MUTATION") match {
    case Some("0") => age > 18   // boundary mutation
    case Some("1") => age < 18   // negation
    case Some("2") => true       // true literal
    case Some("3") => false      // false literal
    case _         => age >= 18  // original
  }
}
```

This compiles once and each test run just sets a different environment variable —
critical for Scala where compilation routinely takes minutes.

## CI Integration

```yaml
# GitHub Actions
- name: Run Stryker4s
  run: sbt stryker
  env:
    STRYKER_DASHBOARD_API_KEY: ${{ secrets.STRYKER_KEY }}
```

## Troubleshooting

- **Very long initial compile**: This is expected — Stryker4s compiles all mutants at once.
  Subsequent test runs are fast because only the test suite re-executes.
- **sbt memory issues**: Increase sbt heap with `SBT_OPTS="-Xmx4g"`
- **Cross-compiled projects**: Stryker4s may need explicit Scala version configuration
- **Macro-heavy code**: Macros can interfere with mutation switching; exclude macro
  modules if you see compilation errors
