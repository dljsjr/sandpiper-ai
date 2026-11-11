# Sandpiper Documentation

Sandpiper is a local coding-agent workspace built on Pi. It adds AutoTOON conversion, peer messaging between sessions, and web fetch and search tools.

## Start here

- [Repository README](../README.md) - what Sandpiper is and how to run it.
- [Contributing](../CONTRIBUTING.md) - local development workflow and checks.
- [Directory layout](concepts/directory-layout.md) - how global and project `.sandpiper` directories are organized.

## Features

- [AutoTOON](features/autotoon.md) - automatic JSON-to-TOON conversion for token efficiency.
- [Journal](features/journal.md) - optional standalone continuation notes.

## Development

- [Build workflows](dev/build-workflows.md) - choose the right build or verification command after a change.
- [Build system reference](dev/build-system.md) - the root product, runtime dependencies, and generated output.
- [CLI development](dev/cli-development.md) - Commander patterns and bundled CLI packages.
- [Environment variables](dev/env-vars.md) - `SANDPIPER_*` / `PI_*` mirroring and config lookup.
- [Pi extension development](dev/pi-extension-development.md) - how Sandpiper uses Pi extension surfaces and where to check Pi API docs.
- [Cross-extension prompt contributions](dev/prompt-contributions.md) - lifecycle-based coordination for extensions contributing system prompt content.

## Package and extension entrypoints

- [Packages](../packages/README.md)
- [Extensions](../extensions/README.md)

Agent operating rules for this repository live in [AGENTS.md](../AGENTS.md) and `.sandpiper/playbooks/`; they are separate from the public documentation.
