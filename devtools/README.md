# Devtools

Development scripts and build utilities for this workspace.

## Scripts

| Script | Purpose |
| --- | --- |
| `syncSkillHelpers.ts` | Copies built Trail and standup executables into their local skill directories |
| `stageCliResources.ts` | Refreshes helper executables and stages resources and public docs in the CLI package |
| `packCli.ts` | Packs the CLI with patched dependencies through a temporary package directory |
| `clean.ts` | Removes dependencies, generated output, and caches |
| `adoptTrailBoard.ts` | Creates Trail v2 configuration for one legacy task board without moving its data |

## Build flow

`bun install` installs dependencies only. `bun run build` performs the explicit workspace build:

```text
bun run build
  → Turbo builds core, Trail, and standup before the CLI
  → CLI build bundles built-in extensions
  → stageCliResources.ts refreshes local helpers and stages resources and docs
```

Package output stays under the package that owns it. Startup reads the real CLI package metadata and does not create a package sidecar.

Use `bun run build:standalone` for the CLI and its helper prerequisites. Use `bun run sync:skill-helpers` only after the Trail and standup packages are built.

Use `bun run pack:cli` to write an npm-compatible tarball under `packages/cli/dist/`. The pack wrapper exposes hoisted workspace dependencies in a temporary directory so `bun pm pack` includes the patched runtime. It does not publish to a registry.

## Trail board adoption

Use `adoptTrailBoard.ts` to make an existing Sandpiper board readable by standalone Trail. It keeps task files, history, indexes, and workspaces unchanged.

Inspect one board:

```sh
bun --bun devtools/adoptTrailBoard.ts --dir /path/to/project --tasks-dir .sandpiper/tasks --dry-run
```

Apply the same request without `--dry-run`:

```sh
bun --bun devtools/adoptTrailBoard.ts --dir /path/to/project --tasks-dir .sandpiper/tasks
```

The utility creates `.trail/config.json`. The task-directory argument is required. Relative paths resolve against `--dir`. Absolute paths are also supported. Use `--config-file <path>` to override legacy discovery.

The utility does not relocate boards or change installed consumers. The [adoption specification](../.sandpiper/docs/specs/trail-board-adoption.md) defines discovery, preservation, and refusal rules.

## Integration tests

[`integration/`](./integration/) contains the headless CLI and remote procedure call (RPC) integration tests. They start real `pi` or `sandpiper` processes with mock providers and isolated configuration directories.

See [`integration/README.md`](./integration/README.md) and the [AGENT-249 harness design](../.sandpiper/docs/specs/agent-249-headless-cli-integration-harness-design.md).
