# Web Fetch Tool — PRD

- **Diátaxis mode**: Reference spec
- **Status**: ✅ **MVP COMPLETE** (WEB-1 archived) | ✅ `llms.txt` probing complete (WEB-14) | ✅ targeted extraction complete (WEB-15, WEB-16) | ⏸️ **Deferred**: WEB-12, WEB-13
- **Date**: 2026-03-26
- **Implementation**: `extensions/web-fetch/`
- **Last verified**: 2026-05-14

---

## Implementation Status

| Feature                                     | Status         | Ticket |
| ------------------------------------------- | -------------- | ------ |
| Fetch single URL + return markdown          | ✅ Complete    | WEB-1  |
| Extract page links (followLinks)            | ✅ Complete    | WEB-1  |
| Passive `llms.txt` existence probing        | ✅ Complete    | WEB-14 |
| CSS selector targeting                      | ✅ Complete    | WEB-15 |
| Markdown section targeting                  | ✅ Complete    | WEB-16 |
| Markdown and plain-text responses unchanged | ✅ Complete    | WEB-18 |
| Section matching by parsed heading text     | ✅ Complete    | WEB-19 |
| Site's own Markdown version of a page       | ✅ Complete    | WEB-26 |
| `llms.txt` discovery by link and by path    | ✅ Complete    | WEB-25 |
| `llms.txt` instructions for the model       | ✅ Complete    | WEB-24 |
| JS rendering through a headless browser     | ✅ Complete    | WEB-10 |
| Single-query web search                     | ❌ Not started | WEB-11 |
| Site crawling with robots.txt               | ❌ Not started | WEB-12 |
| Browser automation                          | ❌ Not started | WEB-13 |

---

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
- Optionally target a specific page region via a filter (CSS selector or Markdown heading section)

### Deferred

| Capability                       | Why deferred                                                                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Site crawling** (scope 2)      | Ethical concerns — LLM crawling is contentious. Would need `robots.txt` respect, conservative rate limiting. No personal need identified.                                 |
| **Search + research** (scope 3)  | High value but latency concerns. Single-query search (API call + fetch top 3-5 results) is a natural v2. Deep research may need the background task framework (AGENT-15). |
| **Browser automation** (scope 4) | Valuable for personal-assistant agents but not a priority for a coding agent. Punt.                                                                                       |

## Architecture

### Extension + Tool

Implemented as a Pi extension (`extensions/web-fetch/`) with a `web_fetch` tool. The fetch→extract→convert pipeline is deterministic code in the harness, not LLM work. The tool returns clean markdown ready for the model to read.

### Framework-Independent Core

All logic lives in pure TypeScript modules; only `index.ts` imports Pi framework APIs.

```
extensions/web-fetch/src/
├── index.ts          # Pi glue: tool registration (thin)
├── fetch.ts          # HTTP fetching (fetch API wrapper)
├── extract.ts        # Content extraction (readability + jsdom)
├── convert.ts        # HTML → markdown (turndown)
└── ...
```

### Pipeline

```
HTML:  fetch(url) → raw HTML → optional CSS filter → jsdom/readability extract → turndown convert ─┐
Text:  fetch(url) → Markdown or plain text ────────────────────────────────────────────────────────┴→ Markdown text → optional section filter → TOON envelope
```

Both paths meet at Markdown text. A response served as `text/markdown`, `text/x-markdown` or `text/plain` takes the text path and is returned unchanged. Every other response takes the HTML path.

