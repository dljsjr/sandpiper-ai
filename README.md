# Sandpiper

A powerful pair programming coding agent built on [pi-coding-agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent). Sandpiper wraps pi with opinionated extensions, skills, and customizations that create a deeply integrated development companion — one that can manage your tasks and maintain context across sessions.

The repository builds the `sandpiper` runtime and its system-prompt diagnostic. The CLI also runs from a packed npm installation without a source checkout.

## What Sandpiper Adds

On top of pi's core functionality, Sandpiper provides:

### Core Features

- **[Session Continuity](docs/features/journal.md)** — The optional standalone Journal skill records short developments and continuation context.

### Enhanced Capabilities

- **[AutoTOON](docs/features/autotoon.md)** — Automatic JSON→TOON conversion to cut token use on tabular data. Works transparently in the background.
- **Skill Support** — Load project-local or separately installed skills. Skills add domain knowledge without putting their full contents in the system prompt.

## Quick Start

Sandpiper requires [Bun](https://bun.sh) 1.4.4 or later. The repository pins Bun 1.4.4. Clone and set up the repository:

```bash
git clone https://github.com/dljsjr/sandpiper-ai.git
cd sandpiper-ai
bun install                # Install dependencies only
bun run build              # Build both commands under root dist/
packages/cli/bin/sandpiper  # Launch Sandpiper in interactive mode
```

## Documentation

### For Users

- **[Documentation Home](docs/README.md)** — Start here for feature and development docs
- **[AutoTOON](docs/features/autotoon.md)** — Automatic JSON→TOON conversion
- **[Journal](docs/features/journal.md)** — Cross-session continuity

### For Contributors

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for local development workflow, checks, code style, and documentation guidance.

## Repository Layout

```
sandpiper-ai/
├── docs/                # Human-facing documentation
│   ├── README.md        # User docs routing
│   ├── features/        # Feature documentation
│   ├── dev/             # Developer documentation
│   └── concepts/        # Conceptual/reference documentation
├── extensions/          # Pi extensions
│   ├── system/          # Sandpiper identity + system capabilities
│   ├── autotoon/        # AutoTOON adapter
│   ├── tattler/         # Peer messaging
│   ├── chorus.ts        # Chorus rooms (parked, not loaded)
│   ├── web-fetch/       # web_fetch tool
│   └── web-search/      # web_search tool
├── dist/                # Built entrypoints and shared chunks
├── packages/            # CLI and shared core source modules
│   ├── cli/             # Sandpiper entrypoints and stable bin launchers
│   └── core/            # Shared utilities
└── devtools/            # Build regressions and isolated integration tests
```

## Building

The root package is the `sandpiper-ai-cli` product. `bun install` installs dependencies only. Build and pack it explicitly:

```bash
bun run build     # Build both commands and shared chunks under root dist/
bun run pack:cli  # Build, then pack the root product under dist/
```

`pack:cli` uses ordinary `bun pm pack --ignore-scripts --destination ./dist`, not a pack wrapper. The package includes root documentation, the license, and patched runtime dependencies directly. It ships no built-in skills, prompt templates, or custom themes.

See [Pack the CLI](docs/dev/build-workflows.md#pack-the-cli) for tarball installation and verification. The installed CLI requires Bun. Optional standalone Journal requires Node 24 or later.

## Development

```bash
bun check                         # Type-check + lint + unused code/dependency checks
bun run test                      # Build and run the full Vitest gate
bun run test:vitest -- <testpath> # Focused Vitest run
bun run check:biome-check --write # Apply safe Biome fixes

# Do not use bare `bun test` as the repo health gate; it invokes Bun's runner, not Vitest.
```

## Configuration

Sandpiper uses `~/.sandpiper/agent/` for global config and `.sandpiper/` for project-local config — distinct from pi's `~/.pi/agent/` and `.pi/` directories. This allows sandpiper and pi to coexist on the same system with separate settings.

Key files:

- `~/.sandpiper/agent/settings.json` — global settings, installed packages
- `~/.sandpiper/agent/AGENTS.md` — global agent guidelines
- `.sandpiper/settings.json` — project settings
- `.sandpiper/journal.md` — continuation entries when Journal is installed

## Environment Variables

Sandpiper is fully backwards-compatible with pi's `PI_*` environment variables. Any `PI_*` variable that pi supports will also work with sandpiper — for example, `PI_OFFLINE=1` will disable network requests.

Every `PI_*` variable also has a corresponding `SANDPIPER_*` variant. You can use either:

```bash
PI_OFFLINE=1 sandpiper          # works
SANDPIPER_OFFLINE=1 sandpiper   # also works
```

When both are set, `SANDPIPER_*` takes precedence:

```bash
# SANDPIPER_OFFLINE wins — offline mode is enabled
PI_OFFLINE=0 SANDPIPER_OFFLINE=1 sandpiper
```

A small number of package/runtime variables are set automatically by sandpiper and are not normal mirrored user configuration:

| Variable                         | Purpose                                                           |
| -------------------------------- | ----------------------------------------------------------------- |
| `SANDPIPER_CODING_AGENT_PACKAGE` | Path to the Sandpiper package root, including shipped public docs |
| `PI_CODING_AGENT_PACKAGE`        | Path to Pi code, themes, UI assets, and export templates          |
| `PI_CODING_AGENT_VERSION`        | Version of the underlying pi-coding-agent                         |
| `PI_PACKAGE_DIR`                 | Root product package for metadata and documentation               |

`SANDPIPER_CODING_AGENT_PACKAGE` and `PI_CODING_AGENT_PACKAGE` intentionally point to different package roots.

## License

MIT
