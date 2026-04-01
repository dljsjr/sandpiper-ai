---
name: code-review
description: >
  Use this skill whenever performing a code review, reviewing a pull request, reviewing a diff,
  auditing code quality, or assessing code health. Triggers include: any mention of "code review",
  "review this", "review my code", "PR review", "pull request", "look over this code", "audit",
  "what do you think of this code", "is this code good", "check my code", requests to review
  a diff or changeset, or when asked to evaluate code someone else wrote. Also trigger when the
  user pastes code and asks for feedback, opinions, or improvements. This skill provides a
  structured, evidence-backed review workflow that combines quantitative tool analysis with
  qualitative human-style review. Always consult this skill before reviewing non-trivial code —
  it prevents the common failure modes of purely subjective reviews (bikeshedding, style-as-substance,
  missing structural issues).
---

# Code Review

This skill provides a structured approach to code review that combines quantitative
measurement with qualitative assessment. It is designed to prevent the failure modes
of naive reviews: spending time on style while missing structural problems, treating
subjective preferences as objective quality issues, and failing to distinguish between
code that is merely unfamiliar and code that is genuinely problematic.

## Language-Specific References

After reading this file, read the appropriate reference for the code being reviewed:

| Language | Reference file | When to read |
|----------|---------------|--------------|
| TypeScript / JavaScript | `references/typescript.md` | Any .ts, .tsx, .js, .jsx files |
| Python | `references/python.md` | Any .py files |
| Rust | `references/rust.md` | Any .rs files |
| Go | `references/go.md` | Any .go files |
| C / C++ | `references/c-cpp.md` | Any .c, .cpp, .h, .hpp files |
| Swift | `references/swift.md` | Any .swift files |
| Ruby | `references/ruby.md` | Any .rb files |
| Java / Kotlin | `references/java-kotlin.md` | Any .java, .kt, .kts files |
| Lua | `references/lua.md` | Any .lua files, Neovim plugins, Love2D, OpenResty, embedded scripting |
| PHP | `references/php.md` | Any .php files, Laravel, Symfony, WordPress |

---

## Two Review Modes

### Mode A: Diff Review (PR / Changeset)

The most common mode. You are reviewing what changed. The core question:
**"Did this change leave the codebase better than, equal to, or worse than it was?"**

### Mode B: Health Audit (File / Module / Codebase)

You are reviewing existing code holistically. The core question:
**"What is the health of this code and what should be improved, in priority order?"**

Determine which mode applies before starting. If the user provides a diff, patch,
or mentions a PR, use Mode A. If they provide files and ask for general feedback,
use Mode B. If unclear, ask.

---

## Mode A: Diff Review Workflow

### Step 1: Understand Intent

Before looking at code, answer these questions:
- What is this change trying to accomplish? (Read the PR description, commit message,
  or ask the user.)
- What is the expected scope? (Is this a bug fix, feature, refactor, or cleanup?)
- Are there associated tests?

Do NOT start reviewing line-by-line before understanding intent. This is the most
common code review mistake — it leads to commenting on choices that make sense in
context but look odd in isolation.

### Step 2: Measure the Delta

Run quantitative tools on the changed files to establish whether the change improved
or degraded code health.

```bash
# Complexity delta on changed files
lizard --csv <changed-files>

# Line count delta
scc --format json --by-file <changed-files>

# New duplication introduced?
jscpd <affected-directory> --reporters json --output /tmp/jscpd-review

# Structural anti-patterns in new/changed code (adjust patterns per language)
ast-grep run -p 'catch ($ERR) { }' -l ts <changed-files>         # empty catch blocks
ast-grep run -p 'as any' -l ts <changed-files>                   # type-safety escapes

# Architectural impact (if sentrux is available)
sentrux snapshot --label review-before   # on the base branch
# switch to PR branch
sentrux snapshot --label review-after
sentrux diff review-before review-after
```

Also run the language-specific linter (see language reference) on changed files only.

