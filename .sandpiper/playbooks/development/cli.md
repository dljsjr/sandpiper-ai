---
name: CLI Development
read_when: building CLI tools, Commander commands, package bin entries, sandpiper CLI, sandpiper-standup, bundled executables, command-line tools
---

# CLI Development

Read this before changing command-line tools or package `bin` metadata.

## Key Rules

- Use Commander for CLI entrypoints and subcommands.
- Keep CLI wiring thin; move core behavior into framework-independent modules.
- Keep checked-in `bin/` shims stable; Bun workspace bin links resolve before lifecycle scripts produce fresh `dist/` outputs.
- Build package-owned binaries before claiming CLI behavior works from generated artifacts.
- Use `bun` as the runtime for Sandpiper-owned tooling unless the package explicitly targets Node.

## Current CLI Packages

- `packages/cli/` — `sandpiper` runtime wrapper and system prompt diagnostic
- `packages/sandpiper-standup-cli/` — standup/session-continuity CLI

## References

- Public CLI guide: `docs/dev/cli-development.md`
- Package docs: `packages/cli/README.md`, `packages/sandpiper-standup-cli/package.json`
