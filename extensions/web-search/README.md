# web-search

A Pi extension that adds a `web_search` tool — search the web and return structured results without leaving the agent session.

## What it does

`web_search` takes a query string and returns a list of results, each with a title, URL, and snippet. Agents use it to discover pages, then feed interesting URLs to `web_fetch` for full content.

```
Agent: "What's the latest version of React?"
  → web_search("React latest version")
  → Returns: [{title, url, snippet}, ...]
  → Agent picks a URL → web_fetch(url)
```

## Architecture

Mirrors `web-fetch`'s adapter pattern:

- **`SearchAdapter`** interface — one implementation per search provider
- **`DdgSearchAdapter`** — DuckDuckGo HTML scraping (fallback, may hit CAPTCHAs)
- **`BraveSearchAdapter`** — Brave Search API (primary, requires API key)
- **`SearXNGSearchAdapter`** — future, self-hosted

Swapping providers is a one-line change in `index.ts` — same interface, different backend.

## Configuration

### Brave Search API (recommended)

Set `BRAVE_API_KEY` as an environment variable, or store it in `~/.sandpiper/settings.json` under the `web-search` namespace:

```json
{
  "web-search": {
    "apiKey": "$BRAVE_API_KEY"
  }
}
```

The config resolver supports:
- **Literal strings**: `"sk-abc123"`
- **Env var references**: `"$BRAVE_API_KEY"` or `"BRAVE_API_KEY"` (all-uppercase)
- **Shell commands**: `"!op read op://vault/brave-api-key/password"` (prefix with `!`)

### DuckDuckGo (fallback)

No configuration needed. Works without an API key but may hit CAPTCHAs on repeated queries. Best for occasional use or when no API key is available.

## Result format

```json
[
  {
    "title": "Getting Started with Example",
    "url": "https://example.com/docs",
    "snippet": "A comprehensive guide to..."
  }
]
```

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | yes | — | The search query |
| `count` | integer | no | 5 | Max results (1–20) |

## Composing with web_fetch

The intended workflow:

1. `web_search("error message or topic")` → get URLs
2. `web_fetch(url)` → read the full page

Don't use `web_search` when the user already gives you a URL — go straight to `web_fetch`.

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

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
│   ├── ddg-adapter.ts        # DuckDuckGo HTML scraping adapter
│   ├── config-resolver.ts    # !cmd / $VAR / literal config value resolver
│   └── __fixtures__/         # Test fixtures (DDG SERP HTML)
├── package.json
├── tsconfig.json
└── vitest.config.ts
```