**What to look for in the delta:**
- Did any function's CC increase above 15?
- Did any function grow beyond 60 lines?
- Did nesting depth increase beyond 3-4 levels?
- Was duplication introduced?
- Did the change add more code than necessary for the stated goal?
- Did linter warnings increase?
- Did ast-grep find new structural anti-patterns (type escapes, silent catches, etc.)?

The ratchet principle applies: changes should not degrade any health metric without
strong justification.

### Step 3: Correctness Review

Now read the actual code. This is the part that requires judgment, not tooling.
Check in this order:

**3a. Logic correctness:**
- Does the code actually do what the intent says it should?
- Are there off-by-one errors, boundary conditions, or edge cases missed?
- Are there race conditions or ordering assumptions?
- Is error handling complete? What happens when things fail?
- Are there implicit assumptions that could break?

**3b. Security:**
- Is user input validated and sanitized?
- Are there injection risks (SQL, command, template)?
- Are secrets or credentials hardcoded or logged?
- Are permissions/authorization checks present where needed?
- Is data properly escaped for its output context (HTML, URLs, SQL)?
- Are cryptographic operations using secure defaults?

**3c. Data integrity:**
- Can this change corrupt or lose data?
- Are database operations atomic where they should be?
- Are there partial-failure scenarios that leave state inconsistent?
- Is input validation happening at the right boundary?

**3d. Error handling:**
- Are all error paths handled?
- Are errors propagated with useful context (not swallowed)?
- Is there appropriate fallback behavior?
- Are resource leaks possible on error paths? (files, connections, locks)

### Step 4: Structural Assessment

Zoom out from individual lines to assess structural impact:

- **API surface:** Does this change alter public interfaces? Are the changes backward
  compatible? Is the API intuitive or surprising?
- **Coupling:** Does this change introduce new dependencies between modules? Does it
  create circular dependencies?
- **Cohesion:** Does the new code belong in the file/module where it was placed? Would
  it be more natural elsewhere?
- **Naming:** Do new names (functions, variables, types, files) clearly communicate
  purpose? Are they consistent with existing conventions?
- **Testability:** Is the new code testable in isolation? If it's hard to test, that's
  a design smell, not a testing problem.
- **Test quality:** Do the tests verify behavior (what it does) or implementation
  (how it does it)? Implementation-coupled tests are fragile.

### Step 5: Compile the Review

Structure the review as described in "Writing the Review" below.

---

## Mode B: Health Audit Workflow

### Step 1: Measure Everything

Run the full measurement suite on the target code:

```bash
# Overview: line counts, complexity estimates, language breakdown
scc --format json --by-file <path>

# Per-function complexity (the most actionable data)
lizard --csv <path>

# Duplication analysis
jscpd <path> --reporters json --output /tmp/jscpd-audit

# Structural anti-pattern scan (adjust patterns per language)
ast-grep run -p 'catch ($ERR) { }' -l ts <path>              # empty catch blocks
ast-grep run -p 'as any' -l ts <path>                        # type-safety escapes
ast-grep run -p 'process.exit($$$)' -l ts <path>             # hard exits
ast-grep run -p 'eval($$$)' -l ts <path>                     # eval usage

# Architectural health
sentrux analyze <path>
```

Run the language-specific linter on the full target (see language reference).

If version control history is available, identify hotspots:

```bash
# Files with highest churn in the last 6 months (git)
git log --since="6 months ago" --format='' --name-only -- <path> \
  | sort | uniq -c | sort -rn | head -30
# For jj repos, extract changed paths per commit from the relevant revision range
```

### Step 2: Triage

Sort findings into priority tiers using this framework:

**Tier 1 — Fix now (correctness risk):**
- Functions with CC > 20
- Duplicated blocks that have diverged (inconsistent clones)
- Dead code paths (unreachable branches, unused exports)
- Security issues (hardcoded secrets, unsanitized input, injection vectors)
- Resource leaks
- Files appearing in both "high complexity" and "high churn" lists (hotspots)

**Tier 2 — Fix soon (maintenance risk):**
- Functions with CC 15-20
- Functions longer than 60 lines
- Nesting depth > 4
- High fan-out (file importing 10+ distinct modules)
- Duplication > 5%
- Missing error handling on I/O operations

