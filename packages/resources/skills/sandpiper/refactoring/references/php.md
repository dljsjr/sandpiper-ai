# PHP Refactoring Reference

## Recommended Tool Stack

| Tool | Purpose | Speed |
|------|---------|-------|
| **PHPStan** | Static analysis, type checking, bug finding | Fast |
| **PHP-CS-Fixer** | Code style fixing (opinionated, auto-fixes) | Fast |
| **PhpMetrics** | CC, Halstead, MI, OO metrics, coupling, PageRank | Moderate |
| **lizard** | Per-function CC (cross-language) | Fast |
| **jscpd** | Clone detection | Fast |
| **PHPCPD** | PHP-specific copy-paste detection | Fast |
| **deptrac** | Dependency/architecture rule enforcement | Fast |

PHPStan is the primary analysis tool — it catches type errors, dead code, and logic
bugs with configurable strictness levels (0–9). PHP-CS-Fixer handles formatting and
style automatically. PhpMetrics provides the richest metrics output, including
per-class coupling, PageRank-based importance scoring, and full Halstead/MI analysis
with HTML and JSON reports.

## Tool Commands

### PHPStan — Primary static analyzer

```bash
# Run at a specific level (0 = loose, 9 = strict)
phpstan analyse --level 5 --error-format json <path>

# Run at max level
phpstan analyse --level max --error-format json <path>

# Run on specific files
phpstan analyse --level 5 --error-format json src/Service/UserService.php

# With a config file
phpstan analyse --configuration phpstan.neon --error-format json
```

Key PHPStan levels for refactoring triage:
- Level 0–2: Basic errors (unknown classes, functions, wrong argument counts)
- Level 3–4: Return types, basic type checking
- Level 5: Argument types, property types
- Level 6–7: Missing typehints, strict union handling
- Level 8–9: No mixed types, strictest checking

If a codebase is at level 0, getting to level 5 is a meaningful refactoring goal.
Each level increase catches real bugs.

### PHP-CS-Fixer — Opinionated style fixer

```bash
# Dry-run: show what would change
php-cs-fixer fix --dry-run --diff --format json <path>

# Fix with PSR-12 rules
php-cs-fixer fix --rules=@PSR12 <path>

# Fix with a specific rule set
php-cs-fixer fix --rules=@Symfony <path>

# Fix specific files
php-cs-fixer fix src/Controller/ApiController.php
```

Use PHP-CS-Fixer for automated formatting cleanup. It handles whitespace, brace
placement, import ordering, short array syntax, and dozens of other style rules.
Run it before manual refactoring to reduce noise.

### PhpMetrics — Detailed metrics analysis

```bash
# Generate JSON report
phpmetrics --report-json=metrics.json <path>

# Generate HTML report (useful for visual exploration)
phpmetrics --report-html=metrics-report <path>

# Analyze specific directories
phpmetrics --report-json=metrics.json src/
```

PhpMetrics output includes per-class: cyclomatic complexity, weighted method count,
lack of cohesion (LCOM), afferent/efferent coupling, instability, abstractness,
Halstead metrics, Maintainability Index, and PageRank (importance based on dependency
graph). The JSON output is machine-parseable for agent consumption.

### PHPCPD — PHP copy-paste detection

```bash
# Detect duplicates
phpcpd <path>

# With minimum lines threshold
phpcpd --min-lines 5 --min-tokens 50 <path>

# Exclude directories
phpcpd --exclude vendor --exclude tests <path>
```

### deptrac — Dependency architecture rules

```bash
# Check dependency rules
deptrac analyse --formatter json

# Visualize dependency graph
deptrac analyse --formatter graphviz-image --output deps.png
```

