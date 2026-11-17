# Pi 1.0 system prompt sections

- **Diátaxis mode**: Reference
- **Status**: Current for Pi 1.0.3 and the v1.0.4 tag
- **Source**: `buildSystemPromptSections()` in Pi's `packages/coding-agent/src/core/system-prompt.ts`, `getSystemMessageText()` and `renderSystemMessageUpdate()` in `packages/ai/src/utils/text.ts`

Pi 1.0 builds the system prompt from named sections and stores them in the session transcript as system messages. A later system message patches sections by name; `null` removes one.

## Rendering

- `preamble` is rendered as plain text.
- Every other section is wrapped as `<name>\n...\n</name>`.
- Sections are joined with blank lines in the order below.
- On models that accept mid-conversation system messages, a later change is sent as `Updated system prompt section "<name>":` or `Removed system prompt section "<name>".` Other models receive the replayed prompt as one leading system message.

## Sections

| Section            | Present when                                                                       | Content                                                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preamble`         | Always                                                                             | `customPrompt` (`--system-prompt` or `SYSTEM.md`) if set, otherwise Pi's default introduction                                                                                   |
| `tools`            | No `customPrompt`                                                                  | One line per declared tool with a `promptSnippet`                                                                                                                               |
| `rules`            | No `customPrompt`                                                                  | A shell file-operations rule when no `grep`, `find`, or `ls` tool is selected, then per-tool `toolGuidelines` for declared tools, then `promptGuidelines`, then two fixed rules |
| `docs`             | No `customPrompt`                                                                  | Paths to Pi's README, `docs/`, and `examples/`                                                                                                                                  |
| `addendum`         | `appendSystemPrompt` is non-empty (`APPEND_SYSTEM.md` or `--append-system-prompt`) | The appended text                                                                                                                                                               |
| `project_context`  | Context files are loaded (`AGENTS.md`, `CLAUDE.md`)                                | Each file in a `<project_instructions path="...">` block                                                                                                                        |
| `skills`           | Skills are loaded and `read` or `bash` is selected                                 | Load instructions and an `<available_skills>` list                                                                                                                              |
| `cwd`              | Always                                                                             | The working directory                                                                                                                                                           |
| Extension sections | An extension sets `systemPromptOptions.sections[name]` in `before_agent_start`     | The extension's text                                                                                                                                                            |

Section names must match `^[a-z][a-z0-9_-]*$`, and `preamble` is reserved for Pi. An extension section with empty text is ignored. A non-empty extension section named after a built-in section, such as `cwd`, replaces that section's text in place.

## `mcp_servers`

The built-in MCP extension sets `mcp_servers` from `before_agent_start`. The section is present only when an enabled server has tools reachable through codemode or `tool_search`, and absent when every tool is declared directly.

| Part         | Content                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| Intro line   | Which reach methods the listed servers use                                                             |
| Server lines | `- <namespace> (<codemode or tool_search>): <summary>`, sorted by server name                          |
| Summary      | The configured `description`, or the server's instructions once connected, truncated to 250 characters |
| Limit        | 4,096 characters for the whole section; servers that do not fit are counted in a closing line          |

Example:

```text
<mcp_servers>
MCP servers whose tools are not declared to you. Call the tools of `codemode` servers from codemode scripts.
- mcp__linear (codemode): Linear issue tracker
</mcp_servers>
```

## Prompt option fields

`before_agent_start` handlers receive `NormalizedBuildSystemPromptOptions`, mutable in place:

| Field                                                 | Meaning                                                                                                                                                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `customPrompt`                                        | Replaces the default preamble and suppresses `tools`, `rules`, and `docs`. Sandpiper's local Pi patch keeps `tools` and `rules`; see [Local Pi patch](../../../docs/dev/build-system.md#local-pi-patch) |
| `forceSystemPrompt`                                   | Set when a handler returns `systemPrompt`; sent as the request's leading prompt for the current run only and not recorded in the transcript                                                             |
| `selectedTools`                                       | Active tool names                                                                                                                                                                                       |
| `hiddenTools`                                         | Active tools whose declarations `prepareLoadout` hides, for example codemode in `only` mode; left out of `tools` and `rules`                                                                            |
| `toolSnippets`                                        | One-line tool descriptions keyed by tool name                                                                                                                                                           |
| `toolGuidelines`                                      | Guideline bullets keyed by tool name (new in 1.0; 0.85 flattened them into `promptGuidelines`)                                                                                                          |
| `promptGuidelines`                                    | Extra rules not tied to a tool                                                                                                                                                                          |
| `appendSystemPrompt`, `contextFiles`, `skills`, `cwd` | Inputs to `addendum`, `project_context`, `skills`, and `cwd`                                                                                                                                            |
| `sections`                                            | Extension sections by name                                                                                                                                                                              |
