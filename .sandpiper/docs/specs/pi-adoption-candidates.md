# Pi adoption candidates

- **Diátaxis mode**: Reference
- **Status**: Ideas, not authorized tasks. Each needs Doug's go-ahead before it becomes a task.
- **Checked against**: Pi 1.5.2 and the source tree on 2026-11-17
- **Related**: [Sandpiper system prompt architecture](sandpiper-system-prompt.md), [Pi system prompt sections](pi-prompt-sections.md)

Pi features that Sandpiper could adopt but has not. They come from the Pi 1.0 migration and the Pi 1.5 update audit, both archived. Each entry gives the idea, its current state in the code, and what would make it worth doing.

When a candidate becomes a task, or is rejected, remove it from this list. After a Pi update, check each state again.

## Render Sandpiper's blocks as Pi sections

**Idea**: return Sandpiper's prompt blocks, such as `<user_profile>`, `<harness_docs>`, and `<environment>`, as Pi sections instead of one preamble, so that a change to one block travels as a per-section update.

**State**: not adopted. `extensions/system/startup-hooks.ts` sets the whole rendered prompt as `customPrompt`, which Pi records as the `preamble` section. The Pi API this needs is unchanged in 1.5.2. Three things constrain it:

- Without a `customPrompt`, Pi renders its own default preamble and `docs` section, so the identity text would stay in the preamble.
- Extension sections follow Pi's `cwd` section, so the blocks would move after Pi's `tools` and `rules` and change the prompt's order.
- The [editable spans](sandpiper-system-prompt.md#editable-spans) of `sandpiper-system-prompt --json` assume one preamble at the start of the prompt.

**Trigger**: a block that has to change during a session. Today the prompt is meant to stay the same for a whole session, and the system extension warns when it changes, so per-section updates would carry nothing.

## Structured results from Sandpiper data tools

**Idea**: declare `outputSchema` and return `structuredContent` from Sandpiper tools that return data, such as `web_search`, `web_fetch`, `check_background_process`, and `list_peers`.

**State**: not adopted. No Sandpiper tool declares `outputSchema` or returns `structuredContent`. In Pi 1.5.2, a tool that declares `outputSchema` should always set `structuredContent`, and codemode scripts then receive it in place of the text content. AutoTOON already keeps a result's `structuredContent` when it rewrites the text (`extensions/autotoon/autotoon.ts`).

**Trigger**: a codemode script or another tool that needs to read a Sandpiper tool's result as data rather than parse its text.

## Tool annotations

**Idea**: add `annotations` (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) to Sandpiper tools.

**State**: not adopted. No Sandpiper tool sets `annotations`. In Pi 1.5.2 they are unverified hints from the tool's author, with the meaning of MCP tool annotations. Permission extensions can use them to decide which calls to confirm.

**Trigger**: a permission or confirmation extension in use that reads the annotations.

## `model-only` exposure for `done`

**Idea**: register `done` with `exposure: "model-only"`, so that the model can call it but codemode scripts cannot.

**State**: not adopted. `extensions/system/turn-control-tool.ts` registers `done` with the default `direct` exposure, so a codemode script can call it. A call from a script returns to the script, so its `terminate` does not end the turn. Pi 1.5.2 still offers `model-only`: declared to the model while active, never callable from other tools. The migration spec also named `tattler_receive`. That tool is now `deferred`, which excludes `model-only`, so it is no longer a candidate.

**Trigger**: codemode scripts calling `done` becomes a measured problem.

## Key hints from the render context

**Idea**: in the `skill` and `web_fetch` result renderers, use the `keyText()` and `keyHint()` that Pi passes on the tool render context, instead of importing `keyHint` from `@earendil-works/pi-coding-agent`.

**State**: not adopted. `formatExpandHint()` in `extensions/system/skill-loading-tool.ts` and `renderWebFetchResult()` in `extensions/web-fetch/src/tool-rendering.ts` import `keyHint`. Pi 1.5.2's `ToolRenderContext` extends `KeybindingHints`, and Pi's types tell extensions to use those functions: an import can resolve to another copy of Pi, which does not see the host's keybindings. The import works for Sandpiper's bundled extensions, which share Pi's module instance (an inference from the audit, not a test). `extensions/system/startup-header.ts` also imports the hint functions, but a header has no render context, so it is not part of this candidate.

**Trigger**: either extension loading with its own copy of Pi, for example as a separately installed Pi package, or the next change to either renderer.

## `pi-mcp` helpers in the web search adapter

**Idea**: use the helpers that Pi 1.5.1 moved into `@earendil-works/pi-mcp`, such as `limitMcpContent()` and `MCP_OUTPUT_MAX_BYTES`, in `extensions/web-search/src/parallel-adapter.ts`.

**State**: not adopted, and none fits the adapter today. It imports only `McpClient` and `StreamableHttpTransport` from `pi-mcp` 1.5.2.

- `limitMcpContent()` cuts long model-facing MCP text in the middle. The adapter never passes MCP text to the model: it parses Parallel's JSON text into at most 20 rows and formats its own result, so cutting the raw text would break the parse.
- `createMcpToolName()` and `validateMcpServerConfig()` serve registered MCP tools and configured servers. The adapter registers no MCP tools and reads no server configuration.
- The authentication support serves servers that need sign-in. Parallel's search server is anonymous.

**Trigger**: the adapter passing MCP content to the model, a second MCP-backed search provider, or a provider that needs sign-in.
