# Pi system prompt sections

- **Diátaxis mode**: Reference
- **Status**: Current for Pi 1.5.2. Notes mark where Sandpiper's local Pi patch changes the result.
- **Source**: in `@earendil-works/pi-coding-agent`, `buildSystemPromptSections()` in `dist/core/system-prompt.js`, `formatSkillsForPrompt()` in `dist/core/skills.js`, and `renderServersSection()` in `dist/extensions/mcp/index.js`; in `@earendil-works/pi-ai`, `getSystemMessageText()` and `renderSystemMessageUpdate()` in `dist/utils/text.js`. Pi describes the hook in the `before_agent_start` section of `$PI_CODING_AGENT_PACKAGE/docs/extensions.md`.
- **Related**: [Sandpiper system prompt architecture](sandpiper-system-prompt.md), [Local Pi patch](../../../docs/dev/build-system.md#local-pi-patch)

Pi builds the system prompt from named sections and stores them in the session transcript as system messages. A later system message patches sections by name; `null` removes one.

## Rendering

- `preamble` is rendered as plain text.
- Every other section is wrapped as `<name>\n...\n</name>`.
- Sections are joined with blank lines in the order below.
- Pi renders the sections when a run starts and again before each later model call in the run. It compares them with the sections the transcript already holds and appends one system message that holds only the changed sections.
- On models that accept mid-conversation system messages, a later change is sent in place as `Updated system prompt section "<name>":` followed by the text, or as `Removed system prompt section "<name>".` Other models receive the replayed prompt as one leading system message. Pi treats this framing as request-time only and may change it between versions.

## Sections

A tool is _declared_ when it is in `selectedTools` and not in `hiddenTools`.

| Section            | Present when                                                                                      | Content                                                                                                                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preamble`         | Always                                                                                            | `customPrompt` (`--system-prompt`, `SYSTEM.md`, or a value an extension sets) if set, otherwise Pi's default introduction                                                                                                                                                                   |
| `tools`            | No `customPrompt`. With Sandpiper's patch: always                                                 | `- <name>: <snippet>` for each declared tool with a `promptSnippet`, or `(none)`, then `Additional tools may be available.` With the patch and a `customPrompt`, a `<deferred_tools>` block can sit between the two; see [Deferred tools](sandpiper-system-prompt.md#deferred-tools)        |
| `rules`            | No `customPrompt`. With Sandpiper's patch: always                                                 | A file-operations rule when `bash` or `powershell` is declared and no `grep`, `find`, or `ls` tool is; then the `toolGuidelines` of declared tools, in tool order; then `promptGuidelines`; then two fixed rules. A rule that repeats an earlier one is dropped. Each rule is a `- ` bullet |
| `docs`             | No `customPrompt`                                                                                 | Paths to Pi's README, `docs/`, and `examples/`, and which document covers which topic                                                                                                                                                                                                       |
| `addendum`         | `appendSystemPrompt` is non-empty (`APPEND_SYSTEM.md` or `--append-system-prompt`)                | The appended text                                                                                                                                                                                                                                                                           |
| `project_context`  | Context files are loaded (`AGENTS.md`, `CLAUDE.md`)                                               | `Project-specific instructions and guidelines:`, then each file in a `<project_instructions path="...">` block                                                                                                                                                                              |
| `skills`           | At least one loaded skill does not set `disableModelInvocation`, and `read` or `bash` is selected | Load instructions and an `<available_skills>` list of name, description, and location. The instructions name the first of `read` and `bash` that is declared, or no tool when neither is declared                                                                                           |
| `cwd`              | Always                                                                                            | The working directory, with backslashes replaced by forward slashes                                                                                                                                                                                                                         |
| Extension sections | An extension sets `systemPromptOptions.sections[name]` in `before_agent_start`                    | The extension's text                                                                                                                                                                                                                                                                        |

Section names must match `^[a-z][a-z0-9_-]*$`, and `preamble` is reserved for Pi. Pi throws an error for a name that breaks either rule. An extension section with empty text is ignored. A non-empty extension section named after a built-in section, such as `cwd`, replaces that section's text in place. Other extension sections follow `cwd`, in the order they were added.

## `mcp_servers`

The built-in MCP extension sets `mcp_servers` in `before_agent_start`, and removes it when no server qualifies.

| Part         | Content                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Present when | An enabled server has tools configured with `codemode` or `deferred` exposure                                                                     |
| Intro line   | `MCP servers whose tools are not declared to you.`, followed by one sentence for each reach method that the listed servers use                    |
| Server lines | `- <namespace> (<codemode or tool_search>): <summary>`, sorted by server name. A server with any `codemode` tool is listed as `codemode`          |
| Summary      | The first line of the configured `description`, or of the server's instructions once connected. At most 250 characters, fewer when space is short |
| Limit        | 4,096 characters for the whole section. When the server lines alone do not fit, the last servers are left out and counted in a closing line       |

Example:

```text
<mcp_servers>
MCP servers whose tools are not declared to you. Call the tools of `codemode` servers from codemode scripts.
- mcp__linear (codemode): Linear issue tracker
</mcp_servers>
```

## Prompt option fields

`before_agent_start` handlers receive `NormalizedBuildSystemPromptOptions` as `event.systemPromptOptions`. It is mutable in place, and later handlers see earlier changes. `event.systemPrompt` and `ctx.getSystemPrompt()` render the options as they stand when the handler runs.

| Field                                                 | Meaning                                                                                                                                                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `customPrompt`                                        | Replaces the default preamble and suppresses `tools`, `rules`, and `docs`. Sandpiper's local Pi patch keeps `tools` and `rules`; see [Local Pi patch](../../../docs/dev/build-system.md#local-pi-patch)                         |
| `forceSystemPrompt`                                   | Set when a handler returns `systemPrompt`. For the current run only, every request carries the forced text as its one system prompt, with the current tool declarations. The transcript keeps recording the structured sections |
| `selectedTools`                                       | Active tool names. Default: `read`, `bash`, `edit`, `write`                                                                                                                                                                     |
| `hiddenTools`                                         | Active tools whose declarations `prepareLoadout` hides, for example the tools codemode wraps in its `only` mode. They are left out of `tools` and `rules`                                                                       |
| `deferredTools`                                       | Sandpiper's local Pi patch only. Deferred tools to list in the `tools` section while `tool_search` is declared; see [Deferred tools](sandpiper-system-prompt.md#deferred-tools)                                                 |
| `toolSnippets`                                        | One-line tool descriptions keyed by tool name                                                                                                                                                                                   |
| `toolGuidelines`                                      | Guideline bullets keyed by tool name                                                                                                                                                                                            |
| `promptGuidelines`                                    | Extra rules not tied to a tool                                                                                                                                                                                                  |
| `appendSystemPrompt`, `contextFiles`, `skills`, `cwd` | Inputs to `addendum`, `project_context`, `skills`, and `cwd`                                                                                                                                                                    |
| `sections`                                            | Extension sections by name                                                                                                                                                                                                      |
