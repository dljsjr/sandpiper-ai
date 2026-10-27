# Build system reference

Sandpiper builds in this Bun workspace and runs from either the checkout or a packed CLI installation. Build output stays beside the package that owns it.

Use this page to understand the build structure. For commands, see [How to build and verify Sandpiper changes](build-workflows.md).

## Pipeline

`bun run build` runs the package graph through Turborepo. The CLI build stages its built-in resources and documentation. `bun install` only installs dependencies and applies the local Pi patch. It does not build Sandpiper.

## Package output

| Package | Build output |
| --- | --- |
| `packages/cli/` | Runtime entrypoints, shared chunks, and `resources/` under `dist/standalone/`. Public documentation under ignored `docs/`. Packed tarballs under `dist/`. |
| `packages/core/` | TypeScript declarations under `dist/` |

The CLI bundles its built-in extensions. Pi loads additional user and project extensions from TypeScript through jiti.

The runtime reads metadata from the real CLI `package.json`. A local Pi patch resolves Pi-owned assets from the coding-agent dependency instead. Startup creates no package sidecar and does not write into the installation.

## Task orchestration

The root `build:packages` script uses Turborepo to build these packages:

- `sandpiper-ai-core`
- `sandpiper-ai-cli`

`turbo.json` defines dependency order and caches package-local output. CLI cache inputs include resources, public documentation, extension source, and staging scripts. Its outputs include `dist/**` and generated `docs/**`.

Resource staging copies only skill directories that contain `SKILL.md`. Orphaned helper directories from earlier installations do not ship.

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

The patch changes two Pi modules:

- `dist/core/system-prompt.js` preserves the tools and rules sections when Sandpiper supplies a custom prompt.
- `dist/config.js` resolves themes, UI assets, and HTML export templates from `PI_CODING_AGENT_PACKAGE`. Product metadata still comes from `PI_PACKAGE_DIR`.

The patch applies during workspace installation. The packed CLI includes the patched dependency through `bundledDependencies`. Consumer installations do not inherit root patch declarations.

The patch is tied to an exact Pi version. Redo it after each Pi upgrade:

1. Update the version pins. Run `bun patch @earendil-works/pi-coding-agent` and reapply the changes marked `Sandpiper local patch` in the old patch file.
2. Run `bun patch --commit 'node_modules/@earendil-works/pi-coding-agent'`. Delete `.bun-tag-*` entries from the new patch file. Remove the old version's patch file if Bun leaves it under `patches/`.
3. Run `bun run test:vitest -- extensions/system/prompt-ownership.test.ts packages/cli/pi_asset_paths.test.ts`, then run the full checks.

## CLI tarball

`bun run pack:cli` builds the CLI and writes its tarball under `packages/cli/dist/`. The installed package includes skills, prompts, themes, public docs, and runtime dependencies. It requires Bun and Node, but no source checkout or installation scripts.

`devtools/packCli.ts` copies publishable files into a temporary directory and links the workspace dependency root there. `bun pm pack` then includes the dependencies named in `bundledDependencies`. This temporary link compensates for pack tools that omit hoisted dependencies when run directly in a workspace package. The wrapper removes the temporary directory after packing.

`devtools/packedCli.test.ts` installs the tarball offline with an empty npm cache and disabled scripts. It runs both CLI commands from a read-only installation outside the checkout.

## Verification

Use `bun check` for dependency policy, type checks, structural rules, and lint. Use `bun run test` for the full Vitest suite.

When command output changes, build first and smoke-test the workspace bins:

```sh
bun run build
./node_modules/.bin/sandpiper --help
./node_modules/.bin/sandpiper-system-prompt --help
```

## Related docs

- [How to build and verify Sandpiper changes](build-workflows.md)
- [Pi extension development](pi-extension-development.md)
- [Contributing guide](../../CONTRIBUTING.md)
