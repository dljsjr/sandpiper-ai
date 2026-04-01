# Ruby Refactoring Reference

## Recommended Tool Stack

| Tool | Purpose | Speed |
|------|---------|-------|
| **RuboCop** | Linting, complexity, style, metrics | Fast |
| **flog** | ABC complexity / "pain" score | Fast |
| **flay** | Structural duplication detection | Fast |
| **lizard** | Per-function CC (cross-language) | Fast |
| **jscpd** | Clone detection | Fast |

RuboCop is the primary tool — it includes cyclomatic complexity, perceived complexity,
ABC size, method length, class length, and block nesting metrics. flog and flay
provide complementary views: flog measures how "tortured" code is (assignment, branch,
call counts), while flay finds structurally similar code even when variable names differ.

## Tool Commands

### RuboCop — Primary linter and metrics

```bash
# Run with JSON output
rubocop --format json <path>

# Enable only metrics-related cops
rubocop --only Metrics --format json <path>

# Auto-correct safe fixes
rubocop --autocorrect <path>

# Auto-correct including unsafe fixes (review carefully)
rubocop --autocorrect-all <path>

# Show specific cop configuration
rubocop --show-cops Metrics/CyclomaticComplexity
```

Key metrics cops (configure in `.rubocop.yml`):
```yaml
Metrics/CyclomaticComplexity:
  Max: 10

Metrics/PerceivedComplexity:
  Max: 10

Metrics/AbcSize:
  Max: 20

Metrics/MethodLength:
  Max: 25

Metrics/ClassLength:
  Max: 150

Metrics/BlockNesting:
  Max: 3

Metrics/ParameterLists:
  Max: 4

Metrics/ModuleLength:
  Max: 150
```

### flog — ABC pain scoring

```bash
# Score all files (higher = more complex)
flog <path>

# Show methods above a threshold
flog --threshold 25 <path>

# Detailed breakdown per method
flog --details <path>

# Machine-parseable output
flog --quiet <path>
```

flog scores: 0–10 is great, 11–20 is OK, 21–40 needs review, 41–60 is dangerous,
60+ is unmaintainable. The score combines assignment, branch, and call counts with
different weights.

### flay — Structural duplication

```bash
# Find structurally similar code
flay <path>

# Set minimum mass for reporting (lower = more sensitive)
flay --mass 20 <path>

# Show diff between similar structures
flay --diff <path>
```

flay is more sophisticated than token-based clone detection — it normalizes
variable names and finds code that has the same structure but different identifiers.

## Language-Specific Refactoring Patterns

### Replace conditionals with guard clauses

```ruby
# Before
def process(order)
  if order
    if order.valid?
      if order.items.any?
        # actual logic
        calculate_total(order)
      end
    end
  end
end

# After
def process(order)
  return unless order
  return unless order.valid?
  return if order.items.empty?

  calculate_total(order)
end
```

### Replace case/when with polymorphism or hash lookup

```ruby
# Before
def calculate_shipping(method)
  case method
  when :standard  then weight * 0.5
  when :express   then weight * 1.5 + 5.0
  when :overnight then weight * 3.0 + 15.0
  else raise ArgumentError
  end
end

# After: hash lookup (for simple value mapping)
SHIPPING_RATES = {
  standard:  ->(w) { w * 0.5 },
  express:   ->(w) { w * 1.5 + 5.0 },
  overnight: ->(w) { w * 3.0 + 15.0 },
}.freeze

def calculate_shipping(method)
  rate = SHIPPING_RATES.fetch(method) { raise ArgumentError, "Unknown: #{method}" }
  rate.call(weight)
end
```

### Extract service objects from fat models

```ruby
# Before: God model
class User < ApplicationRecord
  def send_welcome_email
    UserMailer.welcome(self).deliver_later
    update!(welcomed_at: Time.current)
    ActivityLog.create!(user: self, action: :welcomed)
  end
end

# After: service object
class WelcomeUser
  def initialize(user)
    @user = user
  end

  def call
    send_email
    record_welcome
    log_activity
  end

  private

  def send_email = UserMailer.welcome(@user).deliver_later
  def record_welcome = @user.update!(welcomed_at: Time.current)
  def log_activity = ActivityLog.create!(user: @user, action: :welcomed)
end
```

### Replace method_missing with explicit methods

```ruby
# Before: magical dispatch
def method_missing(name, *args)
  if name.to_s.start_with?('find_by_')
    field = name.to_s.sub('find_by_', '')
    where(field => args.first).first
  else
    super
  end
end

# After: explicit (or use define_method for dynamic but visible methods)
%i[name email status].each do |field|
  define_method(:"find_by_#{field}") do |value|
    where(field => value).first
  end
end
```

## Ruby-Specific Anti-Patterns

- **Don't use `method_missing` unless absolutely necessary.** It hides the interface,
  breaks IDE support, and makes debugging painful. Always define `respond_to_missing?`
  if you do use it.
- **Don't create callbacks for business logic.** `before_save`, `after_create` etc.
  should handle model-internal concerns only. Business logic belongs in service objects.
- **Don't monkey-patch core classes in application code.** It creates invisible
  dependencies and can break libraries. Use refinements if you must extend core classes.
- **Don't create mixins (concerns/modules) just to shrink a file.** Moving 100 lines
  from a model into a concern doesn't reduce complexity — it just hides it. Split
  by genuine responsibility boundaries.
- **Don't use `eval` or `instance_eval` for configuration.** Use plain methods or
  hash arguments instead.
