# How to build and verify Sandpiper changes

Use this guide to choose the right build or verification command after changing Sandpiper source files.

For the build pipeline and generated artifact layout, see [Build system reference](build-system.md).

## Choose the command

| You changed...                                                          | Run                                                                                              |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Extension source under `extensions/` or `plugins/pi/extensions/`        | `bun run prepare:distribution`                                                                   |
| Skills, prompts, themes, or other resources under `packages/resources/` | `bun run prepare:distribution`                                                                   |
| `packages/core/`                                                        | `bun run prepare:distribution`                                                                   |
| `packages/cli/`                                                         | `bun run prepare:distribution`                                                                   |
| `packages/trail/` (`@sandpiper-ai/trail`)                 | `bun run prepare:distribution`                                                                   |
| `packages/sandpiper-standup-cli/`                                       | `bun run prepare:distribution`                                                                   |
| `packages/adapter-claude-code/`                                         | `bun --filter sandpiper-adapter-claude-code build` then `bun run build:claude-plugin`            |
| Build system or package metadata                                        | `bun run prepare:distribution`, targeted tests, and the distribution gate before claiming health |

## Run tests while developing

Use focused Vitest runs for fast feedback:

```bash
bun run test:vitest -- <testpath>
```

Use the full Vitest gate when you need repository-wide confidence:

```bash
bun run test
```

Do not use bare `bun test` as the repository health gate; it invokes Bun's test runner, not the Vitest suite configured for this repo.

## Certify distribution health

Before claiming distribution health, remove the old generated artifact and run the full distribution gate:

```bash
rm -rf dist && bun run test:distribution
```

This prepares generated artifacts and runs distribution invariant tests, standalone runtime checks, standalone app-bundle checks, and Claude plugin checks.

## Rebuild after extension changes

Extensions load from source TypeScript through Pi's jiti runtime. They do not need an extension package build, but generated artifacts need to be reassembled:

```bash
bun run prepare:distribution
```

## Rebuild after package changes

Packages that emit binaries or declarations need package builds first. `prepare:distribution` runs the Turborepo-backed package build graph and then assembles generated artifacts:

```bash
bun run prepare:distribution
```

`build:packages` runs the distributable package build graph through Turbo and caches package-local `dist/` outputs when you only need package builds.

## Rebuild shared resources

Skills, prompts, themes, and shared resource files are copied into generated artifacts:

```bash
bun run prepare:distribution
```

## Smoke-test generated entrypoints

Standalone dogfood binary:

```bash
bun run build:standalone
./node_modules/.bin/sandpiper --help
```

Standalone app bundle:

```bash
bun run build:standalone-app
bun run test:standalone-app
./dist/standalone-sandpiper/sandpiper --help
```

Claude Code plugin artifact:

```bash
bun run build:claude-plugin
bun run test:claude-plugin
```

## Check ecosystem install metadata

Use npm dry-run installs to verify package metadata without running lifecycle scripts:

```bash
bun run prepare:distribution
npm install --ignore-scripts --package-lock=false --dry-run
npm install --ignore-scripts --package-lock=false --dry-run --prefix dist
```

Validate Claude plugin manifests after building the plugin artifact:

```bash
bun run build:claude-plugin
claude plugin validate .
claude plugin validate dist/claude-plugin
```

## Repair common problems

### Extension not found after changes

Run distribution assembly again:

```bash
bun run prepare:distribution
```

Extension source trees must be copied into generated artifacts for `pi.extensions` entries to resolve.

### Module not found for an npm dependency

Run a workspace install from the repository root:

```bash
bun install
```

Extensions resolve dependencies from the hoisted root `node_modules/`, not from per-extension directories.

### Binary not updated after package changes

Build the package first, then reassemble generated artifacts:

```bash
bun run prepare:distribution
```
