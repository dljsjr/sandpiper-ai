# Sandpiper

A powerful pair programming coding agent built on [pi-coding-agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent). Sandpiper wraps pi with opinionated extensions, skills, and customizations that create a deeply integrated development companion — one that can see your terminal, manage your tasks, and maintain context across sessions.

The repository builds the `sandpiper` runtime and its system-prompt diagnostic. The CLI also runs from a packed npm installation without a source checkout.

## What Sandpiper Adds

On top of pi's core functionality, Sandpiper provides:

### Core Features

- **[Shell Relay](docs/features/shell-relay.md)** — A shared terminal session via Zellij where both you and the agent can see and interact with the same shell. The agent inherits your session state: auth tokens, shell functions, activated environments, everything. No more copying commands to your terminal — the agent runs them in yours.
- **[Session Continuity](docs/features/journal.md)** — The optional standalone Journal skill records short developments and continuation context. A project directory tracks active projects across repositories.

### Enhanced Capabilities

- **[AutoTOON](docs/features/autotoon.md)** — Automatic JSON→TOON conversion for 30–60% token savings on tabular data. Works transparently in the background.
- **Skill Library** — First-party guidance for jj, code review, refactoring, mutation testing and session continuity. Skills add domain knowledge without putting their full contents in the system prompt.

## Quick Start

Sandpiper requires [Bun](https://bun.sh). Clone and set up the workspace:

```bash
git clone https://github.com/dljsjr/sandpiper-ai.git
cd sandpiper-ai
bun install          # Install dependencies only
bun run build        # Build the runtime and local helpers
bun sandpiper        # Launch Sandpiper in interactive mode
```

> **Note:** `bun install` may need to run twice on a clean checkout due to a [known issue with workspace bin linking](https://github.com/oven-sh/bun/issues/19782). This is a bun behavior, not a sandpiper bug.

## Documentation

### For Users

- **[Documentation Home](docs/README.md)** — Start here for feature and development docs
- **[AutoTOON](docs/features/autotoon.md)** — Automatic JSON→TOON conversion
- **[Shell Relay](docs/features/shell-relay.md)** — Shared terminal sessions
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
├── extensions/          # Pi extension packages and compatibility entrypoints
│   ├── system/          # Sandpiper identity + system capabilities
│   └── shell-relay/     # Shared terminal via Zellij
├── packages/            # Workspace packages and package-owned output
│   ├── cli/             # Sandpiper CLI wrapper around pi-coding-agent
│   ├── resources/       # First-party skills, prompts, and themes
│   └── core/            # Shared utilities
├── ast-grep/            # Structural code analysis rules
└── devtools/            # Build and project utilities
```

## Building

`bun install` installs dependencies only. `bun run build` builds the workspace runtime and helper executables:

```bash
bun run build             # Build all required workspace output
bun run build:standalone  # Build the CLI and its helper prerequisites
bun run build:packages    # Build package-owned output through Turbo
bun run pack:cli          # Create an npm-compatible CLI tarball
```

See [Pack the CLI](docs/dev/build-workflows.md#pack-the-cli) for tarball installation and verification. The installed CLI requires Bun. Its helper scripts require Node.

## Development

```bash
bun check                         # Dependency policy + type-check + lint
bun run check:deps                # Syncpack dependency version policy
bun run test                      # Full Vitest gate; unsets PI_PACKAGE_DIR
bun run test:vitest -- <testpath> # Focused Vitest run
bun check --write                 # Auto-fix formatting
bun check:ast-grep                # Structural code analysis
bun run clean                     # Remove node_modules, dist, caches

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

| Variable                            | Purpose                                             |
| ----------------------------------- | --------------------------------------------------- |
| `SANDPIPER_CODING_AGENT_PACKAGE`    | Path to the Sandpiper package root, including shipped public docs |
| `PI_CODING_AGENT_PACKAGE`           | Path to Pi code, themes, UI assets, and export templates |
| `PI_CODING_AGENT_VERSION`           | Version of the underlying pi-coding-agent           |
| `PI_PACKAGE_DIR`                    | Real CLI package root for product metadata and documentation |
| `PI_SKIP_VERSION_CHECK`             | Suppresses pi's built-in update check               |

`SANDPIPER_CODING_AGENT_PACKAGE` and `PI_CODING_AGENT_PACKAGE` intentionally point to different package roots.

## License

MIT
