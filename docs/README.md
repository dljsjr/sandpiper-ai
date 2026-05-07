# Sandpiper Documentation

Sandpiper is a distribution of the Pi coding agent with additional tools for shared terminals, task tracking, session continuity, skills, prompt templates, themes, and multi-surface packaging.

## Start here

- [Repository README](../README.md) - what Sandpiper is and how to run it.
- [Contributing](../CONTRIBUTING.md) - local development workflow and checks.
- [Directory layout](concepts/directory-layout.md) - how global and project `.sandpiper` directories are organized.

## Features

- [AutoTOON](features/autotoon.md) - automatic JSON-to-TOON conversion for token efficiency.
- [Shell Relay](features/shell-relay.md) - shared terminal sessions through Zellij.
- [Task Management](features/tasks/README.md) - project task tracking with `sandpiper-tasks`.
- [Session Standup](features/standup.md) - handoff notes for continuity across sessions.

## Development

- [Build workflows](dev/build-workflows.md) - choose the right build or verification command after a change.
- [Build system reference](dev/build-system.md) - package builds, generated artifacts, and distribution layout.
- [CLI development](dev/cli-development.md) - Commander patterns and bundled CLI packages.
- [Environment variables](dev/env-vars.md) - `SANDPIPER_*` / `PI_*` mirroring and config lookup.
- [Pi extension development](dev/pi-extension-development.md) - how Sandpiper uses Pi extension surfaces and where to check Pi API docs.

## Task system

- [Task overview](features/tasks/README.md)
- [Task storage modes](features/tasks/storage-guide.md)
- [Task storage architecture](features/tasks/architecture.md)

## Package and extension entrypoints

- [Packages](../packages/README.md)
- [Extensions](../extensions/README.md)
- [Neutral Pi plugin surface](../plugins/pi/README.md)

Agent operating rules for this repository live in [AGENTS.md](../AGENTS.md) and `.sandpiper/playbooks/`; they are separate from the public documentation.
