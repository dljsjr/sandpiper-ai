# Build system reference

The root `package.json` owns the `sandpiper-ai-cli` product. Sandpiper runs from either the checkout or a packed installation. Both layouts use root `dist/`.

Use this page to understand the build structure. For commands, see [How to build and verify Sandpiper changes](build-workflows.md).

## Pipeline

`bun install` only installs dependencies and applies the local Pi patch. It does not build Sandpiper.

`bun run build` removes root `dist/`, then runs one Bun build for both entrypoints. It produces JavaScript bundles and shared chunks. It does not produce a compiled executable.

Bundling is a size choice, not a requirement. Running the source TypeScript directly also worked when the build was simplified, but the prototype tarball grew from about 39.8 MB to 52.9 MB, because complete dependency packages replaced the bundled code.

## Product layout

| Path                                               | Purpose                                                                          |
| -------------------------------------------------- | -------------------------------------------------------------------------------- |
| `package.json`                                     | Product identity, version, runtime dependencies, file list, and both bin entries |
| `dist/`                                            | Built runtime, system prompt diagnostic, and shared chunks                       |
| `packages/cli/bin/`                                | Stable launchers that load root output                                           |
| `packages/core/system-prompt/`                     | System prompt templates, read at run time                                        |
| `docs/`, `README.md`, `CONTRIBUTING.md`, `LICENSE` | Root-owned documentation and license, packed directly                            |

The CLI bundles its built-in extensions. Pi loads additional user and project extensions from TypeScript through jiti. Core and extension-local modules use source TypeScript. They need no separate JavaScript or declaration build.

Both source and built entrypoints read metadata from the root product package. A local Pi patch resolves Pi-owned assets from the coding-agent dependency instead. Startup creates no package sidecar and does not write into the installation.

The build has no Turbo graph, cache restoration, resource staging, or documentation copying. Output cleanup affects root `dist/`, not dependency directories.

## Build tools and developer tools

The repository pins Bun 1.4.4 and declares Bun 1.4.4 or later for the product. Earlier packing behavior is not supported. Bun and the root dependencies build the product. TypeScript, Vitest, Biome, and Knip support development checks.

The mise tools mcporter, jscpd, hike, and lizard are developer conveniences, not build steps. Web search uses Pi's standalone MCP client instead of the mcporter application library. This does not remove the separate developer CLI.

## Dependency resolution

With one root manifest and no workspaces, Bun installs every dependency into the root `node_modules/` directory. Extension dependencies resolve from there.

One root `package.json` and `bun.lock` own all dependencies. Registry dependencies use exact versions. Internal source imports use relative paths to the owning module, without workspace packages or aliases.

The four Pi packages and jsdom remain runtime dependencies. The package includes them through `bundledDependencies`. Libraries compiled into the application, such as TOON encoding and web conversion, are build-only `devDependencies`.

`bun check` runs TypeScript, Biome, and Knip. Knip analyzes both CLI entrypoints in one root workspace. Its production-only dependency ignores cover the external runtime packages. Test extensions loaded by file path are explicit non-production entrypoints.

One root `vitest.config.ts` defines the catch-all project and the core, web-fetch, and web-search projects. Core tests keep a 10-second default timeout. The two web areas keep 15 seconds. Other tests keep Vitest's 5-second default, except where a test declares its own timeout.

## Local Pi patch

Sandpiper carries a local patch of `@earendil-works/pi-coding-agent`. The patch is stored under `patches/` and applied by `bun install` through `patchedDependencies` in the root `package.json`.

The patch changes seven Pi modules:

- `dist/core/system-prompt.js` preserves the tools and rules sections when Sandpiper supplies a custom prompt. It also adds a `deferredTools` option. When `tool_search` is declared, the tools section lists the deferred tools that are not loaded yet in a `<deferred_tools>` block. `dist/core/system-prompt.d.ts` declares the option.
- `dist/index.js` exports `isMcpToolName`, Pi's check for MCP tool names. Sandpiper's deferred tools list uses it to leave out MCP tools. `dist/index.d.ts` declares the export.
- `dist/config.js` resolves themes, UI assets, and HTML export templates from `PI_CODING_AGENT_PACKAGE`. Product metadata still comes from `PI_PACKAGE_DIR`.
- `dist/modes/interactive/interactive-mode.js` gives Pi's update check the Pi version from `PI_CODING_AGENT_VERSION`. Unpatched, the check compares the product version from `PI_PACKAGE_DIR`.
- `dist/utils/pi-user-agent.js`, `dist/core/client-identity.js`, and `dist/extensions/mcp/runtime.js` identify Pi by the Pi version from `PI_CODING_AGENT_VERSION`. This covers the `User-Agent` of requests to pi.dev, GitHub, and model providers, and the client information sent to MCP servers. Unpatched, they send the product version.

The patch applies during dependency installation. The packed CLI includes the patched dependency through `bundledDependencies`. Consumer installations do not inherit root patch declarations.

The patch is tied to an exact Pi version. Redo it after each Pi upgrade:

1. Update the version pins. Run `bun patch @earendil-works/pi-coding-agent`. Bun warns that the old patch no longer applies. That is expected.
2. Reapply the changes marked `Sandpiper local patch` in `node_modules/@earendil-works/pi-coding-agent`. Edit the files, or run `patch -p1 --no-backup-if-mismatch` in that directory with the old patch file as input. Without that option, `patch` leaves a `.orig` backup beside each file whose hunks moved, and Bun records the backups in the new patch.
3. Compare each reapplied block with the Pi code around it. A block that copies Pi's text does not follow a change in Pi.
4. Run `find node_modules/@earendil-works/pi-coding-agent -name '*.orig' -o -name '*.rej'`. It must print nothing.
5. Run `bun patch --commit 'node_modules/@earendil-works/pi-coding-agent'`. Run `grep '^diff' patches/*.patch`. It must list only the modules named above. Delete `.bun-tag-*` entries from the new patch file. Remove the old version's patch file and its `patchedDependencies` entry in the root `package.json` if Bun leaves them.
6. Run `bun run test:vitest -- extensions/system/prompt-ownership.test.ts extensions/system/deferred-tools-prompt.test.ts packages/cli/pi_asset_paths.test.ts`, then run the full checks.

## CLI tarball

Run `bun run pack:cli` from the repository root. It builds, then runs ordinary `bun pm pack --ignore-scripts --destination ./dist`. The tarball is `dist/sandpiper-ai-cli-0.0.1.tgz`, with its filename set by the product version.

Direct packing uses the root file list and includes the dependencies named in `bundledDependencies`. The file list selects `dist/**/*.js` and `dist/**/*.js.map`, not arbitrary output or previous tarballs. Packing does not build the application. There is no temporary package directory or pack wrapper.

The installed package includes both launchers, root output, the system prompt templates, public docs, the license, and patched runtime dependencies. It ships no built-in skills, Pi prompt templates, or custom themes. Stock themes come from Pi. Configured custom resources remain supported through the SDK.

The installed CLI requires Bun, but no source checkout or installation scripts. Optional standalone Journal requires Node 24 or later.

`devtools/packedCli.test.ts` installs the tarball offline with an empty npm cache and disabled scripts. It runs both CLI commands from a read-only installation outside the checkout.

## Verification

Use `bun check` for type checks, formatting, lint, and unused code/dependency checks. Use `bun run test` for the full Vitest suite.

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
