---
name: Build System
read_when: modifying build scripts, package.json, bunfig.toml, turbo.json, package dist output, workspace bins, skill helper assembly, deciding whether a change needs a build step
---

# Build System

Read this before you change build scripts, package metadata, or generated output.

## Key rules

- Edit source, not generated files under `dist/` or package `dist/` directories.
- `bun install` installs dependencies only. It must not build Sandpiper.
- Run `bun run build` to build all package-owned outputs and refresh local skill helper executables.
- Keep output beside the package that owns it.
- Extensions load from source TypeScript through Pi. Do not add an extension build step.
- Keep root local dependencies on `workspace:*`. Keep package-level internal and registry dependencies on exact versions.
- Run `bun run check:deps` after package metadata changes.
- Sandpiper patches `@earendil-works/pi-coding-agent` locally through `patches/` and `patchedDependencies`. Redo the patch after each Pi version change. Follow "Local Pi patch" in `docs/dev/build-system.md`.

## Build commands

| Need | Command |
| --- | --- |
| All workspace outputs and skill helpers | `bun run build` |
| Sandpiper CLI bundle only | `bun run build:standalone` |
| Package build graph only | `bun run build:packages` |
| Refresh Trail and standup skill helpers after package builds | `bun run sync:skill-helpers` |
| Remove dependencies, output, and caches | `bun run clean` |

## Source paths

- `package.json` defines the root build and test commands.
- `turbo.json` defines the package build graph and cache inputs.
- `packages/cli/package.json` builds the workspace runtime and system prompt diagnostic.
- `devtools/syncSkillHelpers.ts` copies Trail and standup executables from package output into the local skills.
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
packages/resources/skills/sandpiper/tasks/scripts/trail --help
packages/resources/skills/sandpiper/standup/scripts/sandpiper-standup --help
```
