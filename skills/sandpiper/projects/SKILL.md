---
name: projects
description: >-
  Manage the project directory — a registry of active projects the user works on
  across different repositories. Use when starting a session to check for cross-project
  context, when the user mentions other projects, when referencing work in a different
  repo (e.g., "this relates to MEM-1 in sandpiper-ai"), when you notice the current
  directory isn't registered, or when asked "what projects am I working on?", "show
  me my projects", or "add this project". Also use when creating a new repo that
  should be tracked. The directory lives at ~/.sandpiper/agent/projects.toon.
---

# Project Directory Skill

Maintain a registry of active projects so the agent can build cross-project awareness at session start.

## Where the Directory Lives

```
~/.sandpiper/agent/projects.toon
```

This is a global file (not per-project) because its purpose is to connect projects together.

## Format

The directory uses TOON format with a simple schema:

```toon
version: 1
projects:
  project-name:
    path: /absolute/path/to/project
    description: Brief description of what the project is
    active: true
```

Each project entry has:
- **key** — a short identifier (typically the repo directory name)
- **path** — absolute path to the project root
- **description** — one-line summary of the project
- **active** — `true` if currently being worked on, `false` to hide from session start scans

## Operations

### Add a project

When starting work in a new repository, add it to the directory:

```toon
  new-project:
    path: /home/user/projects/new-project
    description: What this project does
    active: true
```

Add projects when:
- The user opens a repo for the first time
- The user says "add this project" or "track this project"
- You notice you're working in a directory not in the registry

### Deactivate a project

Don't delete entries — set `active: false` to hide them from session-start scans while preserving the record:

```toon
  old-project:
    path: /home/user/projects/old-project
    description: No longer actively maintained
    active: false
```

### List projects

Read the file and report active projects:

```bash
cat ~/.sandpiper/agent/projects.toon
```

## Session Start Workflow

At the start of a session, after reading the current project's stand-up:

1. Read `~/.sandpiper/agent/projects.toon`
2. Check if the current working directory is in the registry — if not, offer to add it
3. For each **active** project, optionally scan its `.sandpiper/standup.md` for cross-project context
4. Mention any relevant cross-project information (e.g., "the other project has a blocker that might affect this one")

Don't read every project's stand-up every time — that would be noisy. Only scan other projects when:
- The user asks about them
- The current project references another (via task dependencies, shared code, etc.)
- The session is starting fresh and orientation is needed

## Relationship to Other Artifacts

- **Stand-ups** are per-project session notes. The project directory connects them.
- **Tasks** are per-project work items. The directory enables cross-project task queries.
- **AGENTS.md** is per-project guidelines. The directory maps which projects exist.
- **PKM** (future) will be global knowledge. The directory is the project-level equivalent.
