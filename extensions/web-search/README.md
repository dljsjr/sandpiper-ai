# web-search

A Pi extension that adds a `web_search` tool — search the web and return structured results without leaving the agent session.

## What it does

`web_search` takes a query string and returns a list of results, each with a title, URL, and snippet. Agents use it to discover pages, then feed interesting URLs to `web_fetch` for full content.

```
Agent: "What's the latest version of React?"
  → web_search("React latest version")
  → Returns: numbered results, each with title, URL, snippet
  → Agent picks a URL → web_fetch(url)
```

## Architecture

Mirrors `web-fetch`'s adapter pattern:

- **`SearchAdapter`** interface — one implementation per search provider
- `BraveSearchAdapter` uses the Brave Search API as the primary provider when its key resolves.
- `ParallelMcpSearchAdapter` uses Pi's standalone MCP client for the anonymous Parallel fallback.

Provider selection lives in `src/adapter-selection.ts`. Parallel runs behind our existing `web_search` tool. It does not register upstream tools or require a separate MCP server configuration.

The adapter uses Pi's standalone MCP client (`@earendil-works/pi-mcp`), not Pi's host-managed MCP servers. A host-managed server would register Parallel's own tools with the model. The standalone client keeps our tool name, schema, provider selection, and result format, and reads no user MCP configuration or credentials.

## Configuration

### Brave Search API (recommended)

Set `BRAVE_API_KEY` as an environment variable, or store it as `braveApiKey` under the `web-search` namespace in `settings.json`.

The extension reads `.sandpiper/settings.json` in the session's working directory only when Pi trusts that project. It then checks `settings.json` in the agent directory (`~/.sandpiper/agent/` by default). Environment values take priority, and agent settings remain available without project trust:

```json
{
  "web-search": {
    "braveApiKey": "$BRAVE_API_KEY"
  }
}
```

The config resolver supports:

- **Literal strings**: `"sk-abc123"`
- **Env var references**: `"$BRAVE_API_KEY"` or `"${BRAVE_API_KEY}"`. A bare `"BRAVE_API_KEY"` is a literal string.
- **Shell commands**: `"!op read op://vault/brave-api-key/password"` (prefix with `!`)

### Parallel (anonymous fallback)

No API key or separate MCP server configuration is needed. Our `web_search` tool calls Parallel through Pi's standalone MCP client. Upstream tools do not enter the model's tool catalogue.

## Timeouts and limits

- A Brave request has a 10-second limit.
- A Parallel search has a 60-second limit for connection setup, including the client's initialized notification, and a 15-second limit for the tool call. Each search opens its own client and ends with best-effort session cleanup, which cannot replace a result with a close error.
- Cancelling the turn does not stop a search that is already running.
- The Parallel path speaks Streamable HTTP only, not the older HTTP+SSE transport, and has no sign-in: an authentication failure is reported as an error.
- An MCP tool error result from Parallel is not reported as an error. Its text does not parse as search results, so the tool reports no results.

## Result format

The tool returns numbered text, with the provider name in the header line:

```
Search results for "example docs" (via brave):

1. Getting Started with Example
   https://example.com/docs
   A comprehensive guide to...
```

When nothing matches, it returns `No results for "example docs" (via brave).`

## Parameters

| Parameter | Type    | Required | Default | Description        |
| --------- | ------- | -------- | ------- | ------------------ |
| `query`   | string  | yes      | —       | The search query   |
| `count`   | integer | no       | 5       | Max results (1–20) |

## Composing with web_fetch

The intended workflow:

1. `web_search("error message or topic")` → get URLs
2. `web_fetch(url)` → read the full page

Don't use `web_search` when the user already gives you a URL — go straight to `web_fetch`.

## Development

```bash
# Install dependencies
bun install

# Run tests from the repository root
bun run test:vitest -- extensions/web-search

# Type check
bunx tsc --noEmit
```

## File layout

```
extensions/web-search/
└── src/
    ├── index.ts              # Pi extension entry point
    ├── types.ts              # SearchAdapter interface + result types
    ├── tool-metadata.ts      # LLM-facing description, promptSnippet, param docs
    ├── tool-operation.ts     # Framework-independent execution logic
    ├── adapter-selection.ts  # Picks the adapter: Brave when a key resolves, otherwise Parallel
    ├── brave-adapter.ts      # Brave Search API adapter
    ├── parallel-adapter.ts   # Parallel MCP search adapter (anonymous fallback)
    └── config-resolver.ts    # !cmd / $VAR / literal config value resolver
```