1. **`fetch(url)`** — standard Fetch API. Custom headers supported. Follows redirects.
2. **`jsdom`** — parse HTML into a DOM. **No JS execution, no remote resource fetching** (security: we're a parser, not a browser).
3. **Filter (optional)** — apply targeted extraction filters before or after conversion. CSS selector filters operate on parsed HTML before readability. Markdown section filters operate on the Markdown text of either path. The filter parses the text with `mdast-util-from-markdown`, finds the top-level headings, and slices the section out of the source text by offset, so the section keeps its original formatting. A heading matches when its plain text equals the requested text. When no heading matches exactly, headings that contain the requested text as a whole phrase match instead: `0.80.1` finds `## [0.80.1] - 2026-06-23` but not `## [0.80.10]`. Comparison ignores case, repeated whitespace and Markdown markup. A CSS selector filter on a text response returns an explanatory error.
4. **`@mozilla/readability`** — extract article content when no pre-readability filter is active. Returns structured object with title, excerpt, byline, siteName, and cleaned HTML body.
5. **`turndown`** — convert cleaned HTML to markdown. Preserves headings, code blocks, lists, tables, links. Far more token-efficient than raw HTML.
6. **Return** — TOON-encoded object with metadata + markdown body.

### The site's own Markdown version

A page a site wrote in Markdown is better than our conversion of its HTML. The pipeline gets it in two ways:

1. **Ask.** The request puts `text/markdown` first in its `Accept` header. A server that honors it answers with Markdown, which takes the text path.
2. **Follow.** When the answer is HTML and the page advertises `rel="alternate" type="text/markdown"`, in the `Link` header or a `<link>` element, the pipeline fetches that URL and returns its content. The title and description still come from the HTML page, and the result names the Markdown URL.

An advertised version is followed only on the page's own origin, and only when it answers with a text media type. Otherwise the HTML page is converted as usual. The pipeline does not guess `.md` URLs. A CSS selector filter needs a DOM, so those calls ask for HTML and ignore the Markdown version.

### `llms.txt` discovery

An `llms.txt` file is a site's index of its pages for language models ([llmstxt.org](https://llmstxt.org/)). A file covers the pages under its directory, and the most specific file wins.

1. **Declared.** A page can name its file with `rel="describedby"`, in the `Link` header or a `<link>` element. A target whose path ends in `/llms.txt` is taken as found without a request.
2. **Probed.** Otherwise the pipeline sends a `HEAD` request to the `llms.txt` location of each directory above the page, all at once, and uses the most specific answer that is a 2xx with a Markdown media type. `text/plain` counts as Markdown, because that is how servers send these files. An HTML answer does not count: some servers answer every path with a 200 page. A deep page probes the root and the three directories nearest to it.

Discovery starts together with the page request, and the result waits for it, so output does not depend on timing. Each location is asked once per process. A failure or timeout is kept as the answer: some sites resist automated requests, and a missed file costs little. The file's content is not read.

When a file is found, the tool result ends with an `<additional_content>` block that holds an `<instructions>` element and the file's URL. The instructions tell the model what the index is and how to read one part of it. The block is left out when the fetched page is the file itself.

### Rendered fetch

Some pages build their content with JavaScript. A call that sets `render`, or names a `renderer`, goes through a `RendererFetchAdapter`, which asks a renderer for the page. The rest of the pipeline is unchanged, except that the site's Markdown version is not followed: the caller asked for the rendered page.

A renderer is code that drives one browser and returns a normalized result: the HTML, and where the browser reports them the final URL, status, headers, and a `blocked` reason. Browsers differ in their options and in how they report failures, so each renderer owns that translation. See [the extension README](../../../extensions/web-fetch/README.md) for the contract.

`web_fetch` has no renderer of its own. Renderers reach it the way prompt contributions reach the prompt builder ([explanation](../../../docs/dev/prompt-contributions.md)):

1. `session_start`: `web_fetch` listens on the `sandpiper:web-fetch-renderer` event bus channel.
2. `resources_discover`: an extension emits its renderer on that channel.
3. First `before_agent_start`: `web_fetch` takes the registered renderers and registers its tool again with the matching parameters.

Sandpiper bundles a Lightpanda renderer and an Obscura renderer as two inline extensions. They use the same channel and contract as a renderer from any other extension, and each registers only when its browser is on `PATH`.

The registration carries a `render` function that `web_fetch` calls directly. The event bus is not used for the request and the result: it is synchronous, returns nothing, and drops messages that have no listener.

The tool's schema offers only what can run. With no renderer there is no `render` parameter. With one, `render` is added. With two or more, a `renderer` parameter lists their ids, and the first id in order is the default. Id order, not load order, so the default does not depend on which extension loaded first. No environment variable or setting selects a renderer: the caller chooses for each fetch, which lets it try another browser when one reports `blocked`.

The tool is registered twice on purpose. Pi copies each tool's prompt entry before the `before_agent_start` handlers run, so a tool first registered in a handler would be missing from the first prompt and would arrive as a prompt change on the next run. Registering at load puts the entry in place. Registering again on the first run changes only the parameter schema, before any request is sent. `devtools/integration/web-fetch-render.integration.test.ts` checks this in a real session.

Every renderer gets a command runner that starts a process from an argument list, never through a shell, and only a normalized `http` or `https` URL is passed in. The Lightpanda Node package was rejected because it builds a shell command from the URL.

Rendering is explicit, not an automatic fallback: a page of loading placeholders looks like valid content, and automated browsers are refused by sites that a normal fetch can read.

### Adapter Interface

The fetch layer should use an adapter interface so JS-rendering backends (lightpanda, Playwright) can slot in later without changing the tool's public API:

```typescript
interface FetchAdapter {
  fetch(url: string, options?: { htmlOnly?: boolean }): Promise<FetchResult>;
}

// MVP: SimpleFetchAdapter (uses global fetch())
// v2:  LightpandaAdapter, PlaywrightAdapter
```

### Tool API

```typescript
// Input
{
  url: string;            // Required — the URL to fetch
  filter?: WebFetchFilter; // Optional — targeted extraction filter
  followLinks?: boolean;   // Optional — extract and return page links
}

// Output
{
  url: string;            // Final URL (after redirects)
  title: string;          // Page title
  excerpt: string;        // Short description/excerpt
  byline: string;         // Author (if detected)
  siteName: string;       // Site name (if detected)
  content: string;        // Markdown body
  markdownSource?: string; // URL of the site's own Markdown version, when the content came from it
  filter?: {              // Targeted extraction metadata (when filter is provided)
    type: 'css_selector' | 'markdown_section';
    matched: boolean;
    matchCount: number;
    error?: string;
  };
  links?: Array<{ text: string; href: string }>;  // Extracted links (when followLinks=true)
  llmsTxt?: {                   // llms.txt discovery result (declared by the page, or probed)
    checked: boolean;
    exists: boolean | null;     // null means unknown/indeterminate
    status: 'found' | 'missing' | 'unknown';
    url: string;
    checkedAt: string;
    statusCode?: number;
    reason?: string;
    allow?: string;
  };
}

type WebFetchFilter =
  | { type: 'css_selector'; selector: string }
  | { type: 'markdown_section'; heading: string; level?: number };
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

When we have real sites that fail with `fetch()`, we add lightpanda as an adapter (v2). That happened under WEB-10; see Rendered fetch above.

### Why jsdom with no JS execution?

Security and correctness. We're parsing HTML structure, not running a web application. Enabling JS execution would mean running arbitrary untrusted code from the fetched page. Remote resource fetching would leak requests and slow down parsing. The default jsdom configuration (no JS, no remote resources) is correct.

## Dependencies

| Package                    | Purpose                | Justification                                                                 |
| -------------------------- | ---------------------- | ----------------------------------------------------------------------------- |
| `@mozilla/readability`     | Content extraction     | Firefox Reader View algorithm — no reasonable way to replicate in a few lines |
| `jsdom`                    | HTML → DOM parsing     | Required by readability; standard DOM implementation for Node.js              |
| `turndown`                 | HTML → markdown        | Handles all HTML element types, edge cases, and nesting correctly             |
| `mdast-util-from-markdown` | Markdown → syntax tree | The parser behind `remark`; gives each heading its source offsets             |
| `mdast-util-to-string`     | Heading plain text     | Resolves links, emphasis and code spans to the text a reader sees             |

All are pure JS, no native addons. Bundled at build time into the extension.

## References

- [Mozilla Readability](https://github.com/mozilla/readability) — content extraction library
- [jsdom](https://github.com/jsdom/jsdom) — DOM implementation for Node.js
- [Turndown](https://github.com/mixmark-io/turndown) — HTML to markdown converter
