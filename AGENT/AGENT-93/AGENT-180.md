---
title: "Retire transitional generated Pi and Claude artifacts"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-05-06T20:10:54.308Z
updated_at: 2026-05-07T15:00:35.863Z
---

# Retire transitional generated Pi and Claude artifacts

Retire or correct any remaining transitional generated-artifact assumptions left over from the package-first distribution migration.

Scope:
- Audit generated Pi and Claude artifact paths/manifests for stale source-root assumptions after AGENT-177 through AGENT-179.
- Prefer routing through provider-owned or package-owned source paths: plugins/pi, packages/resources, packages/adapter-claude-code, and packages/cli.
- Remove compatibility artifacts only when they are truly obsolete and covered by distribution tests; otherwise document why they remain.
- Keep the neutral Pi package free of Sandpiper identity/system-prompt/migration/update behavior.

Acceptance criteria:
- No tests or docs rely on retired top-level skills/prompts/themes or legacy root-owned Pi capability paths.
- Distribution/package assembly still produces the expected npm/Pi/Claude outputs.
- Focused distribution tests and bun check pass.

---

# Activity Log

## 2026-05-07T04:30:40.222Z

- **description**: added (12 lines)

## 2026-05-07T04:36:25.054Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-05-07T04:43:04.634Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-07T15:00:35.868Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
