# Extensions

Pi extensions that extend the coding agent with custom tools, lifecycle hooks, and commands.

## Contents

| Extension                    | Description                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------- |
| [`system/`](system/)         | Sandpiper identity, lifecycle behavior, and core tools                          |
| [`autotoon/`](autotoon/)     | AutoTOON Pi adapter and framework-independent JSON→TOON transform |
| [`tattler/`](tattler/)       | Tattler peer messaging: `list_peers`, `send_peer_message`, and the inbox        |
| [`chorus.ts`](chorus.ts)     | Chorus rooms: the `/chorus` and `/agent` commands and `send_chorus_reply`       |
| [`web-fetch/`](web-fetch/)   | The `web_fetch` tool                                                            |
| [`web-search/`](web-search/) | The `web_search` tool                                                           |

### system/

`system/` owns Sandpiper identity and startup behavior, prompt assembly, session continuity, the model-callable `skill` tool, background process tools, and completion hooks.

The entrypoints are intentionally thin glue layers. Framework-independent logic belongs in `packages/core/` or focused extension-local modules. Pi-specific system wiring lives under `extensions/system/`.

As sandpiper grows, prefer keeping entrypoints thin and pushing reusable logic into `packages/core/` or focused extension-local modules rather than expanding a single large file.

### autotoon

`autotoon/autotoon.ts` is the Pi `tool_result` adapter. It calls the host-neutral JSON→TOON transform in `extensions/autotoon/core.ts`.

## How Extensions Work

Extensions are TypeScript modules that export a default function receiving the `ExtensionAPI`. They can register tools, subscribe to events, add commands, and interact with users.

Sandpiper registers its built-in extensions explicitly in `packages/cli/sandpiper_resources.ts`.

For the full extension API, see the [pi extensions documentation](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md).
