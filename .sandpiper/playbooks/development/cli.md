---
name: CLI Development
read_when: building CLI tools, Commander commands, package bin entries, sandpiper CLI, bundled executables, command-line tools
---

# CLI Development

Read this before changing command-line tools or package `bin` metadata.

## Key Rules

- Use Commander for CLI entrypoints and subcommands.
- Keep CLI wiring thin; move core behavior into framework-independent modules.
- Keep the checked-in `packages/cli/bin/` shims stable. The root product owns both bin entries.
- Build root `dist/` before claiming CLI behavior works from generated artifacts.
- Use `bun` as the runtime for Sandpiper-owned tooling unless the package explicitly targets Node.

## Current product

- Root `package.json` owns `sandpiper-ai-cli` and both command names.
- `packages/cli/` holds the `sandpiper` runtime wrapper, system prompt diagnostic, and stable launchers.

## References

- Public CLI guide: `docs/dev/cli-development.md`
- Package docs: `packages/cli/README.md`
