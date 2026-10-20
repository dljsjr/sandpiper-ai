# How to build and verify Sandpiper changes

Use this guide to select the build and verification commands for a change. For the pipeline and output layout, see [Build system reference](build-system.md).

## Choose the command

| You changed | Build command |
| --- | --- |
| Extension source under `extensions/` | No build; Sandpiper loads the TypeScript source |
| Skills, prompts, themes, or other files under `packages/resources/` | No build |
| `packages/core/` | `bun --filter sandpiper-ai-core build` |
| `packages/cli/` | `bun run build:standalone` |
| `packages/trail/` | `bun run build` so the task skill receives the new executable |
| `packages/sandpiper-standup-cli/` | `bun run build` so the standup skill receives the new executable |
| Root build scripts, package metadata, or several packages | `bun run build` |

## Run tests while developing

Run the smallest relevant Vitest suite first:

```sh
bun run test:vitest -- <testpath>
```

Run both repository gates before completion:

```sh
bun check
bun run test
```

Do not use bare `bun test` as the repository gate. It invokes Bun's test runner instead of the configured Vitest suite.

## Build all local output

```sh
bun run build
```

This command builds core declarations, the Sandpiper runtime, Trail, and the standup helper. It then refreshes the helper executable copies in the task and standup skills.

Use this narrower command when only the Sandpiper runtime changed:

```sh
bun run build:standalone
```

## Smoke-test built commands

```sh
./node_modules/.bin/sandpiper --help
./node_modules/.bin/sandpiper-system-prompt --help
packages/resources/skills/sandpiper/tasks/scripts/trail --help
packages/resources/skills/sandpiper/standup/scripts/sandpiper-standup --help
```

These commands exercise the same workspace paths used for local development.

## Repair common problems

### Sandpiper has not been built

Run:

```sh
bun run build
```

The package bin shims require `packages/cli/dist/standalone/` output.

### A helper skill uses old behavior

Rebuild the workspace:

```sh
bun run build
```

This rebuilds Trail and standup before it copies their executables into the skill directories.

### A dependency cannot be resolved

Install dependencies from the repository root:

```sh
bun install
```

Extensions resolve dependencies from the hoisted root `node_modules/` directory.