deptrac enforces architectural boundaries (e.g., "controllers may not depend on
repositories directly"). Useful for preventing architecture drift during refactoring.
Requires a `deptrac.yaml` config defining layers and rules.

## Language-Specific Refactoring Patterns

### Replace type-unsafe patterns with strict typing

```php
// Before: no type safety
function calculateDiscount($price, $percentage) {
    return $price * ($percentage / 100);
}

// After: strict types with PHP 8+ features
declare(strict_types=1);

function calculateDiscount(float $price, float $percentage): float {
    if ($price < 0 || $percentage < 0 || $percentage > 100) {
        throw new \InvalidArgumentException('Invalid price or percentage');
    }
    return $price * ($percentage / 100);
}
```

Adding `declare(strict_types=1)` at the top of every PHP file is one of the
highest-impact refactorings. It turns silent type coercion into TypeErrors.

### Replace conditionals with match expressions (PHP 8.0+)

```php
// Before: verbose switch
function getStatusLabel(string $status): string {
    switch ($status) {
        case 'active':
            return 'Active';
        case 'inactive':
            return 'Inactive';
        case 'pending':
            return 'Pending Review';
        case 'archived':
            return 'Archived';
        default:
            throw new \InvalidArgumentException("Unknown status: $status");
    }
}

// After: match expression (exhaustive, returns a value, strict comparison)
function getStatusLabel(string $status): string {
    return match ($status) {
        'active' => 'Active',
        'inactive' => 'Inactive',
        'pending' => 'Pending Review',
        'archived' => 'Archived',
        default => throw new \InvalidArgumentException("Unknown status: $status"),
    };
}
```

### Replace array shapes with readonly classes / DTOs

```php
// Before: untyped associative arrays passed everywhere
function createUser(array $data): array {
    return [
        'id' => generateId(),
        'name' => $data['name'],      // no guarantee 'name' exists
        'email' => $data['email'],    // no type checking
        'created' => time(),
    ];
}

// After: typed DTO with readonly properties (PHP 8.2+)
readonly class CreateUserRequest {
    public function __construct(
        public string $name,
        public string $email,
    ) {}
}

readonly class User {
    public function __construct(
        public string $id,
        public string $name,
        public string $email,
        public int $createdAt,
    ) {}
}

function createUser(CreateUserRequest $request): User {
    return new User(
        id: generateId(),
        name: $request->name,
        email: $request->email,
        createdAt: time(),
    );
}
```

### Extract service classes from fat controllers

```php
// Before: controller doing everything
class OrderController {
    public function store(Request $request): Response {
        $data = $request->validate([...]);
        $order = new Order($data);
        $order->save();
        $payment = PaymentGateway::charge($order->total);
        if (!$payment->success) {
            $order->delete();
            return response()->json(['error' => 'Payment failed'], 422);
        }
        $order->update(['payment_id' => $payment->id]);
        Mail::send(new OrderConfirmation($order));
        event(new OrderCreated($order));
        return response()->json($order, 201);
    }
}

// After: controller delegates to service
class OrderController {
    public function __construct(
        private readonly OrderService $orderService,
    ) {}

    public function store(Request $request): Response {
        $data = $request->validate([...]);
        $order = $this->orderService->create($data);
        return response()->json($order, 201);
    }
}
```

### Replace inheritance with composition via interfaces

```php
// Before: deep inheritance
abstract class BaseRepository {
    abstract protected function getTable(): string;
    public function find(int $id): ?array { /* ... */ }
    public function findAll(): array { /* ... */ }
    public function save(array $data): int { /* ... */ }
    public function delete(int $id): bool { /* ... */ }
}

class UserRepository extends BaseRepository {
    protected function getTable(): string { return 'users'; }
    // + custom methods
}

// After: interface + composition
interface UserRepositoryInterface {
    public function find(int $id): ?User;
    public function save(User $user): void;
}

class DatabaseUserRepository implements UserRepositoryInterface {
    public function __construct(
        private readonly PDO $db,
    ) {}

    public function find(int $id): ?User { /* ... */ }
    public function save(User $user): void { /* ... */ }
}
```

### Replace magic methods with explicit interfaces

```php
// Before: __get/__set magic (no IDE support, no static analysis)
class Config {
    private array $data = [];

    public function __get(string $name): mixed {
        return $this->data[$name] ?? null;
    }

    public function __set(string $name, mixed $value): void {
        $this->data[$name] = $value;
    }
}

// After: explicit typed methods
class Config {
    public function __construct(
        private readonly string $host,
        private readonly int $port,
        private readonly string $database,
    ) {}

    public function getHost(): string { return $this->host; }
    public function getPort(): int { return $this->port; }
    public function getDatabase(): string { return $this->database; }
}
```

## PHP-Specific Anti-Patterns

- **Don't use `@` error suppression.** It hides errors and is slow. Handle errors
  explicitly or configure error reporting properly.
- **Don't use global state (`global $var`, `$_GLOBALS`).** Pass dependencies
  explicitly via constructor injection.
- **Don't use `extract()`.** It creates variables from array keys, making code
  impossible to statically analyze. Destructure explicitly.
- **Don't use dynamic property creation** (deprecated in 8.2, removed in 9.0).
  Declare all properties explicitly.
- **Don't create God classes.** A 2000-line service class with 30 methods is doing
  too much. Split by domain responsibility.
- **Don't put logic in constructors.** Constructors should assign dependencies.
  Use factory methods or service methods for logic.
- **Don't use array shapes for domain objects.** PHP has had typed classes since 7.4,
  readonly properties since 8.1, and readonly classes since 8.2. Use them.
- **Don't catch `\Exception` broadly.** Catch specific exception types. If you
  catch `\Exception`, at minimum re-throw unexpected ones.
- **Don't use `die()` or `exit()` in library/application code.** They terminate
  the process. Throw exceptions instead and let the caller decide.
