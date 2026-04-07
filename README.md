# Sandpiper

A powerful pair programming coding agent built on [pi-coding-agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent). Sandpiper wraps pi with opinionated extensions, skills, and customizations that create a deeply integrated development companion — one that can see your terminal, manage your tasks, and maintain context across sessions.

Sandpiper is distributed as a [Pi Package](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/packages.md), which means it bundles extensions, skills, prompt templates, and themes into a single installable unit that extends pi's capabilities.

## What Sandpiper Adds

On top of pi's core functionality, Sandpiper provides:

### Core Features

- **[Shell Relay](docs/features/shell-relay.md)** — A shared terminal session via Zellij where both you and the agent can see and interact with the same shell. The agent inherits your session state: auth tokens, shell functions, activated environments, everything. No more copying commands to your terminal — the agent runs them in yours.
- **[Task Management](docs/features/tasks.md)** — A markdown-based task tracker with YAML frontmatter, designed for both humans and agents to read and update. Organize work by project, track status, archive completed items.
- **[Session Continuity](docs/features/standup.md)** — Stand-up notes at the start of each session orient the agent on what was done last time, what's blocked, and what's next. A project directory tracks active projects across repositories.

### Enhanced Capabilities

- **[AutoTOON](docs/features/autotoon.md)** — Automatic JSON→TOON conversion for 30–60% token savings on tabular data. Works transparently in the background.
- **Skill Library** — Curated guidance documents for jj version control, ast-grep structural analysis, Dash documentation lookup, and more. Skills teach the agent domain-specific knowledge without bloating the system prompt.

## Quick Start

Sandpiper requires [pi](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) and [bun](https://bun.sh) to be installed first.

Install pi globally:

```bash
npm install -g @mariozechner/pi-coding-agent
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

- **[Documentation Home](docs/README.md)** — Complete routing table for user-facing docs
- **[AutoTOON](docs/features/autotoon.md)** — Automatic JSON→TOON conversion
- **[Shell Relay](docs/features/shell-relay.md)** — Shared terminal sessions
- **[Task Management](docs/features/tasks.md)** — Project task tracking
- **[Session Standup](docs/features/standup.md)** — Cross-session continuity

### For Contributors

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for:
- Developer documentation
- Extension development guide
- Architecture decisions
- Code style guidelines
- Pull request process

## Repository Layout

```
sandpiper-ai/
├── docs/                # Human-facing documentation
│   ├── README.md        # User docs routing
│   ├── features/        # Feature documentation
│   ├── dev/             # Developer documentation
│   └── architecture/    # Architecture decisions
├── extensions/          # Pi extensions (tools, hooks, lifecycle)
│   ├── system.ts        # Sandpiper identity + update notifications
│   └── shell-relay/     # Shared terminal via Zellij
├── packages/            # Workspace packages (built + distributed)
│   ├── cli/             # Sandpiper CLI wrapper around pi-coding-agent
│   ├── sandpiper-tasks-cli/  # Task management CLI
│   └── core/            # Shared utilities
├── skills/              # Pi skills (agent guidance + companion scripts)
│   ├── sandpiper/       # First-party skills
│   └── third-party/     # Vendored skills
├── prompts/             # Prompt templates
├── themes/              # UI themes
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
bash devtools/postinstall.sh               # Reassemble dist/ and reinstall package
```

## Development

```bash
bun check              # Type-check + lint (tsc + biome)
bun check --write      # Auto-fix formatting
bun check:ast-grep     # Structural code analysis
bun run clean          # Remove node_modules, dist, caches

# Run tests
bun --filter sandpiper-tasks-cli test
bun --filter shell-relay test
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

| Variable | Purpose |
|----------|---------|
| `PI_CODING_AGENT_PACKAGE` | Path to the pi-coding-agent package |
| `PI_CODING_AGENT_VERSION` | Version of the underlying pi-coding-agent |
| `PI_PACKAGE_DIR` | Package directory for loading extensions and skills |
| `PI_SKIP_VERSION_CHECK` | Suppresses pi's built-in update check |

These are set automatically at startup. You generally don't need to interact with them.

## License

MIT