**Tier 3 — Improve opportunistically:**
- Functions with CC 10-15
- Functions 25-60 lines
- Naming inconsistencies
- Minor style violations
- Missing type annotations (in gradually-typed languages)

**Tier 4 — Note but don't prioritize:**
- Style preferences that differ from reviewer's taste but are internally consistent
- Minor duplication (< 3%)
- Tests that test implementation rather than behavior
- Documentation gaps

### Step 3: Deep-Read Priority Code

Read the Tier 1 and Tier 2 code carefully, applying the same correctness, security,
data integrity, and error handling checks from Mode A Step 3. Don't deep-read
everything — focus review attention proportional to risk.

### Step 4: Compile the Audit

Structure the report as described in "Writing the Review" below, but frame findings
as prioritized recommendations rather than change requests.

---

## Writing the Review

### Severity Levels

Every finding should have one of these severity levels:

| Level | Meaning | Reviewer expectation |
|-------|---------|---------------------|
| **blocker** | Correctness bug, security vulnerability, data loss risk | Must fix before merge |
| **major** | Significant health degradation, missing error handling, architectural concern | Should fix before merge |
| **minor** | Complexity increase, naming concern, duplication, style inconsistency | Fix or acknowledge with justification |
| **nit** | Style preference, optional improvement, alternative approach | Take or leave |
| **positive** | Something done well, good pattern, notable improvement | No action needed |

Always include **positive** findings. Reviews that only contain criticism miss the
opportunity to reinforce good practices and demoralize the author.

### Finding Structure

Each finding should include:
1. **Location:** File and line range (or function name)
2. **Severity:** One of the levels above
3. **What:** What you observed (factual, not judgmental)
4. **Why:** Why it matters (grounded in evidence when possible)
5. **Suggestion:** A concrete improvement (not just "fix this")

### Style, Conventions, and Hygiene

Quantitative metrics catch structural problems, but consistent style and conventions
are genuinely important — they reduce cognitive load for everyone working in the
codebase. Flag these issues as `minor` or `nit` depending on severity, but DO flag
them. The goal is not to skip style review — it's to prevent style review from crowding
out correctness and structural review. Do the structural analysis first, THEN address
style.

**Project conventions (minor severity):**
- Deviations from the project's established patterns. If the rest of the codebase
  uses factory functions and the new code introduces a builder pattern for the same
  purpose, that's a legitimate finding. Consistency within a codebase matters more
  than which convention is "best."
- Violations of the project's linter configuration, `.editorconfig`, or style guide.
- Using a different error handling pattern than the rest of the codebase (e.g.,
  exceptions where the codebase uses Result types, or callbacks where it uses async).
- Import ordering/grouping that doesn't match the codebase convention.
- File/directory organization that breaks the existing module structure.

**Org-specific conventions (minor severity):**
- Naming conventions for specific domains (API routes, database columns, environment
  variables, config keys).
- Required file headers, license blocks, or copyright notices.
- Mandatory documentation formats (JSDoc, docstrings, rustdoc).
- Commit message and PR description conventions.
- Required test naming patterns or test organization conventions.

**Hygiene nits (nit severity — but still worth flagging):**
- Typos in variable names, function names, comments, error messages, and documentation.
  Typos in identifiers are worse than typos in comments because they propagate through
  the codebase and are harder to fix later.
- Missing trailing newline at end of file (POSIX convention; most linters enforce this).
- Trailing whitespace.
- Inconsistent indentation (tabs vs. spaces, or mixed indent levels).
- Commented-out code left behind (should be deleted; version control has the history).
- `TODO`/`FIXME`/`HACK` comments without tracking information (who, when, or a
  ticket reference).
- Console/debug logging left in production code (`console.log`, `print`, `dbg!`).
- Inconsistent casing (mixing `camelCase` and `snake_case` within the same module).

When reviewing in a codebase you haven't seen before, spend a moment scanning the
neighboring code to calibrate: what conventions does this project use? How does it
name things? What patterns does it follow? Then assess the new code against those
established patterns, not against your own preferences. When the project has no
established convention for something, note both alternatives but don't block on it.

