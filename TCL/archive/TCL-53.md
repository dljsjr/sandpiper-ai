---
title: "Investigate project-level metadata and configuration"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-23T03:18:38.748Z
updated_at: 2026-03-27T17:44:37.583Z
---

# Investigate project-level metadata and configuration

Add per-project metadata files (`PROJECT.md`) to the task system so that projects are self-describing and an agent can make confident filing decisions without relying on ambient context.

## Design

### PROJECT.md Format

Each project directory gets a `PROJECT.md` file at `.sandpiper/tasks/<KEY>/PROJECT.md`. Markdown + YAML frontmatter.

```yaml
key: SHR
name: Shell Relay
description: Zellij-based shared terminal session between user and agent
when_to_file: |
  Use for work on the Zellij integration: shell relay extension, shell integration
  scripts (relay.fish/.bash/.zsh), FIFO management, ghost-attach, relay orchestration,
  unbuffer-relay. Does NOT include general agent capabilities or sandpiper infrastructure
  — those go in AGENT.
status: active
created_at: 2026-03-26T00:00:00Z
```

Markdown body holds richer context: Purpose, Scope, and Related Projects sections.

The `when_to_file` field mirrors the skills `description` trigger convention — it is the primary signal an agent uses when deciding where to file a ticket.

### CLI Changes

- `project create <KEY>` — enforces scaffolding of `PROJECT.md`; prompts for name, description, and `when_to_file` (or opens $EDITOR)
- `project update <KEY> [-i] [--name] [--description] [--when-to-file]` — new command to amend project metadata
- `project show <KEY>` — new command; displays full `PROJECT.md` content
- `project list` — enhanced to include name + description from `PROJECT.md` when present
- `project list --format toon` — includes all frontmatter fields including `when_to_file`; this is the primary session-start query
- `task show <KEY> --metadata-only` — returns only the YAML frontmatter, no body or activity log; works for both tasks and projects

### Skill Changes

The tasks skill MUST instruct the agent to run `sandpiper-tasks project list --format toon` at the start of every session to load all `when_to_file` triggers into context.

### Migration

Backfill `PROJECT.md` for all existing projects as part of this ticket's acceptance criteria: SHR, AGENT, TCL, TOOLS, PKM, MEM, WEB.

## Acceptance Criteria

- `PROJECT.md` is created for all new projects (enforced by `project create`)
- All existing projects have `PROJECT.md` backfilled
- `project list --format toon` surfaces complete metadata including `when_to_file`
- `task show --metadata-only` returns frontmatter only for tasks and projects
- SPEC.md updated with §2.x covering `PROJECT.md` format and requirements
- SKILL.md updated with session-start instruction and new command documentation

---

# Activity Log

## 2026-03-23T03:19:16.355Z

- **description**: added (11 lines)

## 2026-03-26T16:25:07.981Z

- **description**: 11 lines → updated (50 lines)

## 2026-03-27T17:44:37.587Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: DONE
