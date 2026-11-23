# web-fetch

A Pi extension that adds a `web_fetch` tool. It fetches one web page and returns its content as Markdown.

## What it returns

- An HTML page is reduced to its main content and converted to Markdown.
- A Markdown or plain-text response is returned unchanged.
- When a site offers its own Markdown version of a page, that version is returned and its URL is shown as `Markdown source`.
- When the page links to related pages or to an index for agents, the result ends with an `<additional_content>` block that lists them. See [Additional content](#additional-content).

Cancelling the turn, for example with Escape, stops a fetch that is still running, including a page that a headless browser is loading.

## Parameters

| Parameter     | Type    | Required | Description                                                                                           |
| ------------- | ------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `url`         | string  | yes      | The page to fetch                                                                                     |
| `followLinks` | boolean | no       | Also return the links found in the content                                                            |
| `filter`      | object  | no       | Return one part of the page: a CSS selector or a Markdown section                                     |
| `render`      | boolean | no       | Load the page in a headless browser first. Present only when exactly one renderer is registered       |
| `renderer`    | string  | no       | `none`, or the id of the renderer to load the page with. Present only when two or more are registered |

### Filters

| Filter             | Fields                        | Applies to                                                                   |
| ------------------ | ----------------------------- | ---------------------------------------------------------------------------- |
| `css_selector`     | `selector`                    | HTML pages. Returns every matching element                                   |
| `markdown_section` | `heading`, `level` (optional) | The Markdown text. Returns the section under a heading, with its subsections |

A heading matches when its text equals the requested text. When no heading is an exact match, headings that contain the text as a whole phrase match: `0.80.1` finds `## [0.80.1] - 2026-06-23` but not `## [0.80.10]`. Matching ignores case, repeated whitespace, and Markdown markup, and every matching section is returned.

## How a page is read

`web_fetch` requests the page with the Fetch API, follows redirects, and gives up after 30 seconds. A status of 400 or more is returned as `HTTP error: <status>`.

The response's media type picks the path. A `text/markdown`, `text/x-markdown`, or `text/plain` response is Markdown text and is returned as it is. Every other response is read as HTML:

1. jsdom parses the HTML. It runs no scripts and loads no remote resources.
2. A `css_selector` filter keeps the matching elements. Without one, Readability extracts the main content and the title, excerpt, byline, and site name. When Readability finds no content, the whole page is converted.
3. Turndown converts the HTML to Markdown.

A `markdown_section` filter works on the Markdown text from either path. It finds the headings at the top level of the document and cuts each matching section out of the source text, so the section keeps its original formatting. A `css_selector` filter on a Markdown or plain-text response returns an error.

### The site's own Markdown version

A page that a site wrote in Markdown is better than a conversion of its HTML. `web_fetch` gets that version in two ways:

1. The request lists `text/markdown` first in its `Accept` header. A server that honors it answers with Markdown.
2. When the answer is HTML and the page advertises `rel="alternate" type="text/markdown"`, in its `Link` header or a `<link>` element, `web_fetch` fetches that URL. It uses the answer only when the URL is on the page's own origin, is not an `llms.txt` file such as `llms-full.txt`, and the answer has a Markdown media type. An `llms.txt` file covers many pages, and one site declares its whole-site file as the Markdown version of every page. The title and the other metadata still come from the HTML page.

`web_fetch` does not guess `.md` URLs. A call with a `css_selector` filter or with rendering asks for HTML and ignores the Markdown version.

### `llms.txt` discovery

An `llms.txt` file is a site's index of its pages for language models ([llmstxt.org](https://llmstxt.org/)). It covers the pages under its directory, and the most specific file wins.

- **Declared**: a page can name its file with `rel="describedby"`, as llms.txt recommends, or with `rel="index"`, as GitHub Docs does, in its `Link` header or a `<link>` element, with a target whose path ends in `/llms.txt`. A declared file is taken as found without a request.
- **Probed**: otherwise `web_fetch` sends a `HEAD` request to the `llms.txt` location of each directory above the page, all at once, and uses the most specific answer that is a 2xx with a Markdown media type. `text/plain` counts. An HTML answer does not, because some servers answer every path with a page. A deep page probes only the root and the first three directory levels of its path. Each probe waits up to 3 seconds.

Discovery starts together with the page request. Each location is probed once per process, and a failure or timeout is kept as the answer. The file's content is not read. A found file is listed in the result's [additional content](#additional-content), except when the fetched page is the file itself.

### Additional content

When the page leads to more information, the result ends with an `<additional_content>` block. Its elements come from the page's `<link>` elements and its `Link` header, and from `llms.txt` discovery. Each element appears only when the page provides it, always in this order, and the block is left out when none applies:

| Element          | Source                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| `canonical`      | `rel="canonical"` ([RFC 6596](https://www.rfc-editor.org/rfc/rfc6596)), the page's preferred URL                   |
| `latest_version` | `rel="latest-version"` ([RFC 5829](https://www.rfc-editor.org/rfc/rfc5829))                                        |
| `prev`           | `rel="prev"`, or its synonym `rel="previous"`, from the HTML standard                                              |
| `next`           | `rel="next"`, from the HTML standard                                                                               |
| `up`             | `rel="up"` ([RFC 8288](https://www.rfc-editor.org/rfc/rfc8288)), the parent page                                   |
| `llms_txt`       | The `llms.txt` file that covers the page                                                                           |
| `agent_skills`   | A link, with any relation, to `/.well-known/agent-skills/index.json` or the older `/.well-known/skills/index.json` |

Every element has a `url`. A link element's `title`, when the page gives one, becomes a `title` attribute, shortened to 100 characters and XML-escaped. A link to the fetched page itself is ignored. `llms_txt` and `agent_skills` hold one line of text: that the file is an index and site map of the site for AI agents, and that skills are read as page content, never installed. The tool description names the block, so the other elements need no explanation.

```xml
<additional_content>
  <canonical url="https://docs.example.com/guide/install/"/>
  <prev url="https://example.com/guide/overview/" title="Overview"/>
  <next url="https://example.com/guide/configure/" title="Configuration"/>
  <llms_txt url="https://example.com/llms.txt">An index and site map of this site for AI agents.</llms_txt>
</additional_content>
```

`web_fetch` reports only what the page declares. It does not probe for any of these files, the `llms.txt` probes above aside. The [Agent Skills Discovery](https://github.com/cloudflare/agent-skills-discovery-rfc) draft defines no relation for advertising its index, so the index is recognized by its path. Stripe Docs, for example, sends it with `rel="service-meta"`.

## Rendering pages that need JavaScript

Some pages build their content with JavaScript, and a normal fetch returns an empty shell or loading placeholders. With `render: true`, `web_fetch` loads the page in a headless browser and reads the result.

A renderer is the code that drives one browser. `web_fetch` has no renderer of its own: extensions register them. Sandpiper bundles two, and each registers only when its browser is on `PATH`:

| Renderer id  | Browser                              | Reports                                                             |
| ------------ | ------------------------------------ | ------------------------------------------------------------------- |
| `lightpanda` | [Lightpanda](https://lightpanda.io/) | Final URL, status, headers, and bot challenges                      |
| `obscura`    | Obscura                              | Cloudflare challenges. The browser prints no URL, status or headers |

Rendering is slower than a normal fetch, and sites that challenge automated browsers can refuse it. A page that reads correctly without rendering should be fetched without it.

### What the tool offers

The tool's parameters follow the renderers that are registered when the first run of a session starts. Rendering is always one parameter, never two:

| Registered renderers | Parameter                                                                            |
| -------------------- | ------------------------------------------------------------------------------------ |
| None                 | None. Rendering is not offered                                                       |
| One                  | `render`, a boolean                                                                  |
| Two or more          | `renderer`: `none` or one of the renderer ids. The default is `none`, a normal fetch |

Nothing is chosen for the caller. With several renderers there is no default browser, and no setting or environment variable picks one: each fetch names the renderer it wants, which lets the caller try another browser when one is blocked. The id `none` is reserved, and a renderer cannot register under it.

### Adding a renderer

An extension registers a renderer by emitting it on the `sandpiper:web-fetch-renderer` event bus channel during `resources_discover`. The bundled renderers use the same channel. This example drives a browser command named `mybrowser`:

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("resources_discover", () => {
    pi.events.emit("sandpiper:web-fetch-renderer", {
      id: "mybrowser",
      async render(request, tools) {
        const { stdout, stderr, exitCode } = await tools.run("mybrowser", [
          "--print-html",
          request.url,
        ]);
        if (exitCode !== 0) throw new Error(stderr.trim());
        if (stdout.includes("Checking your browser")) {
          return { html: "", blocked: "bot challenge" };
        }
        return { html: stdout };
      },
    });
  });
}
```

Register only when the browser is installed. A registered renderer is offered to the model, and one that cannot run fails every call that uses it.

#### The registration

| Field         | Type     | Required | Description                                                       |
| ------------- | -------- | -------- | ----------------------------------------------------------------- |
| `id`          | string   | yes      | Name of the renderer. The first registration under an id keeps it |
| `render`      | function | yes      | `(request, tools) => Promise<result>`                             |
| `acknowledge` | function | no       | Called once when `web_fetch` accepts the registration             |

Registrations after the first run starts are ignored.

#### The request

| Field       | Type   | Description                                        |
| ----------- | ------ | -------------------------------------------------- |
| `url`       | string | The page URL, normalized. Always `http` or `https` |
| `timeoutMs` | number | Time the renderer has to answer. 30 seconds        |

#### The tools

`tools.run(executable, args)` runs a command and resolves with `{ stdout, stderr, exitCode }`.

- The command starts directly from the argument list. No shell reads the arguments, so a URL cannot run a command.
- A non-zero exit code is returned, not thrown, because browsers report failures in their output.
- The command is stopped at the request's time limit, or when the user cancels the fetch, and the call then rejects. Work a renderer does without `tools.run` is not stopped by a cancel.

#### The result

| Field         | Type   | Required | Description                                                                     |
| ------------- | ------ | -------- | ------------------------------------------------------------------------------- |
| `html`        | string | yes      | The page's HTML after its scripts ran                                           |
| `url`         | string | no       | Final URL after redirects. Defaults to the requested URL                        |
| `statusCode`  | number | no       | HTTP status of the page. Defaults to 200                                        |
| `contentType` | string | no       | Content-Type of the page. Defaults to `text/html`                               |
| `linkHeader`  | string | no       | The page's `Link` header, used to find its `llms.txt` and page links            |
| `blocked`     | string | no       | Set when the site refused the browser. Names the cause, such as a bot challenge |

A renderer reports a failure by throwing an error. `web_fetch` reports a thrown error, a `blocked` result, and a result with no HTML as a failed fetch that names the renderer.

## Architecture

The pipeline is framework-independent; only `src/index.ts` imports Pi.

- **`FetchAdapter`** is the interface for getting a page. `SimpleFetchAdapter` uses the Fetch API. `RendererFetchAdapter` calls the session's renderer.
- `src/render.ts` holds the renderer contract, the collector, and the command runner.
- `src/lightpanda-renderer.ts` and `src/obscura-renderer.ts` are the bundled renderers. `src/renderer-extensions.ts` wraps each one in an extension that registers it.
- `src/pipeline.ts` turns a fetched page into Markdown and applies filters.
- `src/llms-txt.ts` and `src/link-relations.ts` find a site's `llms.txt`, a page's Markdown version, and the page links in the additional content.

Renderers reach `web_fetch` the way prompt contributions reach the prompt builder ([explanation](../../docs/dev/prompt-contributions.md)). From `session_start`, `web_fetch` listens on the `sandpiper:web-fetch-renderer` event bus channel. Extensions emit their renderers during `resources_discover`. On the first `before_agent_start`, `web_fetch` stops listening and, when a renderer is registered, registers its tool again with the matching parameters. A registration carries the `render` function that `web_fetch` calls. The event bus carries only the registration, because it is synchronous, returns nothing, and drops messages that have no listener.

The tool is registered twice on purpose. Registering at load puts its prompt entry in place for the first run. Registering again on the first run changes only the parameter schema, before any request is sent. `devtools/integration/web-fetch-render.integration.test.ts` checks in a real session that the first request declares the final tool and that no later request carries a prompt or tool change.

Some design choices:

- Rendering is explicit, not an automatic fallback. A page of loading placeholders looks like valid content, and sites that a normal fetch can read can refuse automated browsers.
- Renderers run commands from an argument list, never through a shell, and receive only a normalized `http` or `https` URL. The Lightpanda Node package was rejected because it builds a shell command from the URL.
- HTML becomes Markdown rather than a syntax tree: a tree encoded for the model carries per-node overhead and is several times larger than the Markdown for the same page.
