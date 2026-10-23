# Devtools

Development scripts and build utilities for this workspace.

## Scripts

| Script | Purpose |
| --- | --- |
| `syncSkillHelpers.ts` | Copies the built standup executable into its local skill directory |
| `stageCliResources.ts` | Refreshes helper executables and stages resources and public docs in the CLI package |
| `packCli.ts` | Packs the CLI with patched dependencies through a temporary package directory |
| `clean.ts` | Removes dependencies, generated output, and caches |

## Build flow

`bun install` installs dependencies only. `bun run build` performs the explicit workspace build:

```text
bun run build
  → Turbo builds core and standup before the CLI
  → CLI build bundles built-in extensions
  → stageCliResources.ts refreshes local helpers and stages resources and docs
```

Package output stays under the package that owns it. Startup reads the real CLI package metadata and does not create a package sidecar.

Use `bun run build:standalone` for the CLI and its helper prerequisites. Use `bun run sync:skill-helpers` only after the standup package is built.

Use `bun run pack:cli` to write an npm-compatible tarball under `packages/cli/dist/`. The pack wrapper exposes hoisted workspace dependencies in a temporary directory so `bun pm pack` includes the patched runtime. It does not publish to a registry.

## Integration tests

[`integration/`](./integration/) contains the headless CLI and remote procedure call (RPC) integration tests. They start real `pi` or `sandpiper` processes with mock providers and isolated configuration directories.

See [`integration/README.md`](./integration/README.md) and the [AGENT-249 harness design](../.sandpiper/docs/specs/agent-249-headless-cli-integration-harness-design.md).
