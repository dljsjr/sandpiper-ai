# How to build and verify Sandpiper changes

Use this guide to select the build and verification commands for a change. For the pipeline and output layout, see [Build system reference](build-system.md).

## Choose the command

| You changed | Build command |
| --- | --- |
| Built-in extension source under `extensions/` | `bun run build:standalone` |
| Skills, prompts, themes, or other files under `packages/resources/` | `bun run build:standalone` to refresh the built runtime |
| `packages/core/` | `bun --filter sandpiper-ai-core build` |
| `packages/cli/` | `bun run build:standalone` |
| Root build scripts, package metadata, or several packages | `bun run build` |

## Run tests while developing

Run the smallest relevant Vitest suite first:

```sh
bun run test:vitest -- <testpath>
```

Run both repository gates before completion:

```sh
bun check
bun run test
```

Do not use bare `bun test` as the repository gate. It invokes Bun's test runner instead of the configured Vitest suite.

## Build all local output

```sh
bun run build
```

This command builds core declarations and the Sandpiper runtime. The CLI build stages resources and documentation in the CLI package.

Use this narrower command when only the Sandpiper runtime changed:

```sh
bun run build:standalone
```

## Pack the CLI

Run from the repository root:

```sh
bun run pack:cli
```

The command builds the runtime and creates `packages/cli/dist/sandpiper-ai-cli-0.0.1.tgz`. The filename follows the CLI package version.

The tarball includes built-in resources and patched runtime dependencies. The pack wrapper uses a temporary directory to expose hoisted workspace dependencies to `bun pm pack`. It removes that directory after packing. Do not pack `packages/cli` directly, because pack tools omit its hoisted dependencies.

With Bun and Node installed, install the tarball without installation scripts:

```sh
npm install --global --ignore-scripts ./packages/cli/dist/sandpiper-ai-cli-0.0.1.tgz
```

Make sure that the package works outside the checkout:

```sh
bun run test:vitest -- devtools/packedCli.test.ts
```

This test installs offline with an empty npm cache and disabled scripts. It runs both commands from a read-only installation.

## Smoke-test built commands

```sh
./node_modules/.bin/sandpiper --help
./node_modules/.bin/sandpiper-system-prompt --help
```

These commands exercise the same workspace paths used for local development.

## Repair common problems

### Sandpiper has not been built

Run:

```sh
bun run build
```

The package bin shims require `packages/cli/dist/standalone/` output.

### Built-in resources use old behavior

Run `bun run build:standalone` to refresh staged skills, prompts, themes, and documentation. Standalone packages such as Journal are installed and updated separately.

### A dependency cannot be resolved

Install dependencies from the repository root:

```sh
bun install
```

Extensions resolve dependencies from the hoisted root `node_modules/` directory.
