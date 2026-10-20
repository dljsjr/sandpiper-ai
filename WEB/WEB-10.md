---
title: "Add JS rendering adapter (lightpanda/Playwright) for SPA and JS-heavy pages"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-04-01T15:29:49.144Z
updated_at: 2026-11-12T19:03:24.620Z
---

# Add JS rendering adapter (lightpanda/Playwright) for SPA and JS-heavy pages

## One rendering parameter, explicit default (2026-11-12)

Doug's correction to the section below: implicitly coupled fields with a fallback lead models to make unintuitive tool calls; determinism is best. Commit "Offer rendering as one parameter with an explicit default". It supersedes the "render plus a list" schema and the sorted-id default described below.

- One renderer: render (boolean). Two or more: renderer only, an enum of "none" and the ids, default "none" (a normal fetch). No render field alongside it.
- Nothing is chosen for the caller. If a render switch reaches the tool while several renderers are loaded, the call fails and lists them. An unknown name fails and lists them.
- The id "none" is reserved; a registration under it is ignored.

Verification, isolated checkout: failing tests first; bun check clean; full serial suite 71 files, 635 tests passed, including the real-session test, which now asserts that with two renderers the tool has renderer (first value "none") and no render property. Needs bun run build to go live.

## Final shape: bundled renderer extensions, the call chooses (2026-11-12)

Change in the commit "Bundle renderers as extensions and let the call choose", on top of lykonvxu. This section supersedes the selection rules in the sections below. SANDPIPER_WEB_FETCH_RENDERER no longer exists, and web_fetch has no built-in renderer.

Doug's decisions: no built-in renderer; Lightpanda and Obscura are both bundled extensions that register on the channel only when their CLI is on PATH; the schema follows the registered renderers (none: nothing; one: render; several: render plus a list); the env var is scrapped. He rejected defaulting to whichever extension loaded first.

Agent choices: the list parameter is named renderer; with several renderers and no name, the first id in sorted order is the default and the parameter description names it; naming a renderer implies render; an unknown name fails with the loaded ids. No settings.json key was added: with the per-call choice there is no stated need.

- extensions/web-fetch/src/renderer-extensions.ts wraps each bundled renderer in an inline extension; packages/cli/sandpiper_resources.ts loads web-fetch-lightpanda and web-fetch-obscura.
- obscura-renderer.ts: Cloudflare challenge pages (marker _cf_chl_opt) are reported as blocked. Obscura prints no response details, so a 404 page comes back as content with status 200.
- The terminal line shows "(rendered with <id>)" when a call names a renderer.

Verification, isolated checkout: bun check clean; full serial suite 71 files, 629 tests passed. The integration test now registers two fixture renderers, calls one by name, and still finds one unchanged system message across three requests. Live through the new code with both browsers installed: order lightpanda, obscura; render without a name used lightpanda (0.8 s); renderer obscura rendered the same page (1.7 s); both report the npm page's Cloudflare challenge as blocked; an unknown name lists the loaded ids. Needs bun run build to go live.

## Redesigned: renderers register through an event bus channel (2026-11-12)

Change lykonvxu, on top of qnrztpnm. Doug replaced the command-template variable with code renderers, modeled on the prompt-contribution channel. This section supersedes the configuration described under "Implemented" below; SANDPIPER_WEB_FETCH_RENDER_COMMAND no longer exists.

Decisions (Doug): renderers are TypeScript and own output normalization; render stays a boolean; an environment variable picks the renderer by id. Agent proposal he accepted: no request/result messages on the bus, because pi.events is synchronous, returns nothing and drops unheard messages. The registration carries a render function that web_fetch calls directly.

- Channel sandpiper:web-fetch-renderer. Registration: id, render(request, tools), optional acknowledge. Request: normalized http(s) url, timeoutMs. tools.run(executable, args) starts a process without a shell and returns stdout, stderr and exitCode. Result: html, optional url, statusCode, contentType, linkHeader, blocked.
- Selection at the first before_agent_start: the id SANDPIPER_WEB_FETCH_RENDERER names (no match turns rendering off); else the first registered renderer; else the built-in one.
- Built-in Lightpanda renderer (lightpanda-renderer.ts) reads the --json report: real final URL, status and Link header; a bot challenge becomes blocked; a named error is thrown.
- Tool registration: at load, and again at the first before_agent_start with the final schema.

Measured, not assumed: a tool first registered inside before_agent_start is declared but missing from the first prompt's tools section (mutation of index.ts fails the integration test with exactly that). Registering at load and again on the first run gives one system message with the final web_fetch schema in request 1, and the same single system message in requests 2 and 3.

Test infrastructure change, additive and opt-in: the integration mock provider can append each request's context to a file (MOCK_RECORD_ENV_VAR). New devtools/integration/web-fetch-render.integration.test.ts and fixtures/renderer-fixture.ts.

Verification, isolated checkout: bun check clean; full serial suite 69 files, 622 tests passed. Live through the new code: Lightpanda renders the demo shop page (0.5 s); docs.anthropic.com reports its final URL platform.claude.com/docs/en/intro and finds the right llms.txt; a 404 page returns "HTTP error: 404"; a Cloudflare challenge on the npm page is reported as blocked (one run got through, so that site is intermittent). The README's Obscura example, run unchanged, renders the demo page and reports the npm challenge as blocked. No new dependency; live after the next build.

## Implemented (2026-11-12)

Change qnrztpnm. Doug approved a direct-binary adapter behind an explicit render parameter and asked that the browser be configurable, with obscura as a second example.

