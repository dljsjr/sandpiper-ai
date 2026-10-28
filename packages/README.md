# Packages

Workspace packages used by the local Sandpiper runtime.

## Contents

| Package                                        | Description                                         |
| ---------------------------------------------- | --------------------------------------------------- |
| [`cli/`](cli/)                                 | Sandpiper CLI wrapper around pi-coding-agent        |
| [`capability-autotoon/`](capability-autotoon/) | AutoTOON JSON→TOON neutral transform and Pi adapter |
| [`resources/`](resources/)                     | Resource staging and metadata                       |
| [`core/`](core/)                               | Shared core utilities                               |

## Build

Each package with generated output has its own `build` script. It runs `tsc` for declarations, `bun build` for bundled JavaScript, or both. Package builds are explicit. `bun install` installs dependencies only.

## Output

Built output stays in each package's `dist/` directory. The CLI build also stages public documentation under its ignored `docs/` directory. `bun run build` stages the built-in resources in the CLI package.

`bun run pack:cli` creates an npm-compatible tarball under `packages/cli/dist/`. It includes the patched Pi runtime and does not publish to a registry.

Packages that produce CLI binaries are linked into `node_modules/.bin/` by Bun when listed as dependencies of the root package. For generated binaries, prefer a stable checked-in `bin/` shim as the package `bin` target so dependency installation does not require build artifacts to exist.
