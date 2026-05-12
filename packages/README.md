# Packages

Workspace packages — built, tested, and distributed as part of sandpiper.

## Contents

| Package | Description |
|---------|-------------|
| [`cli/`](cli/) | Sandpiper CLI wrapper around pi-coding-agent |
| [`capability-autotoon/`](capability-autotoon/) | AutoTOON JSON→TOON neutral transform and Pi adapter |
| [`adapter-claude-code/`](adapter-claude-code/) | Claude Code hooks/adapters over neutral Sandpiper capabilities |
| [`resources/`](resources/) | Shared skills, prompts, and themes |
| [`trail/`](trail/) | Trail task management CLI (markdown + YAML frontmatter) |
| [`core/`](core/) | Shared core utilities |

## Build

Each package with distributable outputs has its own `build` script that runs `tsc` (for declarations) and/or `bun build` (for bundled JS output). Package builds are explicit; `bun install` installs dependencies only.

## Distribution

Built outputs land in each package's `dist/` directory. `bun run prepare:distribution` runs the Turbo-backed package build graph and then copies outputs into the generated Sandpiper Pi/npm package at top-level `dist/` alongside extension adapters and shared resources from `packages/resources/`.

Packages that produce CLI binaries are linked into `node_modules/.bin/` by Bun when listed as dependencies of the root package. For generated binaries, prefer a stable checked-in `bin/` shim as the package `bin` target so dependency installation does not require build artifacts to exist.
