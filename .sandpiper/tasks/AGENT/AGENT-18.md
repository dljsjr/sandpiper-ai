---
title: "Inject project metadata triggers into system prompt"
status: NOT STARTED
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-27T15:34:32.864Z
depends_on:
  - TCL-70
updated_at: 2026-03-27T15:34:46.455Z
---

# Inject project metadata triggers into system prompt

Extract `when_to_read` triggers from `.sandpiper/tasks/*/PROJECT.md` frontmatter and inject them into the system prompt during `before_agent_start`, using XML format that mirrors the existing skill injection pattern.

The agent currently has no awareness of project routing unless it explicitly reads project metadata at session start. By injecting triggers into the system prompt, the agent can make informed decisions about which project to consult without consuming context on the full PROJECT.md files.

Proposed format:
```xml
<available_projects>
  <project>
    <key>SHR</key>
    <description>Use for work on the Zellij integration...</description>
    <location>.sandpiper/tasks/SHR/PROJECT.md</location>
  </project>
</available_projects>
```

Depends on TCL-70 (when_to_file → when_to_read rename).

---

# Activity Log

## 2026-03-27T15:34:46.370Z

- **depends_on**: (none) → TCL-70

## 2026-03-27T15:34:46.455Z

- **description**: added (16 lines)
