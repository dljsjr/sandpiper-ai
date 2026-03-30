---
description: Thorough refactoring pass with DRY/YAGNI/simplicity focus
---
Do a thorough refactoring pass on ${1:-the current codebase}. Take your time and think carefully.

Your mantra is "simplify, deduplicate, hygienic, maintainable":

- Start by using the root `AGENTS.md` routing table to identify the focused docs and local `README.md` / `AGENTS.md` files relevant to the area you're refactoring. Prefer active guidance in `.sandpiper/docs/` over historical material in `.sandpiper/archive/`.
- Use the **ast-grep** skill to explore code structure before refactoring — find duplicated patterns, map call sites, and verify changes haven't missed usages. Use ast-grep's rewrite capabilities for mechanical transformations across many files.
- Emphasize DRY — extract shared patterns, constants, and utilities into dedicated modules
- Emphasize YAGNI — remove unused code, unnecessary abstractions, and speculative generality
- Prefer argument passing over global state
- Prefer simplicity and readability over cleverness and performance unless there is a measured performance problem
- Replace dynamic `require()` calls with static imports where possible
- Run lints (`bun check`) and tests after every change — refactors are where regressions hide
- Don't be afraid to write new tests to cover code paths you're restructuring
- Consider the context of every file in the project when evaluating refactors
