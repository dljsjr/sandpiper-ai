---
title: "Find llms.txt through page link relations and path-scoped probes"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-11-11T23:14:34.492Z
updated_at: 2026-11-12T16:29:12.729Z
---

# Find llms.txt through page link relations and path-scoped probes

## Finding resolved (2026-11-11)

Doug's decision, in his framing: only accept Markdown, rather than reject HTML. A 2xx answer counts only when its media type is text/markdown, text/x-markdown or text/plain; text/plain is included because every real llms.txt sampled is served that way. Anything else is reported missing with reason not-markdown. No extra request, no retry. Change in the commit "Accept only a Markdown answer as an llms.txt file"; media-type helpers now live in media-types.ts.

Survey before the change, 14 path-scoped locations on 13 documentation sites: 11 correct 404s, 2 real files (Cloudflare /workers/llms.txt, Svelte /docs/svelte/llms.txt), and platform.claude.com alone answering 200 text/html. After the change the Anthropic docs page reports platform.claude.com/docs/llms.txt, a real text/plain file.

Verification: failing tests first; bun check clean; full serial suite 66 files, 581 tests passed.

Design agreed with Doug (2026-11-11): keep 'any 2xx answer to HEAD counts as found'; do not read the file; do not retry failures or timeouts; run requests in parallel but still wait for the result.

## Implemented (2026-11-11)

Change tokwrplw / 36d18cfe.

- A page's describedby link relation (Link header or link element) whose path ends in /llms.txt is taken as found without a request. New module link-relations.ts parses RFC 8288 Link headers and HTML link elements.
- Otherwise HEAD-probe the llms.txt location of each directory above the page, all at once; the most specific 2xx wins. A deep page probes the root and the three directories nearest to it (agent choice: such files sit near the top of a tree).
- Discovery starts with the page request; a redirect to another URL triggers discovery for the final URL. One cached answer per location per process, failures included.

Live: fastht.ml/docs/llms.txt is now found (the root has none); vitest.dev is taken from its declared link.

## Open finding, awaiting Doug

Path probing exposes a false positive that root-only probing did not: platform.claude.com/docs/en/llms.txt answers HEAD with 200 text/html (a web page, not the file), and as the most specific answer it shadows the real files at /docs/llms.txt and /llms.txt. The HEAD response's Content-Type could reject text/html answers with no extra request. That departs from 'any 2xx counts', so it is not implemented.

---

# Activity Log

## 2026-11-11T23:22:40.630Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-11T23:22:41.391Z

- **description**: added (15 lines)

## 2026-11-12T00:59:49.652Z

- **description**: 15 lines → updated (23 lines)

## 2026-11-12T00:59:49.721Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-12T16:29:12.730Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
