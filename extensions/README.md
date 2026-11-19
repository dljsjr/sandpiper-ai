# Extensions

Pi extensions that extend the coding agent with custom tools, lifecycle hooks, and commands.

## Contents

| Extension                    | Description                                                               |
| ---------------------------- | ------------------------------------------------------------------------- |
| [`system/`](system/)         | Sandpiper identity, lifecycle behavior, and core tools                    |
| [`autotoon/`](autotoon/)     | AutoTOON Pi adapter and framework-independent JSON→TOON transform         |
| [`tattler/`](tattler/)       | Tattler peer messaging: `list_peers`, `send_peer_message`, and the inbox  |
| [`chorus.ts`](chorus.ts)     | Chorus rooms: the `/chorus` and `/agent` commands and `send_chorus_reply` |
| [`web-fetch/`](web-fetch/)   | The `web_fetch` tool                                                      |
| [`web-search/`](web-search/) | The `web_search` tool                                                     |

### system/

`system/` owns Sandpiper identity and startup behavior, prompt assembly, session continuity, the model-callable `skill` tool, background process tools, completion hooks, context usage notices, and the clock.

The clock (`system/clock.ts`) adds a hidden message at the start of every run: a bare `<clock currentTime="…" timeSinceLastMessage="…" previousTurnDuration="…"/>` element. It is not wrapped in a system notification, to save about 100 characters per run; the `<system_notification_protocol>` prompt section says what it is.

- `currentTime` is the local time with its UTC offset and IANA zone.
- `timeSinceLastMessage` is the time since the last message in the session branch, so it includes time the session sat idle.
- `previousTurnDuration` is how long the previous run took, from `before_agent_start` until `agent_settled`, so it leaves idle time out. When a run settles, the clock saves its duration as a `sandpiper:clock-run` custom entry (`{ version: 1, durationMs }`) and reads the latest one from the branch, so the value survives reload and resume.

An attribute with no data, such as either duration on the first run of a session, is left out.

The context management hooks (`system/context-management.ts`) add two more hidden bare elements, which the `<system_notification_protocol>` prompt section also describes:

- `<model provider="…" id="…" name="…"/>` at the start of the first run on a model, and again after a switch. It goes out as that run's starting message, so the model knows at once.
- `<contextUsage percentUsed="…" tokensLeft="…" contextWindow="…"/>` at the end of the first turn in each 10% step of the context window, with token counts in `k` or `M`. It is appended at `turn_end`, so it reaches the next model request of the same run, or waits in history after the run's last response; it never starts a request. The report that first reaches 80% also carries a system notification telling the agent to save anything it must not lose.

Both read their last report back from the session branch (`sandpiper:model` and `sandpiper:context-usage` custom messages, `details.version` 1), so they survive reload and resume. A context usage reading that dips and rises again is not reported twice. A compaction starts both over, since its summary may drop earlier reports: the next run names the model again, and the usage steps restart.

The entrypoints are intentionally thin glue layers. Framework-independent logic belongs in `packages/core/` or focused extension-local modules. Pi-specific system wiring lives under `extensions/system/`.

As sandpiper grows, prefer keeping entrypoints thin and pushing reusable logic into `packages/core/` or focused extension-local modules rather than expanding a single large file.

### autotoon

`autotoon/autotoon.ts` is the Pi `tool_result` adapter. It calls the host-neutral JSON→TOON transform in `extensions/autotoon/core.ts`.

## How Extensions Work

Extensions are TypeScript modules that export a default function receiving the `ExtensionAPI`. They can register tools, subscribe to events, add commands, and interact with users.

Sandpiper registers its built-in extensions explicitly in `packages/cli/sandpiper_resources.ts`.

For the full extension API, see the [pi extensions documentation](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md).
