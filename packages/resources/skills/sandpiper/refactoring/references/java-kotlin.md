# Java / Kotlin Refactoring Reference

## Recommended Tool Stack

| Tool | Purpose | Speed |
|------|---------|-------|
| **PMD** | 400+ rules, CC, CPD (duplication) | Fast (CLI, no server) |
| **detekt** (Kotlin) | Complexity, smells, style | Fast |
| **lizard** | Per-function CC (cross-language) | Fast |
| **jscpd** | Clone detection (broader than CPD) | Fast |
| **Spotless** | Formatting (with Palantir or Google style) | Fast |

PMD is the primary tool for Java — it runs as a standalone CLI with no server and
provides both rule-based analysis and CPD (Copy/Paste Detector). For Kotlin, detekt
is the equivalent. Both produce machine-parseable output.

## Tool Commands

### PMD — Primary linter for Java

```bash
# Run specific rulesets with JSON output
pmd check -d <path> -R rulesets/java/design.xml,rulesets/java/bestpractices.xml -f json

# Run with complexity and design rules
pmd check -d <path> -R category/java/design.xml -f json

# CPD: copy-paste detection (supports 25+ languages)
pmd cpd --dir <path> --minimum-tokens 50 --format json --language java

# CPD for Kotlin
pmd cpd --dir <path> --minimum-tokens 50 --format json --language kotlin

# Run specific rules only
pmd check -d <path> -R category/java/design.xml/CyclomaticComplexity,category/java/design.xml/CognitiveComplexity -f json
```

Key PMD rules for refactoring:
- `CyclomaticComplexity`: Reports methods above threshold (default 10)
- `CognitiveComplexity`: SonarSource-style cognitive complexity
- `NPathComplexity`: Number of acyclic execution paths
- `ExcessiveMethodLength`: Method too long
- `ExcessiveClassLength`: Class too long
- `ExcessiveParameterList`: Too many parameters
- `TooManyMethods`: Class with too many methods
- `CouplingBetweenObjects`: High fan-out coupling
- `GodClass`: Class with too many responsibilities
- `DataClass`: Class with only getters/setters (likely should be a record)

Configure via ruleset XML:
```xml
<?xml version="1.0"?>
<ruleset name="Refactoring rules">
  <rule ref="category/java/design.xml/CyclomaticComplexity">
    <properties>
      <property name="methodReportLevel" value="15" />
    </properties>
  </rule>
  <rule ref="category/java/design.xml/CognitiveComplexity">
    <properties>
      <property name="reportLevel" value="15" />
    </properties>
  </rule>
  <rule ref="category/java/design.xml/ExcessiveMethodLength">
    <properties>
      <property name="minimum" value="60" />
    </properties>
  </rule>
  <rule ref="category/java/design.xml/ExcessiveParameterList">
    <properties>
      <property name="minimum" value="5" />
    </properties>
  </rule>
  <rule ref="category/java/design.xml/GodClass" />
  <rule ref="category/java/design.xml/DataClass" />
  <rule ref="category/java/design.xml/CouplingBetweenObjects">
    <properties>
      <property name="threshold" value="12" />
    </properties>
  </rule>
</ruleset>
```

### detekt — Primary linter for Kotlin

```bash
# Run with JSON output
detekt --input <path> --report json:detekt-report.json

# Run with specific rule sets
detekt --input <path> --config detekt-config.yml --report json:detekt-report.json

# Auto-correct fixable issues
detekt --input <path> --auto-correct
```

Configure in `detekt-config.yml`:
```yaml
complexity:
  CyclomaticComplexMethod:
    active: true
    threshold: 15
  CognitiveComplexMethod:
    active: true
    threshold: 15
  LongMethod:
    active: true
    threshold: 60
  LongParameterList:
    active: true
    functionThreshold: 5
    constructorThreshold: 8
  NestedBlockDepth:
    active: true
    threshold: 4
  TooManyFunctions:
    active: true
    thresholdInClasses: 15
    thresholdInFiles: 20
```

## Language-Specific Refactoring Patterns

### Replace boilerplate classes with records (Java 16+) / data classes (Kotlin)

