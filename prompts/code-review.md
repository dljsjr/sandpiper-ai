---
description: Structured code review of a revision range with optional reference docs
---
Perform a structured code review of the changes in revision range `$1`.

## Setup

Before reviewing any code:

1. Load the **code-review** skill and the appropriate language-specific reference for the files being reviewed.
2. Use the root `AGENTS.md` routing table to identify and read the focused docs and local `README.md` / `AGENTS.md` files relevant to the changed files.
3. Read the local `README.md` / `AGENTS.md` for any package or module being touched for the first time this session.

## Reference documents

Additional context paths: ${@:2}

If paths were listed above, read each document before starting the review. These may be work plans, PRDs, design docs, or any other context that informs the intent behind the changes. Cross-reference the implementation against them: verify alignment with the stated design, check that acceptance criteria are met, and flag divergence.

If no paths were listed, review the changes on their own merits using the code review skill's standard workflow.

## Review process

1. **Enumerate the changes.** Use the repo's version control tool to list all commits in the range `$1` and read each commit's diff individually for full context — review per-commit diffs, not a single combined diff. Also check for uncommitted changes in the working copy that may belong to the review scope.

2. **Understand before judging.** For each change, read the commit message and understand the intent before reading the code. Do NOT start line-by-line review without understanding what the change is trying to accomplish.

3. **Accumulate, don't report per-commit.** Review each change individually but do NOT present per-commit feedback. Collapse findings into a review of the final state — if an early commit introduced an issue that a later commit fixed, don't report it.

4. **Ticket alignment.** For each commit description that references a task key (e.g., `TCL-93`, `SHR-42`), read the referenced ticket using the **tasks** skill CLI (`task show <key>`). Verify that the code changes satisfy the ticket's title, description, and acceptance criteria. Flag gaps.

5. **Quantitative analysis.** Run against the final state of the working copy:
   - Complexity: `lizard --csv` on new/changed source files
   - Lint: `bun check` (or the project's lint command)
   - Tests: `bun test` (or the project's test command)
   - Optionally: duplication (`jscpd`), structural anti-patterns (`ast-grep`)

## Output

Write the review to `.sandpiper/reviews/<date>-<slug>.md` where `<slug>` is a short descriptive name. Include:

- **Health summary table** — files reviewed, functions analyzed, complexity, length, duplication, nesting, lint warnings, test pass rate, and finding count by severity.
- **Findings** — each with: location (file + function/line), severity (`blocker` / `major` / `minor` / `nit` / `positive`), what was observed (factual), why it matters (grounded in evidence when possible), and a concrete suggestion. Always include `positive` findings — reinforce good patterns.
- **Ticket alignment** — for each referenced task, whether its acceptance criteria are met and whether it can be closed. State this explicitly per ticket.
- **Recommended actions** — prioritized. Clearly distinguish blocking issues from post-merge improvements.

After writing the file, print a short summary: the file path, severity breakdown, whether anything blocks merge, and the ticket closure verdict.
