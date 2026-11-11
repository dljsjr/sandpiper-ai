# Sandpiper CLI

Sandpiper-branded CLI runtime around [pi-coding-agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent). This directory holds source and stable launchers. The root `package.json` owns the `sandpiper-ai-cli` product.

## How It Works

`sandpiper_standalone.ts` is the normal `sandpiper` runtime. It:

1. Resolves the root product package without writing to the installation.
2. Configures `PI_PACKAGE_DIR`, `PI_CODING_AGENT_PACKAGE`, `PI_CODING_AGENT_VERSION`, `SANDPIPER_CODING_AGENT_PACKAGE`, and mirrored user-facing `SANDPIPER_*` env vars before importing Pi.
3. Imports Pi through `deferred_pi_import.ts`.
4. Calls `main(args, { extensionFactories })` with Sandpiper identity/capability factories and explicit resource discovery.

This path does not install Sandpiper into Pi to load its own behavior.

Set `SANDPIPER_PRINT_PI_VERSION=1` to write the active Pi version to stderr before Sandpiper starts.

## Build

```bash
bun run build     # Build both commands and shared chunks under root dist/
bun run pack:cli  # Build, then pack the root product under dist/
```

Run these commands from the repository root with Bun 1.4.4 or later. `pack:cli` uses ordinary `bun pm pack`, not a pack wrapper. Dependency installation does not build runtime bundles.

## Runtime Targets

Use explicit package scripts or paths when testing. The user's `$PATH` may contain another `sandpiper` executable or shell script.

```bash
# Source/dev target
bun run sandpiper-dev -- --help

# Build and run the normal runtime bundle
bun run build
bun run sandpiper-built -- --help

# Stable bin after building
packages/cli/bin/sandpiper --help
```

Built-in extensions load through explicit factories in both source and built entrypoints. Resource discovery uses `resources_discover` without a staging step. The built runtime requires no source checkout and creates no metadata sidecar.

Sandpiper bundles no skills, prompt templates, or custom themes. Stock themes come from Pi, and user, project, settings-configured, and package resources still load through Pi. `SANDPIPER_STANDALONE_PACKAGE_DIR` selects an existing metadata package and does not generate files.

The CLI requires Bun. Journal is an optional standalone package, not a bundled helper. See the [build workflow](../../docs/dev/build-workflows.md#pack-the-cli) for tarball commands.

Package-management commands such as `install`, `list`, `remove`, and `update` operate on the normal Sandpiper global/project settings files.

## System prompt diagnostic

`sandpiper-system-prompt` performs the normal extension, tool, skill, context, identity, and appended-prompt discovery path, then writes the rendered system prompt to stdout without making a model request.

Run it from source:

```bash
bun run system-prompt-dev -- --approve > /tmp/system-prompt.txt
```

After building the root product, use the stable bin:

```bash
packages/cli/bin/sandpiper-system-prompt --approve > /tmp/system-prompt.txt
```

It accepts prompt-affecting Sandpiper/Pi flags such as `--identity`, `--append-system-prompt`, `--tools`, and resource discovery flags. It rejects positional prompt messages and `@file` arguments so a diagnostic invocation cannot become an agent turn. Diagnostics go to stderr.

Pass `--json` for machine-readable output containing the rendered prompt and the resolved paths of file-backed identity, system prompt, appended prompt, and context inputs. Raw prompt flag values are intentionally absent from the source list because they have no file to update.

The bin also satisfies `birdup`'s runner contract:

```bash
birdup roux --runner "$PWD/packages/cli/bin/sandpiper-system-prompt" > /tmp/roux-system-prompt.txt
```

## Key Files

| File                          | Purpose                                                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `sandpiper_standalone.ts`     | Normal runtime entrypoint that selects installed package metadata before loading Pi and registers built-in extensions and resources |
| `sandpiper_system_prompt.ts`  | Diagnostic entrypoint that configures the Sandpiper runtime and renders the prompt without a model request                          |
| `system_prompt_diagnostic.ts` | SDK-based diagnostic session orchestration                                                                                          |
| `bin/sandpiper`               | Stable workspace bin shim for the normal runtime                                                                                    |
| `bin/sandpiper-system-prompt` | Stable workspace bin shim for the system prompt diagnostic                                                                          |
| `deferred_pi_import.ts`       | Load-order shim so Sandpiper imports Pi only after package metadata env vars are set                                                |

## Pi asset resolution

Sandpiper sets two separate package paths before importing Pi. `PI_PACKAGE_DIR` points to the root product package for branding, version, documentation, and `.sandpiper` configuration. `PI_CODING_AGENT_PACKAGE` points to the installed Pi dependency for themes, UI assets, and HTML export templates. A local Bun patch separates these paths.

The published tarball includes the patched Pi dependency through `bundledDependencies`. Consumers do not need to apply patches or run installation scripts.
