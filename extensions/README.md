# Extensions

Pi extensions that extend the coding agent with custom tools, lifecycle hooks, and commands.

## Contents

| Extension | Description |
|-----------|-------------|
| [`system.ts`](system.ts) | Legacy composed Sandpiper extension — identity plus neutral system capabilities for existing Sandpiper package behavior |
| [`capabilities.ts`](capabilities.ts) | Neutral system capability entrypoint — background process tools/hooks without Sandpiper identity or startup behavior |
| [`autotoon/`](autotoon/) | Compatibility bridge to the package-first AutoTOON Pi adapter in `packages/capability-autotoon/` |
| [`shell-relay/`](shell-relay/) | Shared terminal session between user and agent via Zellij |

### system.ts and capabilities.ts

`system.ts` is the legacy composed Sandpiper entrypoint. It preserves existing root Pi-package behavior by loading both:

- Sandpiper identity/startup behavior: prompt assembly, session continuity, migration / shell-integration controls, diagnostics, and update banners.
- Neutral system capabilities: background process tools and completion/shutdown hooks.

`capabilities.ts` is the neutral system-capability entrypoint. It intentionally omits Sandpiper identity flags, prompt hooks, migration controls, diagnostics, and update banners. Future neutral Pi package assembly should load `capabilities.ts` plus other neutral extension entrypoints (`shell-relay`, `web-fetch`, `autotoon`) instead of `system.ts`.

The entrypoints are intentionally thin glue layers. Framework-independent logic is extracted into `packages/core/`, while Pi-specific wiring helpers live under `extensions/system/`.

As sandpiper grows, prefer keeping entrypoints thin and pushing reusable logic into `packages/core/` or focused extension-local modules rather than expanding a single large file.

### autotoon

`autotoon/` preserves the legacy Pi package entrypoint path. The source of truth now lives in `packages/capability-autotoon/`: `src/core.ts` contains the host-neutral JSON→TOON transform, while `src/pi-extension.ts` contains the Pi `tool_result` adapter.

### shell-relay

A multi-module extension providing a shared terminal session. See its own [README](shell-relay/README.md) for full documentation.

## How Extensions Work

Extensions are TypeScript modules that export a default function receiving the `ExtensionAPI`. They can register tools, subscribe to events, add commands, and interact with users.

Single-file extensions (like `system.ts`) and directory extensions (like `shell-relay/`) both load from source via Pi's jiti runtime. Directory extensions declare their entry point in `package.json` under the `pi.extensions` key.

For the full extension API, see the [pi extensions documentation](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md).
