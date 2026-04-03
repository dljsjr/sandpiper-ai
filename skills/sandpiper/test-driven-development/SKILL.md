---
name: test-driven-development
description: >
  Use this skill whenever TDD or BDD is relevant. Triggers: "TDD", "test-driven", "test first",
  "red-green-refactor", "BDD", "behavior-driven", "behaviour-driven", "given-when-then",
  "Gherkin", "Cucumber", "SpecFlow", "feature file", "step definitions", "acceptance criteria",
  "specification by example", "living documentation", "write tests first", "start with a failing
  test", "how do I structure this test". Also trigger when the user is implementing a feature and
  should write tests first, when converting requirements into executable tests, or when discussing
  testing methodology. Covers the full TDD red-green-refactor cycle, BDD scenario patterns, when
  to use each approach, and the critical mistakes agents make — like writing tests after the code
  and calling it TDD, or writing implementation-coupled tests that break on every refactor.
---

# Test-Driven Development & Behavior-Driven Development

TDD and BDD are both **test-first** development methodologies. They share the principle
that tests are written before production code, but they operate at different levels of
abstraction and serve different audiences.

- **TDD** is developer-facing. Tests describe *how the code works* at a unit level.
- **BDD** is stakeholder-facing. Specifications describe *what the system does* in
  business language.

They are complementary, not competing. A well-tested system often uses BDD for
high-level acceptance criteria and TDD for the internal implementation details.

## Part 1: Test-Driven Development (TDD)

### The Red-Green-Refactor Cycle

TDD follows a strict three-phase cycle. Every deviation from this cycle weakens the
methodology's benefits. The phases are:

**1. RED — Write a failing test**