- extensions/web-fetch/src/render.ts: RenderingFetchAdapter runs a browser command with execFile and an argument list, reads rendered HTML from stdout, and returns it as text/html. 30-second limit, 20 MB output cap. Only a normalized http or https URL is passed, so a URL cannot be read as an option or by a shell.
- The browser is a command template, not a binary path, because browser CLIs differ: lightpanda and obscura share no wait or timeout flags. Contract: print rendered HTML on stdout, exit 0. Default is lightpanda with networkidle, an 8 s wait, a 20 s hard stop and private networks blocked. SANDPIPER_WEB_FETCH_RENDER_COMMAND overrides it; {url} is the placeholder, appended when absent; split on whitespace, no shell. An unresolved executable turns rendering off with no fallback.
- render is in the tool schema only when a browser is found at session start. With render, the pipeline asks for HTML and does not follow the site's Markdown version.
- The terminal line shows (rendered). New extensions/web-fetch/README.md documents the parameter and the command contract; the PRD has a Rendered fetch section.

Not used from lightpanda: --json. It would give the final URL, status and headers, but only for that one browser; the shared stdout contract keeps one code path. A rendered result therefore reports the requested URL and status 200.

Verification, isolated checkout: failing tests first, with shell-script stand-ins for the browser (URL with & and $(...) arrives as one argument and creates no file; option-like and file URLs are refused before the browser starts). bun check clean. Full serial suite 67 files, 602 tests passed. Live, new code: the demo shop page gives 2 loading placeholders without render and the full content with it, through lightpanda (0.8 s) and through obscura set by the variable (1.4 s). On the npm package page lightpanda fails cleanly with the Cloudflare challenge in the error; obscura exits 0 and returns the challenge page text. No new dependency; live after the next build.

## Evaluation of @lightpanda/browser (2026-11-12)

Doug proposed the Lightpanda Node package. Findings, all measured:

- The package (1.6.0, 2.3 KB wrapper, depends on yargs) builds a shell command string and runs it with execSync. With /bin/echo as the binary: the URL https://example.com/search?q=one&page=2 reached the binary as ...?q=one (the shell split it at &), and a URL containing $(touch marker) created the marker file. A URL comes from the model and may come from page content, so this is command execution from untrusted input, the WEB-22 class.
- It calls process.exit(1) when the binary is missing, blocks the event loop for the whole fetch, and exposes 5 options. One flag it passes, --enable-external-stylesheets, is not in lightpanda 1.0.2.
- The binary itself is suitable. Doug has 1.0.2 at /opt/homebrew/bin/lightpanda. fetch --dump html --json returns url, http_status, headers, error and bot_challenge, which map onto FetchResult. Useful flags: --wait-until networkidle, --wait-ms, --terminate-ms, --block-private-networks.
- Rendering works: demo-browser.lightpanda.io/campfire-commerce/ gives "Loading..." through plain fetch and through the default --wait-until load, and the rendered content in about 0.6 s with --wait-until networkidle.
- It is not a way past bot checks: www.npmjs.com/package/@lightpanda/browser reads correctly through plain web_fetch, while lightpanda gets a Cloudflare challenge (403, error BotChallenge).

Recommendation: a second FetchAdapter that runs the installed binary directly with an argument array (no shell, no npm package), as an explicit opt-in. Awaiting Doug's decision.

The web-fetch PRD explicitly deferred JS rendering to v2 when 'real failure cases' arise. The FetchAdapter interface was designed to accommodate this: a LightpandaAdapter or PlaywrightAdapter could slot in without changing the pipeline or tool API.

## Motivation

Most sites an agent reads are SSR (docs, GitHub, npm, MDN). But some pages — SPAs, dashboards — require JS execution to render useful content. When a user provides a URL that returns empty or unhelpful content via the SimpleFetchAdapter, there should be a path to retry with a JS-capable backend.

## What to implement

- Evaluate lightpanda (compiled native binary) vs. Playwright (npm package) as the backend
- Implement an adapter wrapping the chosen backend, conforming to the FetchAdapter interface
- Decide on activation: opt-in flag, automatic fallback on empty readability result, or user-configurable
- Update the tool registration to expose the rendering mode option if opt-in

## References

- `extensions/web-fetch/src/types.ts` — FetchAdapter interface
- `.sandpiper/docs/web-fetch-prd.md` — deferred capabilities table, lightpanda design decision reasoning

---

# Activity Log

## 2026-04-01T15:30:20.094Z

- **description**: added (17 lines)

## 2026-04-01T16:30:37.312Z

- **priority**: LOW → MEDIUM

## 2026-11-12T16:33:47.875Z

- **description**: 17 lines → updated (29 lines)

## 2026-11-12T16:37:56.597Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-12T16:43:23.291Z

- **description**: 29 lines → updated (42 lines)

## 2026-11-12T16:43:23.365Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-12T17:27:42.386Z

- **status**: NEEDS REVIEW → IN PROGRESS

## 2026-11-12T17:34:44.784Z

- **description**: 42 lines → updated (59 lines)

## 2026-11-12T17:34:44.850Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-12T18:15:28.578Z

- **status**: NEEDS REVIEW → IN PROGRESS

## 2026-11-12T18:23:58.418Z

- **description**: 59 lines → updated (73 lines)

## 2026-11-12T18:23:58.490Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-12T18:27:29.219Z

- **status**: NEEDS REVIEW → IN PROGRESS

## 2026-11-12T18:30:06.498Z

- **description**: 73 lines → updated (83 lines)

## 2026-11-12T18:30:06.564Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-12T19:03:24.621Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
