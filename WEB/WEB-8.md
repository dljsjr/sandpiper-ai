---
title: "Wire ctx.signal into web_fetch for user-cancellable fetches"
status: COMPLETE
resolution: DONE
kind: TASK
priority: LOW
assignee: AGENT
reporter: AGENT
created_at: 2026-03-30T02:04:34.128Z
updated_at: 2026-11-12T19:52:18.880Z
---

# Wire ctx.signal into web_fetch for user-cancellable fetches

`web_fetch` ignored the agent turn's abort signal, so pressing Escape mid-fetch waited out the 30-second limit (page request, or a renderer's browser command).

## Done (change kotlnqvp)

- `FetchOptions.signal`; `SimpleFetchAdapter` composes it with its own 30 s timer via `AbortSignal.any`. Timeout behaviour unchanged.
- `RendererFetchAdapter` passes the signal to `tools.run`; `runCommand` gives it to `execFile` and rejects with the abort reason (Node and Bun both report `ABORT_ERR`, which previously would have read as "could not start").
- `fetchAndExtract` passes the signal to the page request and the Markdown alternate request, and re-throws after them, because the alternate request turns any failure, an abort included, into a fallback to the HTML page.
- `executeWebFetchTool` takes `signal` in its dependencies; `index.ts` forwards `execute`'s signal.
- llms.txt HEAD probes deliberately keep only their 3 s limit: results are cached for the process, and an aborted probe would be cached as unknown.
- README: cancel behaviour, and the `tools.run` contract (work a renderer does outside `tools.run` is not stopped).

## Verification

- Focused RED→GREEN tests in fetch, render, pipeline, tool-operation, index.
- End-to-end probe through the real registered tool against a hanging local server: returns 202 ms after abort with `Failed to fetch …: The operation was aborted.`
- `bun check` clean; full suite 71 files / 642 tests passed.

---

# Activity Log

## 2026-03-30T02:04:45.101Z

- **description**: added (11 lines)

## 2026-11-12T19:39:41.295Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-12T19:46:03.417Z

- **description**: 11 lines → updated (16 lines)

## 2026-11-12T19:46:03.553Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-12T19:52:18.881Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
