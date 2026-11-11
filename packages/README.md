# Packages

CLI and shared core source modules used by the Sandpiper runtime. The root `package.json` owns the `sandpiper-ai-cli` product.

## Contents

| Package                                        | Description                               |
| ---------------------------------------------- | ----------------------------------------- |
| [`cli/`](cli/)                                 | CLI entrypoints and stable bin launchers  |
| [`core/`](core/)                               | Shared core utilities                     |

## Build

Run `bun run build` from the repository root. One Bun invocation bundles both CLI entrypoints and their shared chunks under root `dist/`. Core modules use source TypeScript without separate JavaScript or declaration output. AutoTOON's transform lives beside its adapter in `extensions/autotoon/`. `bun install` installs dependencies only.

## Output

Run `bun run pack:cli` from the repository root. It builds, then uses ordinary `bun pm pack --ignore-scripts --destination ./dist`. The tarball includes runtime output, public documentation, the license, stable launchers, and patched runtime dependencies. It does not publish to a registry.

The launchers remain at `packages/cli/bin/sandpiper` and `packages/cli/bin/sandpiper-system-prompt`. They load root `dist/` in both checkout and installed layouts. No resource or documentation staging step runs.
