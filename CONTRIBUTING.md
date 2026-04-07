# Contributing to Sandpiper

Welcome! This document is your guide to contributing to Sandpiper — whether you're fixing bugs, adding features, improving documentation, or building extensions.

## Documentation Structure

Sandpiper organizes documentation by **audience**:

| Location | Primary Audience | Purpose |
|----------|------------------|---------|
| [`docs/`](docs/README.md) | **Humans** (users, contributors, maintainers) | User-facing features, contributor guides, architecture docs |
| [`.sandpiper/`](.sandpiper/) | **Agent** | Config, tasks, standup, operational docs the agent reads |

## Routing Table

| You are... | Read this first | Then read |
|------------|-----------------|-----------|
| **End user** | [README.md](README.md) | [`docs/features/`](docs/features/) |
| **Contributor** | This file | [`docs/dev/`](docs/dev/) |
| **Maintainer** | This file | [`docs/architecture/`](docs/architecture/) |
| **Extension developer** | [`docs/dev/pi-dev-suite/`](docs/dev/pi-dev-suite/README.md) | [Routing Table](docs/dev/pi-dev-suite/PI-DEV-ROUTING.md) |
| **Agent** | [AGENTS.md](AGENTS.md) | [`.sandpiper/docs/`](.sandpiper/docs/) |

## For Contributors

### Getting Started

1. **Clone the repo**
   ```bash
   git clone https://github.com/dljsjr/sandpiper-ai.git
   cd sandpiper-ai
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Run tests**
   ```bash
   bun check              # Type-check + lint
   bun --filter sandpiper-tasks-cli test
   bun --filter shell-relay test
   ```

### Documentation Guidelines

When adding documentation:

- **User-facing features** → `docs/features/`
- **Developer guides** → `docs/dev/`
- **Architecture decisions** → `docs/architecture/`
- **Agent-operational docs** → `.sandpiper/docs/`

**Rule of thumb**: If a human reads it to build something, it goes in `docs/`. If the agent reads it as part of its context, it goes in `.sandpiper/`.

### Code Style

- TypeScript with `strict: true`
- No `any` types
- No `@ts-ignore` without justification
- Use `interface` for object shapes
- Use `readonly` where mutation is unnecessary

Run linting before committing:
```bash
bun check
bun check --write  # Auto-fix formatting
```

### Pull Requests

1. Create a branch for your change
2. Make your changes
3. Run tests and linting
4. Submit a PR with a clear description

## For Maintainers

### Repository Structure

```
sandpiper-ai/
├── docs/                    # Human-facing docs
│   ├── README.md            # User docs routing
│   ├── features/            # Feature documentation
│   ├── dev/                 # Developer documentation
│   │   └── pi-dev-suite/    # Extension dev reference
│   └── architecture/        # Architecture decisions
├── .sandpiper/              # Agent-facing docs
│   ├── docs/                # Agent-operational docs
│   ├── tasks/               # Task tracker
│   └── standup.md           # Session continuity
├── extensions/              # Pi extensions
├── packages/                # Workspace packages
└── AGENTS.md                # Agent routing
```

### Documentation Deployment

- **User docs** (`docs/`) → Published to GitHub Pages (future)
- **Dev docs** (`docs/dev/`) → Available in repo for contributors
- **Agent docs** (`.sandpiper/`) → Bundled with Pi package, injected into agent context

### Version Control

Sandpiper uses **Jujutsu (`jj`)** for version control. See [`.sandpiper/docs/agent-guidance-evolution.md`](.sandpiper/docs/agent-guidance-evolution.md) for workflow details.

## Questions?

- **User questions**: Check [`docs/features/`](docs/features/)
- **Contributor questions**: Check [`docs/dev/`](docs/dev/)
- **Agent behavior**: Check [AGENTS.md](AGENTS.md) and [`.sandpiper/docs/`](.sandpiper/docs/)

---

**Last updated**: 2026-04-16
