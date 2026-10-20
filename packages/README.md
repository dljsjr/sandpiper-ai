# Packages

Workspace packages used by the local Sandpiper runtime.

## Contents

| Package | Description |
|---------|-------------|
| [`cli/`](cli/) | Sandpiper CLI wrapper around pi-coding-agent |
| [`capability-autotoon/`](capability-autotoon/) | AutoTOON JSON→TOON neutral transform and Pi adapter |
| [`resources/`](resources/) | Shared skills, prompts, and themes |
| [`trail/`](trail/) | Trail task management CLI (markdown + YAML frontmatter) |
| [`sandpiper-standup-cli/`](sandpiper-standup-cli/) | Session standup helper CLI |
| [`core/`](core/) | Shared core utilities |

## Build

Each package with generated output has its own `build` script. It runs `tsc` for declarations, `bun build` for bundled JavaScript, or both. Package builds are explicit. `bun install` installs dependencies only.

## Output

Built output stays in each package's `dist/` directory. `bun run build` runs the required package build graph and refreshes the Trail and standup executable copies used by local skills.

Packages that produce CLI binaries are linked into `node_modules/.bin/` by Bun when listed as dependencies of the root package. For generated binaries, prefer a stable checked-in `bin/` shim as the package `bin` target so dependency installation does not require build artifacts to exist.
