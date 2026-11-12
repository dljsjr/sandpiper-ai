# web-fetch

A Pi extension that adds a `web_fetch` tool. It fetches one web page and returns its content as Markdown.

## What it returns

- An HTML page is reduced to its main content and converted to Markdown.
- A Markdown or plain-text response is returned unchanged.
- When a site offers its own Markdown version of a page, that version is returned and its URL is shown as `Markdown source`.
- When the site publishes an `llms.txt` index that covers the page, the result ends with a block that points to it.

## Parameters

| Parameter     | Type    | Required | Description                                                                          |
| ------------- | ------- | -------- | ------------------------------------------------------------------------------------ |
| `url`         | string  | yes      | The page to fetch                                                                    |
| `followLinks` | boolean | no       | Also return the links found in the content                                           |
| `filter`      | object  | no       | Return one part of the page: a CSS selector or a Markdown section                    |
| `render`      | boolean | no       | Load the page in a headless browser first. Present only when a renderer is available |

### Filters

| Filter             | Fields                        | Applies to                                                                   |
| ------------------ | ----------------------------- | ---------------------------------------------------------------------------- |
| `css_selector`     | `selector`                    | HTML pages. Returns every matching element                                   |
| `markdown_section` | `heading`, `level` (optional) | The Markdown text. Returns the section under a heading, with its subsections |

A heading matches when its text equals the requested text. When no heading is an exact match, headings that contain the text as a whole phrase match: `0.80.1` finds `## [0.80.1] - 2026-06-23` but not `## [0.80.10]`.

## Rendering pages that need JavaScript

Some pages build their content with JavaScript, and a normal fetch returns an empty shell or loading placeholders. With `render: true`, `web_fetch` loads the page in a headless browser and reads the result.

A renderer is the code that drives one browser. `web_fetch` has a built-in renderer for [Lightpanda](https://lightpanda.io/), which is available when `lightpanda` is on `PATH`. An extension can register a renderer for another browser. The `render` parameter is offered only when a renderer is available.

Rendering is slower than a normal fetch, and sites that challenge automated browsers can refuse it. A page that reads correctly without rendering should be fetched without it.

### Which renderer is used

One renderer serves a session. It is chosen when the first run starts:

1. The renderer whose id `SANDPIPER_WEB_FETCH_RENDERER` names. When no renderer has that id, rendering is off.
2. Otherwise the first renderer an extension registered.
3. Otherwise the built-in Lightpanda renderer, with the id `lightpanda`.

### Adding a renderer

An extension registers a renderer by emitting it on the `sandpiper:web-fetch-renderer` event bus channel during `resources_discover`. This example drives the Obscura browser:

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("resources_discover", () => {
    pi.events.emit("sandpiper:web-fetch-renderer", {
      id: "obscura",
      async render(request, tools) {
        const { stdout, stderr, exitCode } = await tools.run("obscura", [
          "fetch",
          "--dump",
          "html",
          "--quiet",
          "--wait-until",
          "networkidle",
          request.url,
        ]);
        if (exitCode !== 0) throw new Error(stderr.trim());
        if (stdout.includes("Performing security verification")) {
          return { html: "", blocked: "bot challenge" };
        }
        return { html: stdout };
      },
    });
  });
}
```

Register only when the browser is installed, because a registered renderer outranks the built-in one.

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
- The command is stopped at the request's time limit, and the call then rejects.

#### The result

| Field         | Type   | Required | Description                                                                     |
| ------------- | ------ | -------- | ------------------------------------------------------------------------------- |
| `html`        | string | yes      | The page's HTML after its scripts ran                                           |
| `url`         | string | no       | Final URL after redirects. Defaults to the requested URL                        |
| `statusCode`  | number | no       | HTTP status of the page. Defaults to 200                                        |
| `contentType` | string | no       | Content-Type of the page. Defaults to `text/html`                               |
| `linkHeader`  | string | no       | The page's `Link` header, used to find its `llms.txt`                           |
| `blocked`     | string | no       | Set when the site refused the browser. Names the cause, such as a bot challenge |

A renderer reports a failure by throwing an error. `web_fetch` reports a thrown error, a `blocked` result, and a result with no HTML as a failed fetch that names the renderer.

## Architecture

The pipeline is framework-independent; only `src/index.ts` imports Pi.

- **`FetchAdapter`** is the interface for getting a page. `SimpleFetchAdapter` uses the Fetch API. `RendererFetchAdapter` calls the session's renderer.
- `src/render.ts` holds the renderer contract, the collector that picks a renderer, and the command runner. `src/lightpanda-renderer.ts` is the built-in renderer.
- `src/pipeline.ts` turns a fetched page into Markdown and applies filters.
- `src/llms-txt.ts` and `src/link-relations.ts` find a site's `llms.txt` and a page's Markdown version.
