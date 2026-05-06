# Extensions

Pi extensions that extend the coding agent with custom tools, lifecycle hooks, and commands.

## Contents

| Extension | Description |
|-----------|-------------|
| [`system/`](system/) | Composed Sandpiper extension package — identity plus neutral system capabilities for generated Sandpiper package behavior |
| [`capabilities.ts`](capabilities.ts) | Neutral system capability entrypoint — background process tools/hooks without Sandpiper identity or startup behavior |
| [`autotoon/`](autotoon/) | Compatibility bridge to the package-first AutoTOON Pi adapter in `packages/capability-autotoon/` |
| [`shell-relay/`](shell-relay/) | Shared terminal session between user and agent via Zellij |

### system/ and capabilities.ts

`system/` is the composed Sandpiper extension package. Generated Sandpiper Pi artifacts load it through `extensions/system/package.json`, which keeps the repository root from acting as the canonical Pi package manifest. It loads both:

- Sandpiper identity/startup behavior: prompt assembly, session continuity, migration / shell-integration controls, diagnostics, and update banners.
- Neutral system capabilities: background process tools and completion/shutdown hooks.

`capabilities.ts` is the neutral system-capability entrypoint. It intentionally omits Sandpiper identity flags, prompt hooks, migration controls, diagnostics, and update banners. Neutral Pi package assembly loads `capabilities.ts` plus other neutral extension entrypoints (`shell-relay`, `web-fetch`, `autotoon`) instead of `system/`.

The entrypoints are intentionally thin glue layers. Framework-independent logic is extracted into `packages/core/`, while Pi-specific wiring helpers live under `extensions/system/`.

As sandpiper grows, prefer keeping entrypoints thin and pushing reusable logic into `packages/core/` or focused extension-local modules rather than expanding a single large file.

### autotoon

`autotoon/` preserves the legacy Pi package entrypoint path. The source of truth now lives in `packages/capability-autotoon/`: `src/core.ts` contains the host-neutral JSON→TOON transform, while `src/pi-extension.ts` contains the Pi `tool_result` adapter.

### shell-relay

A multi-module extension providing a shared terminal session. See its own [README](shell-relay/README.md) for full documentation.

## How Extensions Work

Extensions are TypeScript modules that export a default function receiving the `ExtensionAPI`. They can register tools, subscribe to events, add commands, and interact with users.

Directory extensions (like `system/` and `shell-relay/`) load from source via Pi's jiti runtime and declare their entry point in `package.json` under the `pi.extensions` key. Top-level compatibility bridge files may exist for explicit local experiments, but generated package manifests should prefer directory/package entrypoints.

For the full extension API, see the [pi extensions documentation](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md).
