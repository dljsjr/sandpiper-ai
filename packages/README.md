# Packages

Workspace packages — built, tested, and distributed as part of sandpiper.

## Contents

| Package | Description |
|---------|-------------|
| [`cli/`](cli/) | Sandpiper CLI wrapper around pi-coding-agent |
| [`sandpiper-tasks-cli/`](sandpiper-tasks-cli/) | Task management CLI (markdown + YAML frontmatter) |
| [`core/`](core/) | Shared core utilities |

## Build

Each package has its own `build` script that runs `tsc` (for declarations) + `bun build` (for the bundled JS output). Packages are also built during `bun install` via `preinstall` scripts (without `tsc`, to avoid circular dependency on the TypeScript binary).

## Distribution

Built outputs land in each package's `dist/` directory. The root `postinstall` script copies these into the top-level `dist/` for distribution alongside extensions, skills, prompts, and themes.

Packages that produce CLI binaries are symlinked into `node_modules/.bin/` by bun when listed as dependencies of the root package.
