# Build system reference

Sandpiper runs from this Bun workspace. Build output stays beside the package that owns it. The build does not assemble a release package at the repository root.

Use this page to understand the build structure. For commands, see [How to build and verify Sandpiper changes](build-workflows.md).

## Pipeline

`bun run build` has two stages:

1. Turborepo builds the required package outputs.
2. `devtools/syncSkillHelpers.ts` copies the built Trail and standup executables into their local skill directories.

`bun install` only installs dependencies. It does not run either stage.

## Package output

| Package | Build output |
| --- | --- |
| `packages/cli/` | `sandpiper`, `sandpiper-system-prompt`, and shared JavaScript chunks under `dist/standalone/` |
| `packages/core/` | TypeScript declarations under `dist/` |
| `packages/trail/` | Bundled Trail executable at `dist/trail` |
| `packages/sandpiper-standup-cli/` | Bundled standup executable at `dist/sandpiper-standup` |

Pi loads extensions from source TypeScript through jiti. Extensions do not have a separate build step.

The runtime may create `dist/standalone-package/package.json` when it starts from a source checkout. This small ignored sidecar gives Pi the package metadata it needs. It is not a release artifact.

## Task orchestration

The root `build:packages` script uses Turborepo to build these packages:

- `sandpiper-ai-core`
- `sandpiper-standup-cli`
- `@sandpiper-ai/trail`
- `sandpiper-ai-cli`

`turbo.json` defines dependency order and caches package-local `dist/**` output. The root `build` script then runs `sync:skill-helpers`.

The helper sync copies:

- `packages/trail/dist/trail` to `packages/resources/skills/sandpiper/tasks/scripts/trail`
- `packages/sandpiper-standup-cli/dist/sandpiper-standup` to `packages/resources/skills/sandpiper/standup/scripts/sandpiper-standup`

Both copies are marked executable.

## Dependency resolution

The workspace uses Bun's hoisted linker:

```toml
# bunfig.toml
[install]
linker = "hoisted"
```

Extension dependencies resolve from the root `node_modules/` directory.

The source manifest policy is:

- Do not use `catalog:` dependency specifications.
- Use `workspace:*` for local dependencies in the root package.
- Use exact versions for package-level internal and registry dependencies.
- Do not use wildcards, tags, caret ranges, or tilde ranges.

`bun run check:deps` enforces this policy with Syncpack.

## Local Pi patch

Sandpiper carries a local patch of `@earendil-works/pi-coding-agent`. The patch is stored under `patches/` and applied by `bun install` through `patchedDependencies` in the root `package.json`.

The patch changes Pi's compiled `dist/core/system-prompt.js`. It keeps Pi's `tools` and `rules` sections when Sandpiper supplies a custom prompt. The [Sandpiper system prompt architecture](../../.sandpiper/docs/specs/sandpiper-system-prompt.md) describes the behavior.

The patch applies to Sandpiper runs from this workspace. It is tied to an exact Pi version. Redo it after each Pi upgrade:

1. Update the version pins. Run `bun patch @earendil-works/pi-coding-agent` and reapply the changes marked `Sandpiper local patch` in the old patch file.
2. Run `bun patch --commit 'node_modules/@earendil-works/pi-coding-agent'`. Delete `.bun-tag-*` entries from the new patch file. Remove the old version's patch file if Bun leaves it under `patches/`.
3. Run `bun run test:vitest -- extensions/system/prompt-ownership.test.ts`, then run the full checks.

## Verification

Use `bun check` for dependency policy, type checks, structural rules, and lint. Use `bun run test` for the full Vitest suite.

When command output changes, build first and smoke-test the workspace bins:

```sh
bun run build
./node_modules/.bin/sandpiper --help
./node_modules/.bin/sandpiper-system-prompt --help
packages/resources/skills/sandpiper/tasks/scripts/trail --help
packages/resources/skills/sandpiper/standup/scripts/sandpiper-standup --help
```

## Related docs

- [How to build and verify Sandpiper changes](build-workflows.md)
- [Pi extension development](pi-extension-development.md)
- [Contributing guide](../../CONTRIBUTING.md)
