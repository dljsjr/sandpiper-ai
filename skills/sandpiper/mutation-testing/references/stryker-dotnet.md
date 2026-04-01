# Stryker.NET — C# / .NET Mutation Testing

Stryker.NET provides mutation testing for .NET Core and .NET Framework projects.
It works with MSTest, NUnit, and xUnit test frameworks.

## Installation and Basic Usage

```bash
# Install as global tool
dotnet tool install -g dotnet-stryker

# Run from test project directory
dotnet stryker

# Run from solution root (specify test project)
dotnet stryker --project MyApp.Tests.csproj

# Run with solution file
dotnet stryker --solution MyApp.sln
```

## Configuration

Config file: `stryker-config.json` in project root.

```json
{
  "stryker-config": {
    "project": "MyApp.csproj",
    "test-projects": ["MyApp.Tests.csproj"],
    "mutation-level": "Standard",
    "thresholds": {
      "high": 80,
      "low": 60,
      "break": 50
    },
    "reporters": ["html", "progress", "cleartext"],
    "concurrency": 4,
    "since": false,
    "with-baseline": false,
    "ignore-methods": [
      "ToString",
      "GetHashCode",
      "Equals",
      "*Exception.ctor"
    ],
    "ignore-mutations": [
      "string"
    ],
    "mutate": [
      "!**/Migrations/**",
      "!**/obj/**",
      "!**/*.Designer.cs"
    ]
  }
}
```

## Mutation Levels

Stryker.NET uses a progressive level system:

**Basic**: Arithmetic, equality, boolean, logical operators only.
**Standard** (default): Adds string mutations, LINQ method mutations, assignment
mutations, unary operator mutations, update operator mutations, checked/unchecked
statement removal.
**Advanced**: Adds initializer mutations, regex mutations.
**Complete**: All available operators.

Start with Standard. Move to Advanced once your score stabilizes.

## .NET-Specific Mutation Operators

Beyond the universal operators, Stryker.NET adds:

**LINQ method mutations**:
- `First()`↔`Last()`, `FirstOrDefault()`↔`LastOrDefault()`
- `All()`↔`Any()`
- `Skip()`↔`Take()`
- `Min()`↔`Max()`, `MinBy()`↔`MaxBy()`
- `Order()`↔`OrderDescending()`
- `Sum()`↔`Count()`
- `ThenBy()`↔`ThenByDescending()`
- `SkipWhile()`↔`TakeWhile()`
- `SkipLast()`↔`TakeLast()`
- `Distinct()`→ removed, `Reverse()`→ removed
- `AsEnumerable()`→ removed, `OrderBy()`→ removed

**Null-coalescing**: `a ?? b`→`a`, `a ?? b`→`b`
**Checked statement removal**: Remove `checked { }` blocks
**String mutations**: `string.Empty`→`"Stryker was here!"`

## Incremental / Baseline Mode

**`--since`**: Uses git diff to only mutate changed files (fast for PRs).

```bash
# Test only code changed since main
dotnet stryker --since:main

# Equivalent in config
{ "since": { "enabled": true, "target": "main" } }
```

**`--with-baseline`**: Saves and reloads full mutation reports across runs,
comparing mutant fingerprints to skip unchanged ones.

```bash
dotnet stryker --with-baseline:DashboardStorage

# Storage providers: Disk, Dashboard, AzureFileStorage
# For Disk:
dotnet stryker --with-baseline:Disk --baseline-path ./stryker-baseline
```

## Inline Exclusions

```csharp
// Stryker disable all : Generated boilerplate
public override string ToString() => $"{Name}: {Value}";
// Stryker restore all

// Stryker disable once Arithmetic : Intentional wrapping behavior
var wrapped = (index + 1) % length;
```

## CI Integration

```yaml
# GitHub Actions
- name: Install Stryker
  run: dotnet tool install -g dotnet-stryker

- name: Run Stryker
  run: dotnet stryker --since:origin/main --reporters "['html', 'progress']"
  working-directory: ./tests/MyApp.Tests

- name: Upload mutation report
  uses: actions/upload-artifact@v4
  with:
    name: stryker-report
    path: ./tests/MyApp.Tests/StrykerOutput/**/reports/
```

## Troubleshooting

- **"Could not find test project"**: Run from the test project directory or specify
  `--project` and `--test-projects` explicitly
- **Multi-target frameworks**: Stryker.NET picks the first target; use
  `--target-framework` to specify (e.g., `net8.0`)
- **Integration tests running**: Use `--test-projects` to target only unit test projects
- **Slow LINQ mutations**: If LINQ mutations dominate runtime, add `"linq"` to
  `ignore-mutations` initially and re-enable once unit test score improves
