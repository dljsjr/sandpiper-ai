# Extensions

Pi extensions that extend the coding agent with custom tools, lifecycle hooks, and commands.

## Contents

| Extension | Description |
|-----------|-------------|
| [`system.ts`](system.ts) | Core sandpiper extension — reconfigures pi with sandpiper-specific customizations (identity, update checks, etc.) |
| [`shell-relay/`](shell-relay/) | Shared terminal session between user and agent via Zellij |

### system.ts

The central sandpiper extension. This is the main integration point between the pi framework and sandpiper's custom behavior. Currently it:

- Injects the sandpiper identity into the system prompt (config directory paths, version info)
- Checks the npm registry for pi-coding-agent updates and notifies the user on session start

As sandpiper grows, additional pi customizations should be added here rather than creating new single-purpose extensions.

### shell-relay

A multi-module extension providing a shared terminal session. See its own [README](shell-relay/README.md) for full documentation.

## How Extensions Work

Extensions are TypeScript modules that export a default function receiving the `ExtensionAPI`. They can register tools, subscribe to events, add commands, and interact with users.

Single-file extensions (like `system.ts`) and directory extensions (like `shell-relay/`) both load from source via Pi's jiti runtime. Directory extensions declare their entry point in `package.json` under the `pi.extensions` key.

For the full extension API, see the [pi extensions documentation](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md).
