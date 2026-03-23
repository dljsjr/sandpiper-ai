---
title: "Implement command escaping"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-23T04:32:36.719Z
---

# Implement command escaping

Escape the command string into a single safe token before injection:

- **Fish:** `string escape --style=script` (invoke via `fish -c` or implement rules in TypeScript)
- **Bash/Zsh:** `printf '%q'`

The escaped command is passed as the argument to `__relay_run`, which unescapes and `eval`s it.

Thorough testing of round-trip escaping with adversarial inputs is critical (see test suite task).

**Reference:** FR-3

---

# Activity Log

## 2026-03-23T04:32:36.719Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
