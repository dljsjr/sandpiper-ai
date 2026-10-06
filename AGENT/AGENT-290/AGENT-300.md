---
title: "Decide and apply Sandpiper defaults for inherited Pi 1.0 behavior"
status: NEEDS REVIEW
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-10-06T02:57:59.705Z
updated_at: 2026-10-06T19:21:18.066Z
depends_on:
  - AGENT-293
---

# Decide and apply Sandpiper defaults for inherited Pi 1.0 behavior

Pi 1.0 behavior Sandpiper inherits under its own name: fullscreen TUI by default (tuiMode), /bug uploading reports to the Pi developers, the startup header (Pi logo with Sandpiper's version, plus first-run text), built-in codemode/tool-search/mcp/llama.cpp extensions loaded by default, and install telemetry on by default.

Decisions (Doug, 2026-10-06). Rule: do what needs no Pi patch; skip anything that needs one.

| Behavior | Decision | How |
| --- | --- | --- |
| Fullscreen TUI | Keep as the default | No change. Chorus already handles fullscreen (extensions/chorus/chorus-ui.ts). Check it live in AGENT-290's end-to-end check. |
| /bug | Skipped | Pi's interactive mode handles /bug before extension commands and input handlers, so disabling it needs a Pi patch. |
| Startup header | Rebrand | Call ctx.ui.setHeader() from the Sandpiper extension: `sandpiper vX` plus compact key hints built with the exported keyHint/rawKeyHint/keyText helpers. Pi 0.85 already showed APP_NAME, so only 1.0 needs this. The first-run text ("the minimal coding agent") needs a Pi patch: skipped. |
| Built-in extensions | Keep enabled. Doug wants to use MCP servers and codemode. Navigator and ask_questions compatibility with codemode is punted until an issue is measured. llama.cpp: no concern. | Interactions below. AGENT-298 must land before MCP or codemode is used on Pi 1.0. Adding an MCP server with default exposure turns codemode on automatically. |
| Install telemetry | Off by default | Done on the 0.85 line in change xxkolvow: the standalone runtime sets PI_TELEMETRY=0 when unset. PI_TELEMETRY=1 or SANDPIPER_TELEMETRY=1 opts back in. |

Built-in extension interactions (checked against Pi v1.0.4 source and docs, 2026-10-06):

- codemode, inactive unless enabled with defaultTools "+codemode" or an MCP server with codemode exposure:
  - AutoTOON would rewrite JSON results of nested calls. AGENT-298 fixes it.
  - Nested calls ignore a tool's `terminate`, so `done` or `tattler_receive` called from a script does not end the turn.
  - `codemode.mode: "only"` hides every other tool, including turn-control tools and ask_questions, behind scripts. Leave the mode at its default, `on`.
  - hiddenTools rendering is AGENT-296. The compiled standalone app cannot run codemode (AGENT-299).
- tool_search, inactive unless enabled: loads deferred tools mid-run. The declarations update at once; Sandpiper's tool text follows the AGENT-295/AGENT-296 design.
- MCP, active but inert: reads ~/.sandpiper/agent/mcp.json and, in trusted projects, .sandpiper/mcp.json. Neither exists today. Sandpiper's web-search Parallel adapter uses mcporter, which is separate. Under customPrompt ownership, Pi renders the mcp_servers section after Sandpiper's prompt (AGENT-295).
- llama.cpp: registers a provider and /llama, with no startup handlers. Inert until /login llama.cpp.
- No name conflicts: no Sandpiper command or tool is named codemode, tool_search, mcp, or llama.

Remaining work, after AGENT-293: the startup header.

Steps:
1. In the Sandpiper system extension's session_start, call ctx.ui.setHeader() with a component showing `sandpiper vX` plus compact key hints, built with the exported keyHint, rawKeyHint, and keyText helpers.
2. Check what the custom header loses compared with Pi's built-in one, in particular the expandable startup help and the loaded-resources list. Keep the compact hints at least; tell Doug if anything useful disappears.
3. Check it live in fullscreen and regular TUI modes. setHeader is a no-op in RPC mode.
4. One jj change with `Refs: AGENT-300`.

---

# Activity Log

## 2026-10-06T16:19:08.717Z

- **description**: 1 line → updated (25 lines)

## 2026-10-06T17:41:48.408Z

- **description**: updated

## 2026-10-06T18:23:49.918Z

- **description**: 25 lines → updated (31 lines)

## 2026-10-06T19:18:40.147Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-06T19:21:18.070Z

- **status**: IN PROGRESS → NEEDS REVIEW
