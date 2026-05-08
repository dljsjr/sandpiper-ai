# Sandpiper

A powerful pair programming coding agent built on [pi-coding-agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent). Sandpiper wraps pi with opinionated extensions, skills, and customizations that create a deeply integrated development companion — one that can see your terminal, manage your tasks, and maintain context across sessions.

Sandpiper is a package-first monorepo with multiple install surfaces: the normal `sandpiper` runtime, a neutral Pi package surface, and a Claude Code plugin artifact. The repository root is a router/workspace package; implementation resources live under `packages/` and provider-specific adapter directories.

## What Sandpiper Adds

On top of pi's core functionality, Sandpiper provides:

### Core Features

- **[Shell Relay](docs/features/shell-relay.md)** — A shared terminal session via Zellij where both you and the agent can see and interact with the same shell. The agent inherits your session state: auth tokens, shell functions, activated environments, everything. No more copying commands to your terminal — the agent runs them in yours.
- **[Task Management](docs/features/tasks/README.md)** — A markdown-based task tracker with YAML frontmatter, designed for both humans and agents to read and update. Organize work by project, track status, archive completed items.
- **[Session Continuity](docs/features/standup.md)** — Stand-up notes at the start of each session orient the agent on what was done last time, what's blocked, and what's next. A project directory tracks active projects across repositories.

### Enhanced Capabilities

- **[AutoTOON](docs/features/autotoon.md)** — Automatic JSON→TOON conversion for 30–60% token savings on tabular data. Works transparently in the background.
- **Skill Library** — Curated guidance documents for jj version control, ast-grep structural analysis, Dash documentation lookup, and more. Skills teach the agent domain-specific knowledge without bloating the system prompt.

## Quick Start

Sandpiper requires [pi](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) and [bun](https://bun.sh) to be installed first.

Install pi globally:

```bash
npm install -g @earendil-works/pi-coding-agent
```

Then clone and set up sandpiper:

```bash
git clone https://github.com/dljsjr/sandpiper-ai.git
cd sandpiper-ai
bun install          # Install deps + build workspace packages
bun sandpiper        # Launch sandpiper (interactive mode)
```

> **Note:** `bun install` may need to run twice on a clean checkout due to a [known issue with workspace bin linking](https://github.com/oven-sh/bun/issues/19782). This is a bun behavior, not a sandpiper bug.

## Documentation

### For Users

- **[Documentation Home](docs/README.md)** — Start here for feature and development docs
- **[AutoTOON](docs/features/autotoon.md)** — Automatic JSON→TOON conversion
- **[Shell Relay](docs/features/shell-relay.md)** — Shared terminal sessions
- **[Task Management](docs/features/tasks/README.md)** — Project task tracking
- **[Session Standup](docs/features/standup.md)** — Cross-session continuity

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
├── packages/            # Workspace packages (built + distributed)
│   ├── cli/             # Sandpiper CLI wrapper around pi-coding-agent
│   ├── resources/       # Shared skills, prompts, and themes
│   ├── sandpiper-tasks-cli/  # Task management CLI
│   ├── sandpiper-standup-cli/ # Standup/session-continuity CLI
│   └── core/            # Shared utilities
├── plugins/             # Provider install surfaces
│   └── pi/              # Neutral Pi package adapters
├── ast-grep/            # Structural code analysis rules
├── devtools/            # Build scripts (not distributed)
└── dist/                # Distribution output (generated)
```

## Building

Workspace packages with real build outputs are built automatically during `bun install` via `preinstall` scripts. To rebuild manually:

```bash
bun run build                              # Build the sandpiper CLI
bun --filter sandpiper-tasks-cli run build # Rebuild tasks CLI
bun --filter sandpiper-ai-core run build   # Rebuild core package declarations/dist
bash devtools/postinstall.sh               # Reassemble dist/ (legacy Pi package install is opt-in)
```

## Development

```bash
bun check                         # Dependency policy + type-check + lint
bun run check:deps                # Syncpack dependency version policy
bun run test                      # Full Vitest gate; prepares dist and unsets PI_PACKAGE_DIR
bun run test:vitest -- <testpath> # Focused Vitest run without distribution prep
bun run test:distribution         # Package/distribution smoke gate
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
- `.sandpiper/standup.md` — session stand-up note
- `.sandpiper/tasks/` — task tracker

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

A small number of `PI_*` variables are used internally by sandpiper to configure the underlying pi runtime and are not mirrored to the `SANDPIPER_*` namespace:

| Variable                  | Purpose                                             |
| ------------------------- | --------------------------------------------------- |
| `PI_CODING_AGENT_PACKAGE` | Path to the pi-coding-agent package                 |
| `PI_CODING_AGENT_VERSION` | Version of the underlying pi-coding-agent           |
| `PI_PACKAGE_DIR`          | Package directory for loading extensions and skills |
| `PI_SKIP_VERSION_CHECK`   | Suppresses pi's built-in update check               |

These are set automatically at startup. You generally don't need to interact with them.

## License

MIT
