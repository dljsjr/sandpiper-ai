# Web Fetch Tool — PRD

**Date:** 2026-03-26
**Ticket:** WEB-1
**Status:** Design complete, implementation not started

## Problem

The agent frequently needs to read web content — documentation, READMEs, API references, package details, issue threads — but is limited to `curl` for raw content or relying on (potentially stale) training data. A proper web fetch tool turns speculative answers into verified ones.

## Scope

### MVP (WEB-1)

**"Here's a URL, read the contents."** The user provides a URL and the agent returns clean, readable content extracted from the page.

- Fetch a single URL, return structured metadata + markdown body
- Optionally extract and return page links for the agent to decide whether to follow
- Optionally target a specific page region via CSS selector

### Deferred

| Capability | Why deferred |
|-----------|-------------|
| **Site crawling** (scope 2) | Ethical concerns — LLM crawling is contentious. Would need `robots.txt` respect, conservative rate limiting. No personal need identified. |
| **Search + research** (scope 3) | High value but latency concerns. Single-query search (API call + fetch top 3-5 results) is a natural v2. Deep research may need the background task framework (AGENT-15). |
| **Browser automation** (scope 4) | Valuable for personal-assistant agents but not a priority for a coding agent. Punt. |
| **JS rendering** (lightpanda) | Most sites an agent reads are SSR (docs, GitHub, npm, MDN, Stack Overflow). Deferred to v2 when we have real failure cases. Adapter interface designed to accommodate it later. |

## Architecture

### Extension + Tool

Implemented as a Pi extension (`extensions/web-fetch/`) with a `web_fetch` tool. The fetch→extract→convert pipeline is deterministic code in the harness, not LLM work. The tool returns clean markdown ready for the model to read.

### Framework-Independent Core

Same pattern as shell-relay: all logic in pure TypeScript modules, only `index.ts` imports Pi framework APIs.

```
extensions/web-fetch/
├── index.ts          # Pi glue: tool registration (thin)
├── fetch.ts          # HTTP fetching (fetch API wrapper)
├── extract.ts        # Content extraction (readability + jsdom)
├── convert.ts        # HTML → markdown (turndown)
└── ...
```

### Pipeline

```
fetch(url) → raw HTML → jsdom parse → readability extract → turndown convert → TOON envelope
```

1. **`fetch(url)`** — standard Fetch API. Custom headers supported. Follows redirects.
2. **`jsdom`** — parse HTML into a DOM. **No JS execution, no remote resource fetching** (security: we're a parser, not a browser).
3. **`@mozilla/readability`** — extract article content. Returns structured object with title, excerpt, byline, siteName, and cleaned HTML body.
4. **`turndown`** — convert cleaned HTML to markdown. Preserves headings, code blocks, lists, tables, links. Far more token-efficient than raw HTML.
5. **Return** — TOON-encoded object with metadata + markdown body.

### Adapter Interface

The fetch layer should use an adapter interface so JS-rendering backends (lightpanda, Playwright) can slot in later without changing the tool's public API:

```typescript
interface FetchAdapter {
  fetch(url: string, options?: FetchOptions): Promise<FetchResult>;
}

// MVP: SimpleFetchAdapter (uses global fetch())
// v2:  LightpandaAdapter, PlaywrightAdapter
```

### Tool API

```typescript
// Input
{
  url: string;            // Required — the URL to fetch
  selector?: string;      // Optional — CSS selector to extract specific content
  followLinks?: boolean;  // Optional — extract and return page links
}

// Output
{
  url: string;            // Final URL (after redirects)
  title: string;          // Page title
  excerpt: string;        // Short description/excerpt
  byline: string;         // Author (if detected)
  siteName: string;       // Site name (if detected)
  content: string;        // Markdown body
  links?: Array<{ text: string; href: string }>;  // Extracted links (when followLinks=true)
}
```

## Design Decisions

### Why `fetch()` over `curl`?

`fetch()` is built into Node.js/Bun, zero dependencies, supports custom headers and redirect following, and returns the response as a string we can pipe directly to jsdom. No subprocess overhead. `curl` would work but adds shell escaping complexity for no benefit.

### Why readability over manual HTML stripping?

Readability (the Firefox Reader View algorithm) is battle-tested on millions of real-world pages. Manual stripping (removing `<nav>`, `<footer>`, `<script>` tags) misses site-specific content wrappers, ad containers, and non-standard layouts. Readability uses scoring heuristics to identify the actual article content regardless of page structure.

### Why turndown (markdown) over himalaya (AST → TOON)?

Token efficiency. An HTML AST encoded as TOON carries per-node overhead (`type`, `tagName`, `children` for every element). For a typical documentation page, the AST version is 3-5× larger than the equivalent markdown. Markdown was literally designed as a compact human-readable encoding of document structure — it's the right format for this problem. Models also read markdown natively.

### Why not lightpanda in the MVP?

Three reasons:
1. Most sites an agent reads are server-rendered or have good static HTML. The "needs JS" case is uncommon for documentation, GitHub, npm, etc.
2. Adding lightpanda means dependency detection (is it installed?), platform support, and fallback orchestration — complexity that distracts from the core value.
3. The content extraction pipeline (readability + turndown) is where the actual quality lives. A perfectly fetched SPA handed to the model as raw HTML is worse than a `fetch()`-only page run through proper extraction.

When we have real sites that fail with `fetch()`, we add lightpanda as an adapter (v2).

### Why jsdom with no JS execution?

Security and correctness. We're parsing HTML structure, not running a web application. Enabling JS execution would mean running arbitrary untrusted code from the fetched page. Remote resource fetching would leak requests and slow down parsing. The default jsdom configuration (no JS, no remote resources) is correct.

## Dependencies

| Package | Purpose | Justification |
|---------|---------|---------------|
| `@mozilla/readability` | Content extraction | Firefox Reader View algorithm — no reasonable way to replicate in a few lines |
| `jsdom` | HTML → DOM parsing | Required by readability; standard DOM implementation for Node.js |
| `turndown` | HTML → markdown | Handles all HTML element types, edge cases, and nesting correctly |

All are pure JS, no native addons. Bundled at build time into the extension.

## References

- [Mozilla Readability](https://github.com/mozilla/readability) — content extraction library
- [jsdom](https://github.com/jsdom/jsdom) — DOM implementation for Node.js
- [Turndown](https://github.com/mixmark-io/turndown) — HTML to markdown converter
