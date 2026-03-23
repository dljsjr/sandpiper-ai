---
title: "Biome --unsafe autofix broke signal parser while loop — investigate guardrails"
status: NOT STARTED
kind: BUG
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-03-23T03:58:37.935Z

related:
  - SHR-43
updated_at: 2026-03-23T04:00:01.338Z
---

# Biome --unsafe autofix broke signal parser while loop — investigate guardrails

A biome UNSAFE autofix (`--unsafe`, NOT safe `--write`) restructured a `while ((x = expr) !== -1)` loop to eliminate the assignment-in-expression. The restructured version moved the reassignment to the bottom of the loop body, but a `continue` statement bypassed it, causing an infinite loop on inputs with consecutive newlines.

The `noAssignInExpressions` rule's unsafe fix rewrites control flow — it cannot account for `continue` or `break` statements that skip the moved reassignment.

**This is why the AGENTS.md rule exists: NEVER use `--unsafe` flags on linters.**

The rule was added during the TCL branch after a similar incident, but the damage to signal.ts had already been committed.

**Action items:**
- Verify no other unsafe fixes are lurking in the codebase
- Consider adding a pre-commit hook that runs tests after any lint autofix
- Document this specific pattern (assignment-in-loop-condition + continue) as a known `--unsafe` pitfall

---

# Activity Log

## 2026-03-23T03:58:37.964Z

- **description**: added (8 lines)
- **related**: (none) → SHR-43

## 2026-03-23T04:00:01.338Z

- **title**: Biome safe autofix broke signal parser while loop — investigate guardrails → Biome --unsafe autofix broke signal parser while loop — investigate guardrails
- **description**: 8 lines → updated (12 lines)
