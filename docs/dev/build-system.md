# Build system reference

The root `package.json` owns the `sandpiper-ai-cli` product. Sandpiper runs from either the checkout or a packed installation. Both layouts use root `dist/`.

Use this page to understand the build structure. For commands, see [How to build and verify Sandpiper changes](build-workflows.md).

## Pipeline

`bun install` only installs dependencies and applies the local Pi patch. It does not build Sandpiper.

`bun run build` removes root `dist/`, then runs one Bun build for both entrypoints. It produces JavaScript bundles and shared chunks. It does not produce a compiled executable.

## Product layout

| Path                                               | Purpose                                                                          |
| -------------------------------------------------- | -------------------------------------------------------------------------------- |
| `package.json`                                     | Product identity, version, runtime dependencies, file list, and both bin entries |
| `dist/`                                            | Built runtime, system prompt diagnostic, and shared chunks                       |
| `packages/cli/bin/`                                | Stable launchers that load root output                                           |
| `docs/`, `README.md`, `CONTRIBUTING.md`, `LICENSE` | Root-owned documentation and license, packed directly                            |
| `packages/resources/`                              | Optional resource location, absent from the packed product                       |

The CLI bundles its built-in extensions. Pi loads additional user and project extensions from TypeScript through jiti. Core and capability packages expose source TypeScript. They need no separate JavaScript or declaration build.

Both source and built entrypoints read metadata from the root product package. A local Pi patch resolves Pi-owned assets from the coding-agent dependency instead. Startup creates no package sidecar and does not write into the installation.

The build has no Turbo graph, cache restoration, resource staging, or documentation copying. Output cleanup affects root `dist/`, not dependency directories.

## Build tools and developer tools

The repository pins Bun 1.4.4 and declares Bun 1.4.4 or later for the product. Earlier packing behavior is not supported. Bun and the declared workspace dependencies build the product. TypeScript, Vitest, Biome, and Syncpack support development checks.

The mise tools mcporter, jscpd, hike, and lizard are developer conveniences, not build steps. Web search uses Pi's standalone MCP client instead of the mcporter application library. This does not remove the separate developer CLI.

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

Run `bun run pack:cli` from the repository root. It builds, then runs ordinary `bun pm pack --ignore-scripts --destination ./dist`. The tarball is `dist/sandpiper-ai-cli-0.0.1.tgz`, with its filename set by the product version.

Direct packing uses the root file list and includes the dependencies named in `bundledDependencies`. The file list selects `dist/**/*.js` and `dist/**/*.js.map`, not arbitrary output or previous tarballs. Packing does not build the application. There is no temporary package directory or pack wrapper.

The installed package includes both launchers, root output, public docs, the license, and patched runtime dependencies. It ships no built-in skills, prompt templates, or custom themes. Stock themes come from Pi. Configured custom resources remain supported through the SDK.

Both source and built modes default to optional `<productRoot>/packages/resources`. A missing default tree is valid. An explicit `SANDPIPER_STANDALONE_RESOURCE_ROOT` must name an existing directory.

The installed CLI requires Bun, but no source checkout or installation scripts. Optional standalone Journal requires Node 24 or later.

`devtools/packedCli.test.ts` installs the tarball offline with an empty npm cache and disabled scripts. It runs both CLI commands from a read-only installation outside the checkout.

## Verification

Use `bun check` for dependency policy, type checks, formatting, and lint. Use `bun run test` for the full Vitest suite.

When command output changes, build first and smoke-test the workspace bins:

```sh
bun run build
packages/cli/bin/sandpiper --help
packages/cli/bin/sandpiper-system-prompt --help
```

## Related docs

- [How to build and verify Sandpiper changes](build-workflows.md)
- [Pi extension development](pi-extension-development.md)
- [Contributing guide](../../CONTRIBUTING.md)
