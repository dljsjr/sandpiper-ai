# SCOUT: DuckDuckGo HTML Search Surface

Scout of the `html.duckduckgo.com/html/` endpoint and the OpenClaw `duckduckgo` extension
prior art. Conducted 2026-06-07 by Huginn.

## Prior Art: OpenClaw

OpenClaw's `extensions/duckduckgo/` is a well-structured plugin at
`github.com/openclaw/openclaw`. Key files:

| File | Purpose |
|------|---------|
| `src/ddg-client.ts` (~250 lines) | Core DDG scrape: HTTP fetch, HTML parse, URL decode. The heavy lifter. |
| `src/config.ts` | Region (`kl`) and safeSearch (`kp`) config helpers. |
| `src/ddg-search-provider.ts` | OpenClaw plugin integration (not relevant to our Pi extension). |
| `index.ts` | Entrypoint — registers the provider with OpenClaw's `api.registerWebSearchProvider()`. |
| `web-search-contract-api.ts` | Public contract wrapper. |

The structure is OpenClaw-specific (`definePluginEntry`, `WebSearchProviderPlugin` contract),
but the **core scraping logic in `ddg-client.ts` is fully reusable** — it has no OpenClaw
imports in the fetch-and-parse path.

## Endpoint

```
GET https://html.duckduckgo.com/html
Params:
  q=<query>        (required)
  kl=<region>      (optional, e.g. "us-en", "wt-wt" for worldwide)
  kp=<safesearch>  (optional: "1" strict, "-1" moderate, "-2" off)
```

Returns HTML directly — no JSON API. The page is a standard SERP with CSS-classed
result containers.

## SERP HTML Structure

Each organic result is a `<div>` with class `result` containing an `<a>` with class
`result__a`:

```html
<div class="result results_links results_links_deep highlight_d">
  <div class="links_main links_deep result__body">
    <a rel="nofollow noopener noreferrer" class="result__a"
       href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage">
      <b>Example</b> Site Title
    </a>
    <a class="result__snippet" href="...">
      This is a <b>description</b> snippet of the result...
    </a>
    <span class="result__url">example.com</span>
  </div>
</div>
```

### Key selectors / extraction points

1. **Title + URL** — `<a class="result__a">` element. The `href` attribute contains a
   DDG redirect URL. Extract with: `/<a[^>]*class="[^"]*\bresult__a\b[^"]*"/i` then
   pull the `href` from attributes.
2. **Snippet** — `<a class="result__snippet">` sibling, plain text after stripping HTML.
3. **Real URL** — DuckDuckGo wraps destination URLs in `/l/?uddg=<base64>`. The `uddg`
   query param is the real URL. Decode with `decodeURIComponent()`.

### OpenClaw's regex approach (proven, not fragile)

```typescript
// Pattern to find each result anchor
const resultRegex = /<a[^>]*\bclass="[^"]*\bresult__a\b[^"]*"([^>]*)>([\s\S]*?)<\/a>/gi;
const result__a class="[^"]*\bresult__a\b[^"]*"  # result anchor
const snippetRegex = /<a[^>]*\bclass="[^"]*\bresult__snippet\b[^"]*"[^>]*>([\s\S]*?)<\/a>/i;
```

The regex approach works because DDG's static HTML SERP is consistently structured.
OpenClaw has been using this pattern in production and it's survived DDG's layout changes.

### URL decoding

Two steps:
1. `decodeHtmlEntities()` — standard HTML entity decoding (`&amp;`, `&lt;`, `&#123;`, etc.)
2. `decodeDuckDuckGoUrl()` — extract the `uddg` query parameter from the redirect URL.
   If `uddg` is present, return it; otherwise return the URL as-is (for direct links).

## ⚠️ Bot detection

DDG actively blocks non-browser HTTP clients. OpenClaw's `isBotChallenge()` checks for:

```typescript
/g-recaptcha|are you a human|id="challenge-form"|name="challenge"/i
```

**Critical finding from live testing (Piper, 2026-06-07):** A request with a standard
Chrome UA string from a server environment triggered a CAPTCHA *on the first request*.
This is not a rate-limiting issue — DDG appears to distinguish server-side IP ranges
from consumer IPs and blocks aggressively.

**Implications:**
- DDG scraping is **not reliable** as the primary search path for an agent tool.
- The adapter is still worth building as a **fallback** for the zero-config case,
  but it should expect to fail with a clear error message when CAPTCHA is detected.
- **Brave Search API is the recommended primary adapter.** Clean JSON, no scraping,
  generous free tier (2k queries/month), no CAPTCHA risk.

## OpenClaw's rate limiting and caching

| Feature | Implementation |
|---------|---------------|
| User-Agent | `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (Chrome/122)` |
| Cache | In-memory `Map<string, {value, insertedAt, expiresAt}>` with TTL |
| Timeout | Default 20s, configurable |
| Error handling | Throws on non-200, throws on CAPTCHA, returns `{results, query, count, tookMs}` |

## Adapter Estimate

The DDG `SearchAdapter` implementation is approximately **150–200 lines** of TypeScript:

| Component | Est. Lines | Notes |
|-----------|-----------|-------|
| `search()` method | ~20 | Endpoint URL construction, fetch call, error handling |
| HTML fetch | ~30 | User-Agent header, timeout, abort signal wiring |
| `parseDdgHtml()` | ~60 | Regex extraction of result anchors + snippets |
| `isBotChallenge()` | ~10 | Check for CAPTCHA response markers |
| `decodeHtmlEntities()` | ~30 | Entity decoding (+ URL decoding helpers) |
| HTML stripping | ~10 | `stripHtml()` for clean text |

## Brave Adapter for Comparison

The Brave Search API is dramatically simpler — no HTML parsing at all:

```
GET https://api.search.brave.com/res/v1/web/search
Header: X-Subscription-Token: <key>
Params: q=<query>&count=<n>
Response JSON: web.results[].{title, url, description}
```

The adapter just maps the JSON fields to `SearchResultItem`. No regex, no CAPTCHA,
no URL decoding. ~40 lines of code.