```java
// Before: 50 lines of boilerplate
public class Point {
    private final double x;
    private final double y;
    public Point(double x, double y) { this.x = x; this.y = y; }
    public double getX() { return x; }
    public double getY() { return y; }
    @Override public boolean equals(Object o) { /* ... */ }
    @Override public int hashCode() { /* ... */ }
    @Override public String toString() { /* ... */ }
}

// After: 1 line
public record Point(double x, double y) {}
```

```kotlin
// Kotlin equivalent
data class Point(val x: Double, val y: Double)
```

### Replace complex builders with Kotlin DSLs

```kotlin
// Before: Java-style builder
val config = Config.Builder()
    .setHost("localhost")
    .setPort(8080)
    .setRetries(3)
    .setTimeout(Duration.ofSeconds(30))
    .build()

// After: Kotlin DSL
val config = config {
    host = "localhost"
    port = 8080
    retries = 3
    timeout = 30.seconds
}
```

### Replace inheritance with sealed interfaces (Java 17+ / Kotlin)

```java
// Before: open class hierarchy
abstract class Shape {
    abstract double area();
}
class Circle extends Shape { /* ... */ }
class Rectangle extends Shape { /* ... */ }
// Anyone can extend Shape — hard to reason about exhaustively

// After: sealed interface
sealed interface Shape permits Circle, Rectangle {
    double area();
}
record Circle(double radius) implements Shape {
    public double area() { return Math.PI * radius * radius; }
}
record Rectangle(double width, double height) implements Shape {
    public double area() { return width * height; }
}
```

```kotlin
sealed interface Shape {
    data class Circle(val radius: Double) : Shape
    data class Rectangle(val width: Double, val height: Double) : Shape
}

fun Shape.area(): Double = when (this) {
    is Shape.Circle -> Math.PI * radius * radius
    is Shape.Rectangle -> width * height
    // exhaustive — compiler error if a case is missing
}
```

### Replace Optional chains with Kotlin null safety

```kotlin
// Before: Java-style Optional chaining in Kotlin
fun getCity(user: User?): String {
    return Optional.ofNullable(user)
        .map { it.address }
        .map { it.city }
        .orElse("Unknown")
}

// After: idiomatic Kotlin
fun getCity(user: User?): String =
    user?.address?.city ?: "Unknown"
```

### Extract strategy from switch/when on type

```java
// Before: type-checking switch
double calculatePay(Employee emp) {
    return switch (emp.getType()) {
        case HOURLY -> emp.getHours() * emp.getRate();
        case SALARIED -> emp.getSalary() / 24;
        case COMMISSION -> emp.getSales() * emp.getCommissionRate() + emp.getBasePay();
        default -> throw new IllegalArgumentException();
    };
}

// After: polymorphism (when the logic in each branch is complex)
sealed interface PayStrategy permits HourlyPay, SalariedPay, CommissionPay {
    double calculate(Employee emp);
}
```

## Java/Kotlin-Specific Anti-Patterns

- **Don't create single-implementation interfaces.** `UserService` implementing
  `IUserService` with no other implementations is pointless abstraction. Extract
  interfaces when you genuinely need polymorphism or testability.
- **Don't use `static` utility classes with all static methods.** In Kotlin, use
  top-level functions. In Java, consider if the methods belong on an existing type.
- **Don't create deep package hierarchies.** `com.company.app.module.sub.impl.internal`
  is hard to navigate. Keep packages 2–3 levels deep.
- **Don't catch `Exception` or `Throwable` broadly.** Catch specific exception types.
  Broad catches hide bugs.
- **Don't use `var` (Java) to obscure types that aren't obvious.** `var x = getResult()`
  is fine when the type is clear from context; `var x = process(transform(data))` is not.
- **Don't annotate everything with `@Nullable` / `@NotNull` in Kotlin code.** Use
  Kotlin's built-in null safety (`?`) instead of Java-style annotation checking.
- **Don't use Spring/framework annotations to solve design problems.** `@Autowired`
  on 15 fields is a sign the class has too many responsibilities, not that you need
  more DI configuration.
