# Shell Relay Extension Guidelines

This directory follows the repo-wide rules in `../../AGENTS.md`.

Before changing Shell Relay code, read `../../.sandpiper/playbooks/features/shell-relay.md`.

Local invariants:

- Keep framework-independent relay logic under `src/` modules without Pi imports.
- Keep Pi wiring thin in `src/index.ts`, `src/tools/`, `src/commands/`, and `src/runtime.ts`.
- Keep shell integration scripts safe to source in any shell instance; outside relay sessions they must silently no-op.