Write a test for behavior that doesn't exist yet. The test must fail, and it must fail
for the *right reason* — because the production code is missing, not because the test
itself is broken. If the test passes immediately, something is wrong: either the behavior
already exists (and you don't need new code) or the test isn't actually testing what you
think it is.

Run the test. Watch it fail. Read the failure message. This step matters because it
validates that your test is wired up correctly and that you understand what "failing"
looks like for this behavior.

**2. GREEN — Write the simplest code that makes the test pass**

Write the minimum production code necessary to make the failing test pass. "Minimum"
is key — do not write the "right" solution yet. Do not generalize. Do not handle edge
cases you haven't written tests for. If the test expects `add(1, 2)` to return `3`,
it is valid at this stage to write `return 3`. This feels wrong, but it forces you to
write the next test that demands a real implementation.

The discipline of writing minimal code serves two purposes: it ensures every line of
production code is demanded by a test, and it keeps you moving in small, verifiable
steps rather than large, speculative leaps.

**3. REFACTOR — Improve the code without changing behavior**

With a green test suite as your safety net, clean up both the production code and the
test code. Remove duplication, improve names, extract methods, simplify conditionals.
The constraint is that all tests must stay green throughout. If a test breaks during
refactoring, you've changed behavior, not just structure — undo and try again.

Refactoring the *tests* is equally important. Tests are code. They accumulate technical
debt just like production code. If a test is hard to read, rename things. If tests share
setup, extract a helper. If a test name doesn't describe the behavior, fix it.

For non-trivial refactoring, use the `refactoring` skill's metrics-based workflow:
measure complexity (lizard), check duplication (jscpd), and verify that no metric
worsened after your changes. The refactor step is where design quality emerges —
skipping the measurements means you're guessing about whether you actually improved
the code.

Then return to step 1 with the next behavior.

### The Laws of TDD (Robert C. Martin's Formulation)

1. You may not write production code until you have written a failing test.
2. You may not write more of a test than is sufficient to fail (including compile errors).
3. You may not write more production code than is sufficient to pass the currently
   failing test.

These laws create a tight feedback loop where you switch between test and production
code every 30–120 seconds. This granularity is the source of TDD's power — bugs are
caught within seconds of being introduced, because you always know what you just changed.

### What TDD Gives You

- **Regression safety**: Every behavior is covered by a test from the moment it's written.
- **Design feedback**: If a class is hard to test, it's probably hard to use. TDD makes
  design problems visible immediately — before they accumulate.
- **Confidence to refactor**: You can restructure code aggressively because the tests
  catch any accidental behavior changes.
- **Executable documentation**: The test suite describes what the code actually does,
  not what someone intended it to do six months ago.
- **Small steps, fast feedback**: Problems are caught within a minute of being introduced.

### What TDD Does NOT Give You

- **Architecture**: TDD guides low-level design but doesn't tell you how to structure
  modules, define boundaries, or choose patterns. You still need architectural thinking.
- **Correctness guarantees**: TDD only verifies the behaviors you thought to test. It
  doesn't find requirements you didn't know about.
- **Performance**: TDD optimizes for correctness and design quality, not speed. You still
  need profiling, benchmarking, and performance testing.

### Writing Good Tests (The Test Quality Triangle)

Every test should have three properties:

**1. Readable** — A test is documentation. Someone unfamiliar with the code should be
able to read the test name and body and understand what behavior is being verified. Use
descriptive names: `test_expired_coupon_returns_zero_discount` not `test_coupon_3`. Use
the Arrange-Act-Assert (AAA) pattern to structure every test into three visible sections.

**2. Isolated** — Each test verifies one behavior and can run independently of all other
tests. Tests must not depend on execution order, shared mutable state, or the results
of other tests. If test B fails when test A doesn't run first, both tests are broken.

**3. Fast** — Unit tests should run in milliseconds. If your test touches the filesystem,
network, or database, it's an integration test — still valuable, but not a unit test. Slow
tests break the feedback loop that makes TDD effective.

### The Arrange-Act-Assert Pattern

Every test body follows this structure:

```
// ARRANGE — Set up the preconditions
//   Create objects, configure mocks, prepare input data.
//   This section answers: "Given this starting state..."

// ACT — Perform the action under test
//   Call the method or function being tested. Exactly one action.
//   This section answers: "When I do this..."

// ASSERT — Verify the outcome
//   Check that the result matches expectations.
//   This section answers: "Then I expect this..."
```

Keep one logical action in the ACT section. If you need multiple actions, you're
testing a workflow (which is fine, but name the test accordingly).

### Test Naming Conventions

Test names should describe behavior, not implementation. Formats that work well:

- `test_<behavior>_when_<condition>` — Python/Ruby style
- `should <behavior> when <condition>` — JS/BDD-influenced style
- `<method>_<scenario>_<expected>` — Java/C# style (e.g., `withdraw_insufficientFunds_throwsException`)
- `it("<behavior description>")` — JS describe/it blocks

Bad names describe implementation: `test_processOrder_method`, `test_line_42`.
Good names describe behavior: `test_order_with_expired_coupon_uses_full_price`.

### Test Doubles: When and Which Kind

Test doubles substitute real dependencies to isolate the unit under test. Use the
right kind for the situation:

**Dummy**: Passed to satisfy a parameter but never actually used. Example: a null logger
passed to a constructor that requires a logger but the test doesn't verify logging.

**Stub**: Returns predetermined values. Use when the test needs the dependency to provide
data but doesn't care how it was called. Example: a stubbed repository that always
returns `User(name="Alice")`.

**Mock**: Records interactions for later verification. Use when the test needs to verify
that the code *called* the dependency correctly. Example: verifying that `emailService.send()`
was called with the right parameters.

**Spy**: A real implementation that also records interactions. Use when you want real
behavior but also need to verify calls.

**Fake**: A working implementation with shortcuts. Example: an in-memory database instead
of PostgreSQL.

**Guideline**: Prefer stubs over mocks. Tests that verify interactions (mocks) are
tightly coupled to implementation and break on refactoring. Tests that verify outcomes
(stubs + assertions on return values or state) survive refactoring because they test
*what* happened, not *how*.

### Common TDD Mistakes

**Writing tests after the code** (retroactive testing): This produces tests that verify
the implementation you already wrote, not the behavior you need. These tests are
brittle, coupled to implementation details, and miss edge cases. If you catch yourself
writing tests after the fact, stop and think about what behaviors you actually need to
verify — don't just mirror the code's structure.

**Testing implementation instead of behavior**: A test that asserts `mock.method_x.called_with(42)`
is testing *how* the code works. A test that asserts `result == expected_value` is testing
*what* the code does. The latter survives refactoring; the former breaks every time you
change the implementation, even if the behavior is identical.

**Over-mocking**: If every dependency is mocked, you're testing whether your mocks
are configured correctly, not whether your code works. Mock at architectural boundaries
(databases, HTTP APIs, file systems); use real objects for in-process collaborators
when feasible.

**The giant test**: A test with 50 lines of setup, 10 actions, and 20 assertions is
testing an entire workflow, not a unit. Break it up. Each test should verify one behavior.

**Skipping the refactor step**: Without refactoring, TDD produces working code that
is just as messy as code written without TDD — it's just covered by tests. The refactor
step is where design quality emerges.

**Testing private methods directly**: If you feel the need to test a private method, it
usually means either (a) the method is complex enough to warrant extraction into its own
class (which then gets its own public API and tests), or (b) you can test it indirectly
through the public API that calls it.

---

## Part 2: Behavior-Driven Development (BDD)

### What BDD Adds to TDD

BDD was created by Dan North as a response to confusion around TDD. Where developers
struggled with questions like "what do I test?" and "where do I start?", BDD reframes
testing as **specifying behavior from the outside in**. The key shifts are:

- **Language**: Instead of "tests," BDD uses "specifications," "scenarios," and
  "examples." This isn't just semantic — it changes how you think about what you're
  writing. You're describing what the system should do, not proving that code works.

- **Audience**: BDD specifications are meant to be readable by non-developers —
  product managers, QA, domain experts. They serve as a shared language between
  business and engineering (the "ubiquitous language" from Domain-Driven Design).

- **Scope**: BDD typically operates at the acceptance/integration level, verifying
  end-to-end behavior through the system's external interfaces. TDD operates at the
  unit level.

### The Given-When-Then Structure

BDD scenarios follow a standard format:

```gherkin
Feature: Shopping cart checkout
  As a customer
  I want to apply discount coupons
  So that I can save money on my purchases

  Scenario: Valid coupon applies discount
    Given a shopping cart with items totaling $100
    And a valid 20% discount coupon "SAVE20"
    When the customer applies coupon "SAVE20"
    Then the cart total should be $80

  Scenario: Expired coupon is rejected
    Given a shopping cart with items totaling $100
    And an expired coupon "OLD10"
    When the customer applies coupon "OLD10"
    Then the coupon should be rejected with message "Coupon has expired"
    And the cart total should remain $100

  Scenario Outline: Coupon minimum spend requirement
    Given a shopping cart with items totaling <cart_total>
    And a coupon requiring minimum spend of $50
    When the customer applies the coupon
    Then the coupon should be <result>

    Examples:
      | cart_total | result   |
      | $30        | rejected |
      | $50        | accepted |
      | $100       | accepted |
```

### Anatomy of a Feature File

- **Feature**: A high-level capability (maps to a user story or epic).
- **Scenario**: A specific example of the feature's behavior. Each scenario is an
  independent, executable test.
- **Given**: Preconditions — the state of the world before the action.
- **When**: The action being tested — exactly one trigger per scenario.
- **Then**: Expected outcomes — what should be true after the action.
- **And / But**: Continue the previous Given/When/Then for readability.
- **Scenario Outline + Examples**: Parameterized scenarios — same structure, different data.
- **Background**: Shared Given steps that apply to every scenario in the feature.
  Use sparingly — if a Background grows beyond 3–4 lines, your scenarios may be
  testing too many things at once.

### Writing Good Scenarios

**Declarative, not imperative**: Describe *what* should happen, not *how*.

```gherkin
# BAD — imperative (describes UI clicks, coupled to implementation)
Given I navigate to "/login"
When I type "alice" in the "username" field
And I type "password123" in the "password" field
And I click the "Submit" button
Then I should see the text "Welcome, Alice"

# GOOD — declarative (describes behavior)
Given a registered user "Alice"
When Alice logs in with valid credentials
Then Alice should see the welcome dashboard
```

Imperative scenarios are brittle — they break when the UI changes even though the
behavior hasn't. Declarative scenarios describe intent and survive UI refactors.

**One behavior per scenario**: A scenario that tests login, adding items to a cart,
and checking out is three scenarios pretending to be one. Split them. Each scenario
should be independently understandable and independently runnable.

**Use domain language**: Scenarios should use the same words the business uses. If the
business says "coupon," don't write "discount_code" in your feature files. This shared
vocabulary is one of BDD's primary benefits.

**Avoid technical details**: Feature files should not mention databases, HTTP status
codes, CSS selectors, or implementation details. Those belong in step definitions.

### Step Definitions: The Glue Code

Step definitions connect natural-language scenario steps to executable code. Each
`Given`, `When`, or `Then` line matches a step definition via regex or expression:

```python
# Python (Behave)
@given('a shopping cart with items totaling ${total:d}')
def step_cart_with_total(context, total):
    context.cart = ShoppingCart()
    context.cart.add_item(Item(price=total))

@when('the customer applies coupon "{code}"')
def step_apply_coupon(context, code):
    context.result = context.cart.apply_coupon(code)

@then('the cart total should be ${expected:d}')
def step_verify_total(context, expected):
    assert context.cart.total == expected
```

Step definitions should be **thin glue** — they translate between Gherkin and your
application's API. Business logic does not belong in step definitions. If a step
definition is longer than 5–10 lines, extract the logic into a helper or page object.

### Common BDD Mistakes

**Treating feature files as test scripts**: Feature files are specifications, not test
automation scripts. If your Gherkin reads like a Selenium script with step-by-step
UI interactions, you've lost the abstraction benefit. Push implementation details
into step definitions.

**Too many scenarios**: If a feature file has 50 scenarios, the feature is too broad.
Split it into smaller, cohesive features. A good rule of thumb is 3–10 scenarios per
feature file.

**Incidental details in scenarios**: Every piece of data in a scenario should be
relevant to the behavior being tested. If the user's email address doesn't affect the
outcome, don't include it:

```gherkin
# BAD — irrelevant details
Given a user with email "alice@example.com" and name "Alice Smith" born on "1990-01-15"
When the user adds a product costing $50 to the cart
Then the cart total should be $50

# GOOD — only relevant details
Given a customer
When they add a $50 product to the cart
Then the cart total should be $50
```

**Step definition explosion**: If every scenario introduces unique step definitions,
you'll drown in glue code. Write reusable, parameterized steps. A mature BDD suite
has a small library of composable steps that cover many scenarios.

**No living documentation**: One of BDD's biggest benefits is that feature files serve
as always-up-to-date documentation. If feature files are not reviewed alongside code
changes, they rot and become misleading. Treat feature files as production artifacts
— they go through code review, they're versioned, they're maintained.

---

## Part 3: When to Use Which

### Use TDD (unit-level, developer-facing) when:

- Implementing algorithms, data structures, or business logic functions
- Working on internal APIs that don't map directly to user-visible features
- Designing class/module interfaces (TDD gives design feedback)
- Working alone or in a purely technical context
- You need the fastest possible feedback loop (millisecond test execution)

### Use BDD (acceptance-level, stakeholder-facing) when:

- Translating user stories or acceptance criteria into executable specifications
- Collaborating with non-developer stakeholders on requirements
- Defining the expected behavior of user-facing features
- Creating living documentation that both business and engineering can read
- Testing end-to-end workflows through the system's external interfaces

### Use both together (the outside-in approach) when:

1. Start with a BDD scenario that describes the desired behavior from the user's perspective.
2. Run it — it fails (no implementation yet).
3. Use TDD to implement the internal components needed to make the scenario pass.
4. Each TDD cycle builds a small piece. When enough pieces are built, the BDD scenario
   turns green.
5. Refactor, then move to the next scenario.

This is sometimes called "double loop TDD" — the outer loop is BDD (acceptance-level),
the inner loop is TDD (unit-level).

---

## Workflow: When the User Asks You to Apply TDD or BDD

### If Asked to Implement a Feature with TDD

1. **Clarify the first behavior**: "What's the simplest thing this should do?"
   Don't try to plan all tests upfront. Start with one.

2. **Write the failing test first**: Present the test, explain what behavior it
   verifies, and confirm with the user before writing production code.

3. **Write minimal production code**: Make the test pass with the simplest possible
   implementation. Show the user even if the code looks "too simple."

4. **Refactor**: Clean up both test and production code while keeping tests green.

5. **Repeat**: Ask "What's the next behavior?" and write the next failing test.

Do NOT write a batch of tests and then implement them all at once. That's not TDD — it's
writing tests first, which is a different (and less effective) practice. The interleaving
of test and code, one behavior at a time, is what makes TDD work.

### If Asked to Implement a Feature with BDD

1. **Write the feature file first**: Collaborate with the user on scenarios in
   Given-When-Then format. Use domain language. Keep scenarios declarative.

2. **Implement step definitions**: Write the glue code that connects Gherkin
   steps to application code. Show the user the step definitions.

3. **Run the scenarios**: They should fail (no implementation yet).

4. **Implement the production code**: Use TDD internally if appropriate.
   The BDD scenarios serve as the acceptance criteria — when they pass, the
   feature is done.

5. **Review scenarios**: Ensure the feature file reads as clear documentation
   of what the feature does.

### If Asked to Write Tests for Existing Code (Retroactive Testing)

This is not TDD, but it's still valuable. Be explicit about the distinction:

"I'll write tests for this existing code. Note that this is retroactive testing,
not TDD — since the code already exists, we're characterizing its current behavior
rather than driving its design. The tests will still provide regression safety,
but they may be more coupled to the current implementation than TDD-produced tests
would be."

Focus on testing observable behavior through the public API. Avoid mirroring the
implementation's internal structure.

## Common Agent Mistakes to Avoid

1. **Writing all tests first, then all code**: TDD is interleaved — one test, then
   its implementation, then refactor. Writing a batch of tests upfront loses the
   design feedback that makes TDD valuable.

2. **Generating tests from existing code**: Reading the code and writing tests that
   mirror its structure produces tests that verify the implementation, not the
   behavior. These tests break on every refactor and catch no bugs.

3. **Skipping the RED step**: If you write a test that passes immediately, you
   haven't verified that the test actually detects the behavior. Always watch the
   test fail first.

4. **Writing BDD scenarios that read like Selenium scripts**: Feature files should
   describe *what*, not *how*. Push click-by-click UI interactions into step
   definitions.

5. **Mocking everything**: If every collaborator is mocked, you're testing wiring,
   not behavior. Mock at architectural boundaries; use real objects internally.

6. **Treating TDD as a typing exercise**: TDD is a *thinking* exercise. The test
   forces you to think about what the code should do before you think about how
   to do it. If you're just mechanically writing test-then-code without thinking
   about design, you're missing the point.
