---
title: "Generate shell-appropriate env export commands based on detected shell"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-03-23T04:32:18.406Z
updated_at: 2026-03-23T05:14:46.478Z
---

# Generate shell-appropriate env export commands based on detected shell

index.ts exports FIFO path environment variables using fish `set -gx` syntax unconditionally, but the target pane might be running bash or zsh (which use `export VAR=value`). The detectShell() function already detects the shell type but the env export doesn't use it.

Fix: generate the export command based on detected shell:
- Fish: `set -gx VAR 'value'`
- Bash/Zsh: `export VAR='value'`

Reference: code-review-shr-v1.md Finding 4

---

# Activity Log

## 2026-03-23T04:32:18.431Z

- **description**: added (7 lines)

## 2026-03-23T04:55:28.171Z

- **priority**: MEDIUM → HIGH

## 2026-03-23T05:13:20.381Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-23T05:14:46.478Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: DONE
