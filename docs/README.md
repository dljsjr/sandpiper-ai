# Sandpiper Documentation

Welcome to the Sandpiper documentation. This directory contains **user-facing documentation** for the Sandpiper harness — a distribution of the Pi coding agent with enhanced capabilities.

## For Users

If you're using Sandpiper as your AI coding assistant:

- **[Features](./features/)** — What Sandpiper can do
  - [AutoTOON](./features/autotoon.md) — Automatic JSON→TOON conversion for token efficiency
  - [Shell Relay](./features/shell-relay.md) — Shared terminal sessions via Zellij
  - [Task Management](./features/tasks.md) — Project task tracking with CLI
  - [Session Continuity](./features/standup.md) — Cross-session context handoff

- **[Guides](./guides/)** — How to use Sandpiper effectively
  - Getting Started (coming soon)
  - Best Practices (coming soon)
  - Configuration (coming soon)

## For Developers

If you're building extensions or integrating with Sandpiper:

- **[Architecture](./architecture/)** — How Sandpiper works
  - System Overview (coming soon)
  - Extension API (coming soon)

- **Pi Developer Documentation Suite** — Extension development reference
  - Location: `.sandpiper/docs/pi-dev-suite/`
  - 14 comprehensive docs covering Pi extension development
  - Sandpiper-specific patterns in `PI-DEV-SANDPIPER-PATTERNS.md`

## Documentation Structure

```
docs/
├── README.md              # This file
├── features/              # User-facing feature documentation
│   ├── autotoon.md        # AutoTOON feature
│   └── ...                # Other features
├── guides/                # User guides and tutorials
│   └── ...                # Coming soon
└── architecture/          # Technical architecture docs
    └── ...                # Coming soon
```

## Internal vs External Documentation

| Audience | Location | Purpose |
|----------|----------|---------|
| **Users** | `docs/` (this directory) | Feature documentation, guides, tutorials |
| **Extension Developers** | `.sandpiper/docs/pi-dev-suite/` | Pi extension API reference |
| **Sandpiper Maintainers** | `.sandpiper/docs/` | Internal architecture, design decisions, planning docs |
| **Historical/Archived** | `.sandpiper/archive/` | Superseded docs preserved for reference |

## Contributing

When adding new documentation:

1. **User-facing features** → `docs/features/`
2. **User guides/tutorials** → `docs/guides/`
3. **Architecture/technical** → `docs/architecture/`
4. **Internal guidance** → `.sandpiper/docs/`
5. **Extension development** → `.sandpiper/docs/pi-dev-suite/`

Keep user-facing docs in `docs/` focused on **what** and **how**, not implementation details.

