---
name: Build System
read_when: modifying build scripts, root product package.json, bunfig.toml, root dist output, bin launchers, bun pm pack, deciding whether a change needs a build step
---

# Build System

Read this before you change build scripts, package metadata, or generated output.

## Key rules

- Edit source, not generated files under root `dist/`.
- Use the pinned Bun 1.4.4 toolchain. The product requires Bun 1.4.4 or later.
- `bun install` installs dependencies only. It must not build Sandpiper.
- Run `bun run build` for both JavaScript entrypoints and shared chunks under root `dist/`.
- Run `bun run pack:cli` from the root to build and pack. It uses ordinary `bun pm pack --ignore-scripts --destination ./dist`, not a pack wrapper.
- Keep the product identity `sandpiper-ai-cli` and existing `packages/cli/bin/` launcher paths.
- Pack root documentation and the license directly. Do not add staging, temporary package directories, or metadata sidecars.
- The product ships no built-in skills, prompt templates, or custom themes. Pi loads user, project, settings-configured, and package resources. Do not add a product-owned resource location.
- The CLI bundles built-in extensions. Pi loads additional user/project extensions from source TypeScript. Do not add a separate extension build step.
- Core and capability packages expose source TypeScript. Do not restore separate JavaScript or declaration emission.
- Keep root local dependencies on `workspace:*`. Keep package-level internal and registry dependencies on exact versions.
- Run `bun run check:deps` after package metadata changes.
- Sandpiper patches `@earendil-works/pi-coding-agent` locally through `patches/` and `patchedDependencies`. Redo the patch after each Pi version change. Follow "Local Pi patch" in `docs/dev/build-system.md`.

## Build commands

| Need                                               | Command                                             |
| -------------------------------------------------- | --------------------------------------------------- |
| Both commands and shared chunks                    | `bun run build`                                     |
| Build and pack the root product without publishing | `bun run pack:cli`                                  |
| Pack existing output without rebuilding            | `bun pm pack --ignore-scripts --destination ./dist` |

The build replaces only root `dist/`. Packing writes `dist/sandpiper-ai-cli-0.0.1.tgz`, with the filename set by the product version. There is no Turbo cache, recursive dependency cleaner, resource staging helper, or custom pack wrapper.

## Source paths

- Root `package.json` owns product metadata, bins, file selection, dependencies, and build/test commands.
- `packages/cli/` contains both source entrypoints and the stable `bin/` launchers.
- `packages/cli/temporary_trail_skill.ts` temporarily loads `~/git/skills-incubator/skills/trail` when `trail` is executable on PATH. TOOLS-43 tracks replacing this local bridge. There are no Trail flags, downloads, or discovery commands yet.
- `packages/*/package.json` defines internal source packages, not separate product outputs.
- `devtools/` retains build/pack regressions, isolated RPC and print-mode drivers, mock providers, and the jj test fixture.

## Verification

Run focused tests while you work. Before completion, run:

```sh
bun check
bun run test
```

Run the built commands directly when their behavior changed:

```sh
packages/cli/bin/sandpiper --help
packages/cli/bin/sandpiper-system-prompt --help
```
