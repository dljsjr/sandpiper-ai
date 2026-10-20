---
title: "Tell the model what web_fetch found in llms.txt and refine the probe"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-11-10T23:17:21.285Z
updated_at: 2026-11-12T16:29:12.880Z
related:
  - TOOLS-92
---

# Tell the model what web_fetch found in llms.txt and refine the probe

## Implemented in three subtasks (2026-11-11)

WEB-24 (instructions block), WEB-25 (discovery by link and by path, in parallel) and WEB-26 (the site's own Markdown version). Decisions from Doug: any 2xx to HEAD counts; no reading of the file; no retries; parallel requests but no deferred results; instructions element inside additional_content. llms-full.txt was dropped: the current llmstxt.org text does not mention it.

Verification, isolated checkout: failing tests first throughout; bun check clean; full serial suite 66 files, 577 tests passed (30 new). Live probes of docs.anthropic.com, bun.com, fastht.ml and vitest.dev behaved as designed. Not live until the next install and build.

One open finding is recorded in WEB-25: a 200 text/html answer on platform.claude.com shadows the real llms.txt.

## Request

Doug likes the llms.txt probe in web_fetch and wants it improved, not removed (TOOLS-92 review, inventory row B-24, 2026-11-10). The model should get enough information to act on what the probe finds.

## How it works today

- The first web_fetch of each site sends one extra HEAD request for <origin>/llms.txt, with a 3-second limit. The result is cached for the process, including failures (extensions/web-fetch/src/llms-txt.ts).
- The pipeline waits for that probe before it returns, on every call (extensions/web-fetch/src/pipeline.ts:113).
- When the file exists, the tool result gains an <llms_txt status="found" url="..."/> block (tool-operation.ts). When it does not, the model sees nothing.
- The tool description and parameter text never mention llms.txt (src/index.ts), so nothing tells the model what the tag means or what to do with it.
- The collapsed terminal line hides it. The details.llmsTxt field has no reader outside tests.
- Two assertions in src/index.test.ts check that no system notification is sent, for code that does not exist.

## Ideas to weigh

1. Say what the tag means, in the tool description or in the block itself: the site publishes an index for language models at this address, and fetching it gives a map of the documentation.
2. Return short instructions with the block instead of a bare tag.
3. Run the probe alongside the page request, so a slow or missing llms.txt does not delay the page by up to 3 seconds.
4. Decide whether to also look for llms-full.txt, and whether to offer the index content directly when the requested page is the site root.

Do not remove the probe.

---

# Activity Log

## 2026-11-11T23:14:34.348Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-11T23:22:42.133Z

- **description**: 21 lines → updated (29 lines)

## 2026-11-12T00:59:49.793Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-12T16:29:12.880Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
