---
title: "Defer bundled extension tools and list deferred tools inside <tools>"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-11-17T17:07:11.974Z
updated_at: 2026-11-18T18:34:57.319Z
---

# Defer bundled extension tools and list deferred tools inside <tools>

Defer most tools that Sandpiper's bundled extensions register, and tell the model they exist.

## Why

Pi's `tool_search` can load any tool with `exposure: 'deferred'`, but nothing advertises deferred extension tools: `tool_search`'s description lists no tools, and `<mcp_servers>` covers MCP servers only. Claude Code lists deferred tool names in a message; Codex lists sources in `tool_search`'s description. Tool changes already reach the model as appended system messages (tool declaration deltas plus changed-section patches), so no prompt rewrite is involved.

## Plan

1. Pi patch (`dist/core/system-prompt.js` and `.d.ts`): a `deferredTools: string[]` option carried through `normalizeBuildSystemPromptOptions`; the patched custom-preamble branch renders a `<deferred_tools>` block inside `<tools>` listing deferred tools not yet active (name plus the tool's snippet), only when `tool_search` is declared.
2. `extensions/system`: set `deferredTools` in `before_agent_start` (before the user-custom-prompt early return) from `pi.getAllTools()`, exposure `deferred` and no namespace (MCP stays under `<mcp_servers>`); activate `tool_search` when any such tool is registered, mirroring Pi's MCP `ensureDiscoveryActive`.
3. Mark deferred: `list_peers`, `send_peer_message`, `tattler_receive`, `send_chorus_reply`, `start_background_process`, `check_background_process`, `web_fetch`, `web_search`. Keep loaded: `skill`, `done`, `ask_questions`.
4. Tests: unit tests on the patched renderer; an end-to-end test with `prompt-recording-harness` (scripted `tool_search` call with arguments) showing a loaded tool moving from the deferred block to the main list; a resumed-session check that `web_fetch` re-registration does not unload it.

## Out of scope

The skills-instruction bug (naming `skill`/`read` without checking reachability) and the section-based prompt restructure.
## Notes

- 2026-11-18: The namespace check let Pi's MCP resource tools (`list_mcp_resources`, `list_mcp_resource_templates`, `read_mcp_resource`) into `<deferred_tools>` by name alone: they have no namespace and take their server's exposure. The filter now uses Pi's `isMcpToolName`, which the local Pi patch exports from `dist/index.js`, so Sandpiper counts the same tools as MCP that Pi does. Namespaced tools from other extensions are listed. Pi could export `isMcpToolName` upstream; the patch line would then go.
- 2026-11-18, live check after restart: in a fresh session, `<deferred_tools>` inside `<tools>` lists exactly `list_peers`, `send_chorus_reply`, `send_peer_message`, `tattler_receive`, `web_fetch`, `web_search`, with no MCP resource tools, and `mcp__cua_driver` stays under `<mcp_servers>`. If so, close with resolution DONE once Doug agrees.

---

# Activity Log

## 2026-11-17T17:07:53.328Z

- **description**: added (16 lines)

## 2026-11-17T17:07:53.526Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-17T17:28:35.648Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-18T15:55:20.190Z

- **status**: NEEDS REVIEW → IN PROGRESS

## 2026-11-18T16:00:13.543Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-18T16:46:29.499Z

- **status**: NEEDS REVIEW → IN PROGRESS

## 2026-11-18T16:48:34.423Z

- **description**: 16 lines → updated (19 lines)

## 2026-11-18T16:54:01.452Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-18T17:00:31.868Z

- **description**: updated

## 2026-11-18T17:00:38.595Z

- **description**: 19 lines → updated (20 lines)

## 2026-11-18T18:34:57.319Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