### What NOT to Do in Style Review

**Don't bikeshed.** If a naming choice is reasonable, consistent with the project,
and communicates intent — don't suggest your preferred synonym. Only flag names that
are misleading, ambiguous, or inconsistent with existing conventions.

**Don't enforce personal style over project style.** Your preferred convention doesn't
override the project's established patterns. If the project uses `snake_case` and
you prefer `camelCase`, the project wins.

**Don't mix style changes with structural feedback in a way that obscures priority.**
Present correctness/security findings clearly separated from style nits. The author
should never have to guess which comments are blocking and which are cosmetic.

**Don't pile on.** If a file has 20 style issues and 3 correctness bugs, lead with
the bugs and mention the style issues as a batch ("there are several style
inconsistencies in this file — see the linter output"). Don't produce 20 individual
comments that bury the 3 important ones.

**Don't conflate "unfamiliar" with "wrong."** Code using patterns you haven't seen
before is not automatically bad. Evaluate unfamiliar approaches on their merits
(correctness, readability, maintainability) rather than familiarity.

### Quantitative Summary

Begin or end every review with a quantitative summary:

```
## Health Summary

Files reviewed: 4
Functions analyzed: 23

Complexity: 3 functions above CC 15 (worst: parse_config at CC 22)
Length: 1 function above 60 lines (build_report at 87 lines)
Duplication: 2.1% (acceptable)
Nesting: 1 function with depth 5 (process_nested_items)
New linter warnings: 2 (both complexity-related)

Architectural impact (sentrux): score stable (0.72 → 0.71)

Overall: 1 blocker, 2 major, 3 minor, 2 nits, 4 positive
```

This grounds the review in observable facts before presenting subjective assessments.

---

## Distinguishing Evidence-Backed Concerns from Preferences

This is the most important skill in code review, and the one most reviewers lack.

**Evidence-backed (state with confidence):**
- "This function has CC 22, which is associated with higher defect rates in the literature.
  Consider splitting at the [specific logical boundary]."
- "This duplicated block appears in two files with slight divergence. Research shows
  inconsistent clones are a significant source of maintenance defects."
- "This 90-line function exceeds the 60-line threshold where empirical studies show
  comprehension difficulty increases significantly."
- "This nesting depth of 5 exceeds cognitive load research thresholds. Guard clauses
  would flatten this."

**Preferences (frame as suggestions, not requirements):**
- "I'd personally extract this into a separate module, but the current placement
  is reasonable."
- "You could use a map/dict lookup here instead of a switch — it's a style choice."
- "Some teams prefer early returns; others prefer single-return. This code is consistent
  with single-return, which is fine."
- "This could arguably be split into two functions, but at CC 8 it's within healthy
  range either way."

When you have evidence, cite it. When you don't, explicitly frame the feedback as a
preference or suggestion. This distinction is what separates useful reviews from
annoying ones.

---

## Common Reviewer Failure Modes

**The Nitpicker:** Produces 30 style comments and misses the logic bug on line 47.
Avoid by doing the quantitative measurement and correctness review BEFORE commenting
on style.

**The Rubber Stamper:** "LGTM" after a 5-second glance. Avoid by requiring yourself
to produce the quantitative summary — it forces actual analysis.

**The Architect Astronaut:** Suggests rewriting a 20-line function as a strategy
pattern with dependency injection. Avoid by checking whether the suggestion actually
improves measurable health metrics.

**The Historian:** "We tried this approach in 2019 and it didn't work." Context
matters, but past failures don't automatically invalidate current approaches. Evaluate
the code on its present merits.

**The Perfectionist:** Blocks a PR for issues that don't affect correctness, security,
or health metrics. If you're about to block a merge, verify your concerns are at
"blocker" or "major" severity. If they're all "minor" or "nit," approve with comments.

---

## Integration with Other Skills

If the review identifies significant refactoring needs, point the author to the
**refactoring** skill for structured cleanup. The code review skill identifies
*what* needs work; the refactoring skill provides the *how*.

For new code being written, the **AGENTS.md code health** section provides the
principles that should prevent the issues this review skill catches.
