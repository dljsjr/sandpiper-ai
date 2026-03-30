---
description: Plan and implement a new feature with task tracking
---
Let's implement: $@

Before writing any code:
1. Use the root `AGENTS.md` routing table to identify the focused docs and local `README.md` / `AGENTS.md` files relevant to the area you'll touch. Prefer current source-of-truth docs in `.sandpiper/docs/` over historical material in `.sandpiper/archive/`.
2. Create a task (or tasks) for this work using the **tasks** skill CLI
3. Think through the design — identify ambiguities and ask questions
4. If you're unsure about any API you'll be using, look it up with the **dash** skill rather than guessing
5. Consider what tests we need (TDD — write failing tests first)
6. Consider what existing code will be affected — use **ast-grep** to explore call sites and patterns

Then implement iteratively:
- Write failing tests
- Write code to make them pass
- Run lints (`bun check`) and tests after every meaningful change
- Commit frequently with task key references
- Update task statuses as you progress
