---
name: Build and Distribution
read_when: modifying build scripts, package.json, bunfig.toml, devtools/postinstall.sh, dist assembly, generated artifacts, package install flow, standalone app, Claude plugin artifact, deciding whether a change needs a build step
---

# Build and Distribution

Read this before changing build scripts, package metadata, distribution assembly, or generated artifacts.

## Key Rules

- Edit source, not generated artifacts in `dist/` or package `dist/` directories.
- `dist/` is assembled output, not the source of truth and not a dependency manager.
- Extensions load from source TypeScript via Pi's jiti runtime; do not add build steps for extension runtime entrypoints unless the package explicitly owns a build output.
- Package-owned binaries/declarations must be built before distribution assembly.
- Shared resources under `packages/resources/` are copied into generated artifacts; they are not built.
- Keep package manifests npm-installable: no `catalog:` specs; root local workspace dependencies use `workspace:*`; package-level internal and registry dependencies use exact versions only.
- Use `bun run check:deps` for source manifest policy and ecosystem package tests for generated artifact policy.
- For distribution health, use `rm -rf dist && env -u PI_PACKAGE_DIR bun run test:distribution`.

## What to Run

| You changed...                                                   | Run                                                                                                            |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Extension source under `extensions/` or `plugins/pi/extensions/` | `bash devtools/postinstall.sh`                                                                                 |
| Skills, prompts, themes, or other shared resources               | `bash devtools/postinstall.sh`                                                                                 |
| `packages/core/`                                                 | `bun --filter sandpiper-ai-core build` then `bash devtools/postinstall.sh`                                     |
| `packages/cli/`                                                  | `bun --filter sandpiper-ai-cli build` then `bash devtools/postinstall.sh`                                      |
| `packages/sandpiper-tasks-cli/`                                  | `bun --filter sandpiper-tasks-cli build` then `bash devtools/postinstall.sh`                                   |
| `packages/sandpiper-standup-cli/`                                | `bun --filter sandpiper-standup-cli build` then `bash devtools/postinstall.sh`                                 |
| `packages/adapter-claude-code/`                                  | `bun --filter sandpiper-adapter-claude-code build` then `bun run build:claude-plugin`                          |
| Build system or package metadata                                 | `bun run prepare:distribution` and targeted tests; use `test:distribution` before claiming distribution health |

## Source-of-Truth Paths

- `package.json` — root workspace scripts, neutral Pi package surface, root bin shim
- `devtools/postinstall.sh` — generated distribution assembly
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
