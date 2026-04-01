---
description: Structured code review of a revision range with optional reference docs
---
Perform a structured code review of the changes in revision range `$1`.

## Setup

Before reviewing any code:

1. Load the **code-review** skill and the appropriate language-specific reference for the files being reviewed.
2. Use the root `AGENTS.md` routing table to identify the focused docs and local `README.md` / `AGENTS.md` files relevant to the changed files. Read any code health or quality guidance docs that are routed.
3. Read the local `README.md` / `AGENTS.md` for any package or module being touched for the first time this session.

## Reference documents

The following paths are reference documents that provide context for this review: ${@:2}

If reference document paths were provided above, read each one before starting the review. Cross-reference the changes against them: verify the implementation aligns with the stated design, check that acceptance criteria are met, and flag any divergence between design intent and implementation.

If no paths were provided, review the changes on their own merits using the code review skill's standard workflow.

## Review process

1. **Enumerate the changes.** Use `jj log` to list all commits in the range. Read each commit's diff individually for full context. Also check for any uncommitted changes in the working copy that belong to the review scope.

2. **Review each change individually** — understand the intent from the commit message, read the diff, check for correctness, and note findings. Do NOT present per-commit feedback; accumulate findings for the final review.

3. **Ticket alignment.** For each commit whose description references a task key (e.g., `TCL-93`, `SHR-42`), read the referenced ticket using the **tasks** skill CLI. Verify that the code changes align with the ticket's title, description, and acceptance criteria. Flag any gaps.

4. **Quantitative analysis.** Run complexity analysis (`lizard`), lint (`bun check` or the project's lint command), and the test suite against the final state of the working copy. Report the results in the health summary.

5. **Present a single combined review** of the final state of the full stack. Individual commit-level noise should be collapsed — if an early commit introduced an issue that a later commit fixed, don't report it. Review the code as it exists at the tip of the range.

## Output

Write the review as a single markdown file at `.sandpiper/reviews/<date>-<slug>.md` where `<slug>` is a short descriptive name derived from the scope of the changes. The review must include:

- **Health summary table** — files reviewed, functions analyzed, complexity, length, duplication, nesting, lint warnings, test results, and an overall finding count by severity.
- **Findings** — each with location, severity (`blocker` / `major` / `minor` / `nit` / `positive`), what was observed, why it matters, and a concrete suggestion. Include positive findings.
- **Ticket alignment section** — a table or checklist of each referenced ticket, whether its acceptance criteria are met by the code, and a verdict on whether it can be closed.
- **Recommended actions** — prioritized list of what should be done before or after merge.

After writing the file, print a summary: the file path, the overall severity breakdown, whether any findings are blocking, and the ticket closure assessment.
