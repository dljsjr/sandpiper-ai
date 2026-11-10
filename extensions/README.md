# Extensions

Pi extensions that extend the coding agent with custom tools, lifecycle hooks, and commands.

## Contents

| Extension                | Description                                                                  |
| ------------------------ | ---------------------------------------------------------------------------- |
| [`system/`](system/)     | Sandpiper identity, lifecycle behavior, and core tools                       |
| [`autotoon/`](autotoon/) | Pi entrypoint for the AutoTOON capability in `packages/capability-autotoon/` |

### system/

`system/` owns Sandpiper identity and startup behavior, prompt assembly, session continuity, diagnostics, the model-callable `skill` tool, background process tools, and completion hooks.

The entrypoints are intentionally thin glue layers. Framework-independent logic belongs in `packages/core/` or focused extension-local modules. Pi-specific system wiring lives under `extensions/system/`.

As sandpiper grows, prefer keeping entrypoints thin and pushing reusable logic into `packages/core/` or focused extension-local modules rather than expanding a single large file.

### autotoon

`autotoon/` is the Pi entrypoint. The source of truth lives in `packages/capability-autotoon/`: `src/core.ts` contains the host-neutral JSON→TOON transform, while `src/pi-extension.ts` contains the Pi `tool_result` adapter.

## How Extensions Work

Extensions are TypeScript modules that export a default function receiving the `ExtensionAPI`. They can register tools, subscribe to events, add commands, and interact with users.

Sandpiper registers its built-in extensions explicitly in `packages/cli/sandpiper_resources.ts`. Directory extensions can also declare an entrypoint in `package.json` under `pi.extensions` for direct local Pi experiments.

For the full extension API, see the [pi extensions documentation](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md).
