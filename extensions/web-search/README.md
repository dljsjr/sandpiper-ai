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
- `DdgSearchAdapter` remains available for explicit use. It is not the automatic fallback.

Provider selection lives in `src/adapter-selection.ts`. Parallel runs behind our existing `web_search` tool. It does not register upstream tools or require a separate MCP server configuration.

## Configuration

### Brave Search API (recommended)

Set `BRAVE_API_KEY` as an environment variable, or store it as `braveApiKey` under the `web-search` namespace in `settings.json`. The extension reads `.sandpiper/settings.json` in the working directory first, then `settings.json` in the agent directory (`~/.sandpiper/agent/` by default):

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

Connection setup has a 60-second limit. The tool-call limit defaults to 15 seconds, followed by best-effort session cleanup.

### DuckDuckGo (explicit adapter)

No configuration needed. Works without an API key but may hit CAPTCHAs on repeated queries. Best for occasional use or when no API key is available.

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
├── src/
│   ├── index.ts              # Pi extension entry point
│   ├── types.ts              # SearchAdapter interface + result types
│   ├── tool-metadata.ts      # LLM-facing description, promptSnippet, param docs
│   ├── tool-operation.ts     # Framework-independent execution logic
│   ├── adapter-selection.ts  # Picks the adapter: Brave when a key resolves, otherwise Parallel
│   ├── brave-adapter.ts      # Brave Search API adapter
│   ├── parallel-adapter.ts   # Parallel MCP search adapter (anonymous fallback)
│   ├── ddg-adapter.ts        # DuckDuckGo HTML scraping adapter
│   ├── config-resolver.ts    # !cmd / $VAR / literal config value resolver
│   └── __fixtures__/         # Test fixtures (DDG SERP HTML)
├── package.json
└── vitest.config.ts
```
