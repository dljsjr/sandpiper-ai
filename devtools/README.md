# Devtools

Development scripts and build utilities for this workspace.

## Scripts

| Script | Purpose |
| --- | --- |
| `syncSkillHelpers.ts` | Copies built Trail and standup executables into their local skill directories |
| `clean.ts` | Removes dependencies, generated output, and caches |
| `adoptTrailBoard.ts` | Creates Trail v2 configuration for one legacy task board without moving its data |

## Build flow

`bun install` installs dependencies only. `bun run build` performs the explicit workspace build:

```text
bun run build
  → Turbo builds core, CLI, Trail, and standup package output
  → syncSkillHelpers.ts copies the Trail and standup executables into local skills
```

Package output stays under the package that owns it. The root `dist/` directory is not a release artifact. The runtime can create a small package-metadata sidecar there when Sandpiper starts from a source checkout.

Use `bun run build:standalone` when only the `sandpiper` and `sandpiper-system-prompt` bundles are needed. Use `bun run sync:skill-helpers` only after the Trail and standup packages have been built.

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
