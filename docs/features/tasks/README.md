# Task Management — Project Task Tracking

Track project work items with a markdown-based task system designed for both humans and AI agents.

## What It Does

Sandpiper's task system provides:

- **Markdown tasks** with YAML frontmatter — readable by humans and agents
- **Project-local tracking** — tasks live in your project's `.sandpiper/tasks/` directory
- **CLI management** — create, update, complete, and query tasks from the command line
- **Flexible storage** — inline on your branch, separate branch, or external repository
- **Cross-session continuity** — active tasks injected into agent context

## Quick Start

### Create a Task

```bash
bun sandpiper-tasks create --title "Implement login feature" --key PROJ
```

### List Tasks

```bash
bun sandpiper-tasks list
bun sandpiper-tasks list --status active
bun sandpiper-tasks list --assignee doug
```

### Update a Task

```bash
bun sandpiper-tasks update PROJ-1 --status "in-progress"
```

### Complete a Task

```bash
bun sandpiper-tasks complete PROJ-1
```

## Storage Modes

Task storage is configured in `.sandpiper-tasks.json` or `.sandpiper/settings.json`:

| Mode | Description | Use Case |
|------|-------------|----------|
| **Inline** (default) | Tasks on current branch | Solo development |
| **Separate branch** | Tasks on dedicated branch | Reduce VCS churn |
| **External repo** | Tasks in separate repository | Shared task tracking |

See [Storage Guide](./storage-guide.md) for configuration details.

## Task File Format

```markdown
---
key: PROJ-1
title: Implement login feature
status: active
created: 2026-04-16T10:00:00Z
---

## Description

Implement user login with OAuth2 support.

## Acceptance Criteria

- [ ] Login form with email/password
- [ ] OAuth2 integration (Google, GitHub)
- [ ] Session management
- [ ] Logout functionality
```

## Commands

| Command | Description |
|---------|-------------|
| `create` | Create a new task |
| `list` | List tasks with filters |
| `show` | Show task details |
| `update` | Update task fields |
| `complete` | Mark task as done |
| `pickup` | Mark task as in-progress |
| `move` | Move task between projects |
| `archive` | Archive completed tasks |
| `storage init` | Initialize separate-branch storage |
| `storage migrate` | Migrate inline tasks to separate branch |
| `storage sync` | Sync task branch with remote |

See [Storage Guide](./storage-guide.md) for storage commands.

## For Agents

Tasks are automatically injected into the agent's context at session start. The agent can:

- Read active tasks for context
- Update task status as work progresses
- Reference task keys in commits
- Create tasks for discovered work

## Related Documentation

- [Architecture](./architecture.md) — Design rationale and configuration model
- [Storage Guide](./storage-guide.md) — Operator guide for storage modes
- [Session Standup](./standup.md) — Cross-session continuity

---

**Last updated**: 2026-04-16  
**CLI**: `bun sandpiper-tasks`
