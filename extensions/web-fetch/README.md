# web-fetch

A Pi extension that adds a `web_fetch` tool. It fetches one web page and returns its content as Markdown.

## What it returns

- An HTML page is reduced to its main content and converted to Markdown.
- A Markdown or plain-text response is returned unchanged.
- When a site offers its own Markdown version of a page, that version is returned and its URL is shown as `Markdown source`.
- When the site publishes an `llms.txt` index that covers the page, the result ends with a block that points to it.

## Parameters

| Parameter     | Type    | Required | Description                                                                   |
| ------------- | ------- | -------- | ----------------------------------------------------------------------------- |
| `url`         | string  | yes      | The page to fetch                                                             |
| `followLinks` | boolean | no       | Also return the links found in the content                                    |
| `filter`      | object  | no       | Return one part of the page: a CSS selector or a Markdown section             |
| `render`      | boolean | no       | Load the page in a headless browser first. Present only when one is installed |

### Filters

| Filter             | Fields                        | Applies to                                                                   |
| ------------------ | ----------------------------- | ---------------------------------------------------------------------------- |
| `css_selector`     | `selector`                    | HTML pages. Returns every matching element                                   |
| `markdown_section` | `heading`, `level` (optional) | The Markdown text. Returns the section under a heading, with its subsections |

A heading matches when its text equals the requested text. When no heading is an exact match, headings that contain the text as a whole phrase match: `0.80.1` finds `## [0.80.1] - 2026-06-23` but not `## [0.80.10]`.

## Rendering pages that need JavaScript

Some pages build their content with JavaScript, and a normal fetch returns an empty shell or loading placeholders. With `render: true`, `web_fetch` loads the page in a headless browser and reads the result.

Rendering uses [Lightpanda](https://lightpanda.io/) when `lightpanda` is on `PATH`. The `render` parameter is not offered when no browser is found. The check runs once, when the session starts.

Rendering is slower than a normal fetch, and sites that challenge automated browsers can refuse it. A page that reads correctly without rendering should be fetched without it.

### Using another browser

Set `SANDPIPER_WEB_FETCH_RENDER_COMMAND` to the command that starts your browser:

```sh
export SANDPIPER_WEB_FETCH_RENDER_COMMAND='obscura fetch --dump html --quiet --wait-until networkidle {url}'
```

The command must print the rendered HTML on standard output and exit with status 0. A non-zero status is reported as a failed fetch, with the end of the command's error output.

| Rule        | Detail                                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| Placeholder | `{url}` is replaced by the page URL. Without a placeholder, the URL is added as the last argument               |
| Splitting   | The command is split on whitespace and started directly, without a shell. Quotes and variables are not expanded |
| Executable  | A name is looked up on `PATH`. A path is used as given. When it is not found, rendering is off                  |
| Time limit  | The browser is stopped after 30 seconds                                                                         |
| URL         | Only `http` and `https` URLs are passed to the browser                                                          |

For an argument that contains a space, put the command in a wrapper script and name the script.

The default command is:

```sh
lightpanda fetch --dump html --wait-until networkidle --wait-ms 8000 --terminate-ms 20000 --block-private-networks {url}
```

## Architecture

The pipeline is framework-independent; only `src/index.ts` imports Pi.

- **`FetchAdapter`** is the interface for getting a page. `SimpleFetchAdapter` uses the Fetch API. `RenderingFetchAdapter` runs the browser command.
- `src/pipeline.ts` turns a fetched page into Markdown and applies filters.
- `src/llms-txt.ts` and `src/link-relations.ts` find a site's `llms.txt` and a page's Markdown version.
