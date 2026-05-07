# How to build and verify Sandpiper changes

Use this guide to choose the right build or verification command after changing Sandpiper source files.

For the build pipeline and generated artifact layout, see [Build system reference](build-system.md).

## Choose the command

| You changed...                                                          | Run                                                                                              |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Extension source under `extensions/` or `plugins/pi/extensions/`        | `bash devtools/postinstall.sh`                                                                   |
| Skills, prompts, themes, or other resources under `packages/resources/` | `bash devtools/postinstall.sh`                                                                   |
| `packages/core/`                                                        | `bun --filter sandpiper-ai-core build` then `bash devtools/postinstall.sh`                       |
| `packages/cli/`                                                         | `bun --filter sandpiper-ai-cli build` then `bash devtools/postinstall.sh`                        |
| `packages/sandpiper-tasks-cli/`                                         | `bun --filter sandpiper-tasks-cli build` then `bash devtools/postinstall.sh`                     |
| `packages/sandpiper-standup-cli/`                                       | `bun --filter sandpiper-standup-cli build` then `bash devtools/postinstall.sh`                   |
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
rm -rf dist && env -u PI_PACKAGE_DIR bun run test:distribution
```

This prepares generated artifacts and runs distribution invariant tests, standalone runtime checks, standalone app-bundle checks, and Claude plugin checks.

## Rebuild after extension changes

Extensions load from source TypeScript through Pi's jiti runtime. They do not need a package build, but generated artifacts need to be reassembled:

```bash
bash devtools/postinstall.sh
```

## Rebuild after package changes

Packages that emit binaries or declarations need their own build first:

```bash
bun --filter sandpiper-ai-cli build
bash devtools/postinstall.sh
```

Use the package-specific filter for the package you changed.

## Rebuild shared resources

Skills, prompts, themes, and shared resource files are copied into generated artifacts:

```bash
bash devtools/postinstall.sh
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
bash devtools/postinstall.sh
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
bun --filter sandpiper-tasks-cli build
bash devtools/postinstall.sh
```
