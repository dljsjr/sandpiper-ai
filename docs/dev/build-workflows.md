# How to build and verify Sandpiper changes

Use this guide to select the build and verification commands for a change. Use Bun 1.4.4, the pinned toolchain version. For the pipeline and output layout, see [Build system reference](build-system.md).

## Choose the command

| You changed                                         | Build command                                                 |
| --------------------------------------------------- | ------------------------------------------------------------- |
| CLI, built-in extension, or core source | `bun run build`                                               |
| Root build scripts or product metadata              | `bun run build`                                               |
| Public documentation or license                     | No build required. Pack again to refresh the tarball.         |
| Configured custom skills, prompts, or themes        | No application build. Update the separately managed resource. |

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

The command replaces root `dist/` with both JavaScript entrypoints and their shared chunks. It uses one Bun build. No core emission or resource staging step runs.

## Pack the CLI

Run from the repository root:

```sh
bun run pack:cli
```

The command builds, then packs the root product into `dist/sandpiper-ai-cli-0.0.1.tgz`. The filename follows the root product version.

To pack existing output without rebuilding, run the underlying Bun command from the root:

```sh
bun pm pack --ignore-scripts --destination ./dist
```

This direct packing command does not build the runtime.

The tarball includes root output, stable launchers, public documentation, the license, and patched runtime dependencies. It omits built-in skills, prompt templates, and custom themes. No staging directory or pack wrapper is needed.

With Bun and Node installed, install the tarball without installation scripts:

```sh
npm install --global --ignore-scripts ./dist/sandpiper-ai-cli-0.0.1.tgz
```

Make sure that the package works outside the checkout:

```sh
bun run test:vitest -- devtools/packedCli.test.ts
```

This test installs offline with an empty npm cache and disabled scripts. It runs both commands from a read-only installation.

## Smoke-test built commands

```sh
packages/cli/bin/sandpiper --help
packages/cli/bin/sandpiper-system-prompt --help
```

These stable launchers load the same root output paths in the checkout and installed product.

## Repair common problems

### Sandpiper has not been built

Run:

```sh
bun run build
```

The bin shims require root `dist/` output. Dependency installation does not create it.

### Custom resources use old behavior

Update the configured resource files or their separately installed package. The product ships no resources of its own. Pi loads user, project, settings-configured, and package resources at runtime. Standalone packages such as Journal are installed and updated separately.

### A dependency cannot be resolved

Install dependencies from the repository root:

```sh
bun install
```

Extensions resolve dependencies from the hoisted root `node_modules/` directory.
