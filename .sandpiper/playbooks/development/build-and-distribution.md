---
name: Build and Distribution
read_when: modifying build scripts, package.json, bunfig.toml, devtools/assembleDistribution.ts, dist assembly, generated artifacts, package install flow, standalone app, Claude plugin artifact, deciding whether a change needs a build step
---

# Build and Distribution

Read this before changing build scripts, package metadata, distribution assembly, or generated artifacts.

## Key Rules

- Edit source, not generated artifacts in `dist/` or package `dist/` directories.
- `dist/` is assembled output, not the source of truth and not a dependency manager.
- Extensions load from source TypeScript via Pi's jiti runtime; do not add build steps for extension runtime entrypoints unless the package explicitly owns a build output.
- Package-owned binaries/declarations must be built before distribution assembly.
- Use `bun run prepare:distribution` for distributable package build orchestration/caching plus generated package assembly.
- `bun install` installs dependencies only; it must not build or assemble Sandpiper artifacts.
- Shared resources under `packages/resources/` and public docs under `docs/` are copied into generated artifacts; they are not built.
- Keep `.sandpiper/` operational state, tasks, reviews, internal playbooks, and active specs out of generated distribution artifacts.
- Keep package manifests npm-installable: no `catalog:` specs; root local workspace dependencies use `workspace:*`; package-level internal and registry dependencies use exact versions only.
- Use `bun run check:deps` for source manifest policy and ecosystem package tests for generated artifact policy.
- For distribution health, use `rm -rf dist && env -u PI_PACKAGE_DIR bun run test:distribution`.
- Sandpiper patches `@earendil-works/pi-coding-agent` locally (`patches/`, `patchedDependencies`). Every Pi version bump must redo the patch and rerun `extensions/system/prompt-ownership.test.ts`; follow "Local Pi patch" in `docs/dev/build-system.md`.

## What to Run

| You changed...                                                   | Run                                                                                                            |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Extension source under `extensions/` or `plugins/pi/extensions/` | `bun run prepare:distribution`                                                                                 |
| Skills, prompts, themes, or other shared resources               | `bun run prepare:distribution`                                                                                 |
| `packages/core/`                                                 | `bun run prepare:distribution`                                                                                 |
| `packages/cli/`                                                  | `bun run prepare:distribution`                                                                                 |
| `packages/trail/` (`@sandpiper-ai/trail`)          | `bun run prepare:distribution`                                                                                 |
| `packages/sandpiper-standup-cli/`                                | `bun run prepare:distribution`                                                                                 |
| `packages/adapter-claude-code/`                                  | `bun --filter sandpiper-adapter-claude-code build` then `bun run build:claude-plugin`                          |
| Build system or package metadata                                 | `bun run prepare:distribution` and targeted tests; use `test:distribution` before claiming distribution health |

## Source-of-Truth Paths

- `package.json` — root workspace scripts, neutral Pi package surface, root bin shim
- `devtools/assembleDistribution.ts` — generated distribution assembly
- `devtools/distPackageJson.ts` — generated Sandpiper package metadata
- `packages/*/package.json` — package build outputs and bin declarations
- `plugins/pi/extensions/` — neutral Pi extension adapter surface
- `extensions/system/` — Sandpiper identity and system behavior
- `packages/resources/` — shared skills, prompts, and themes

## References

- Public build workflows: `docs/dev/build-workflows.md`
- Public build reference: `docs/dev/build-system.md`
- Package layout: `packages/README.md`
- Extension layout: `extensions/README.md`
