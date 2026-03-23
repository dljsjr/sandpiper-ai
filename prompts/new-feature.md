---
description: Plan and implement a new feature with task tracking
---
Let's implement: $@

Before writing any code:
1. Create a task (or tasks) for this work using the **tasks** skill CLI
2. Think through the design — identify ambiguities and ask questions
3. If you're unsure about any API you'll be using, look it up with the **dash** skill rather than guessing
4. Consider what tests we need (TDD — write failing tests first)
5. Consider what existing code will be affected — use **ast-grep** to explore call sites and patterns

Then implement iteratively:
- Write failing tests
- Write code to make them pass
- Run lints (`bun check`) and tests after every meaningful change
- Commit frequently with task key references
- Update task statuses as you progress
