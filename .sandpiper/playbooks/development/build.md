---
name: Build System
read_when: modifying build scripts, package.json, bunfig.toml, turbo.json, package dist output, workspace bins, skill helper assembly, deciding whether a change needs a build step
---

# Build System

Read this before you change build scripts, package metadata, or generated output.

## Key rules

- Edit source, not generated files under `dist/` or package `dist/` directories.
- `bun install` installs dependencies only. It must not build Sandpiper.
- Run `bun run build` to build package-owned outputs, refresh helpers, and stage built-in resources and public docs in the CLI package.
- Use `bun run pack:cli` for an npm-compatible tarball. Do not pack the workspace subpackage directly: pack tools omit its hoisted dependencies.
- Keep output beside the package that owns it.
- The CLI bundles built-in extensions. Pi loads additional user/project extensions from source TypeScript. Do not add a separate extension build step.
- Keep root local dependencies on `workspace:*`. Keep package-level internal and registry dependencies on exact versions.
- Run `bun run check:deps` after package metadata changes.
- Sandpiper patches `@earendil-works/pi-coding-agent` locally through `patches/` and `patchedDependencies`. Redo the patch after each Pi version change. Follow "Local Pi patch" in `docs/dev/build-system.md`.

## Build commands

| Need | Command |
| --- | --- |
| All workspace outputs and skill helpers | `bun run build` |
| Sandpiper CLI, helper prerequisites, and staged resources | `bun run build:standalone` |
| Build and pack the portable CLI without publishing | `bun run pack:cli` |
| Package build graph only | `bun run build:packages` |
| Refresh the standup skill helper after its package build | `bun run sync:skill-helpers` |
| Remove dependencies, output, and caches | `bun run clean` |

## Source paths

- `package.json` defines the root build and test commands.
- `turbo.json` defines the package build graph and cache inputs.
- `packages/cli/package.json` builds the workspace runtime and system prompt diagnostic.
- `packages/cli/temporary_trail_skill.ts` temporarily loads `~/git/skills-incubator/skills/trail` when `trail` is executable on PATH. TOOLS-43 tracks replacing this local bridge. There are no Trail flags, downloads, or discovery commands yet.
- `devtools/syncSkillHelpers.ts` copies the standup executable from package output into its local skill.
- `devtools/stageCliResources.ts` stages resources and public documentation in the CLI package.
- `devtools/packCli.ts` packs the CLI and its patched runtime dependencies through a temporary package directory.
- `packages/*/package.json` defines package-owned output.

## Verification

Run focused tests while you work. Before completion, run:

```sh
bun check
bun run test
```

Run the built workspace commands directly when their behavior changed:

```sh
./node_modules/.bin/sandpiper --help
./node_modules/.bin/sandpiper-system-prompt --help
packages/resources/skills/standup/scripts/sandpiper-standup --help
```
