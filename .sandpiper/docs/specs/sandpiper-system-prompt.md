# Sandpiper system prompt architecture

- **Diátaxis mode**: Reference spec
- **Status**: Implemented
- **Implementation**: `packages/core/system-prompt/` (templates), `packages/core/src/system-prompt.ts`, `packages/core/src/skill-tool-reachability.ts`, `packages/core/src/prompt-template.ts`, `packages/core/src/startup-prompt.ts`, `packages/core/src/user-profile.ts`, `packages/core/src/version-control.ts`, `extensions/system/startup-hooks.ts`, `extensions/system/deferred-tools.ts`, `extensions/system/skill-loading-tool.ts`, `packages/cli/system_prompt_diagnostic.ts`, `patches/@earendil-works%2Fpi-coding-agent@1.5.2.patch`
- **Related**: [Pi system prompt sections](pi-prompt-sections.md), [Pi adoption candidates](pi-adoption-candidates.md), [Local Pi patch](../../../docs/dev/build-system.md#local-pi-patch), [AGENT-290 Pi 1.0 migration spec](../../archive/agent-290-pi-1-0-migration-spec.md) (archived: the original ownership decision and the alternatives considered)
- **Supersedes**: archived April 2026 parsing-plan notes

## Current architecture

Sandpiper owns Pi's base prompt through Pi's custom base prompt. In the system extension's `before_agent_start` hook, it:

1. renders the Sandpiper prompt from Pi's `event.systemPromptOptions` with `buildSandpiperStartupPrompt()` in `packages/core/src/startup-prompt.ts`
2. sets `systemPromptOptions.customPrompt` to the rendered prompt, so Pi records it in the transcript as the `preamble` section
3. clears `appendSystemPrompt` and `contextFiles`, which Sandpiper renders itself, and clears `skills` when Sandpiper renders them (see [Skill loading behavior](#skill-loading-behavior))
4. returns no `systemPrompt`: Pi applies a returned prompt to one run only and does not record it

Pi renders its own sections after Sandpiper's text: `tools` and `rules` (the tool list and every active tool's guidelines), `skills` when Sandpiper leaves the skills to Pi, `cwd`, and extension sections such as `mcp_servers`. Pi re-renders them before every model call and sends only changed sections.

Sandpiper carries a local `bun patch` of `@earendil-works/pi-coding-agent` so that a `customPrompt` keeps Pi's `tools` and `rules` sections; stock Pi drops them along with its default preamble. Pi's `docs` section still goes with the default preamble; Sandpiper's `<harness_docs>` covers it. The patch also adds the `deferredTools` prompt option, which lists the [deferred tools](#deferred-tools) that are not loaded yet inside the `tools` section. [Local Pi patch](../../../docs/dev/build-system.md#local-pi-patch) lists every module the patch changes and how to redo it after a Pi upgrade.

Runs started by extensions, such as an idle `triggerTurn`, emit `before_agent_start` like prompted runs (Pi 1.2.0+), so they carry the Sandpiper prompt too, including a fresh session's first run.

```text
extensions/system/startup-hooks.ts
  -> buildSandpiperStartupPrompt()
    -> collect startup context
    -> buildSandpiperSystemPrompt()
      -> render packages/core/system-prompt/*.md
```

## Deferred tools

Most tools that Sandpiper's bundled extensions register have `exposure: "deferred"`. Pi does not declare them to the model, and leaves their snippets and guidelines out of the `tools` and `rules` sections, until Pi's `tool_search` tool loads them.

| Tool                                                   | Exposure   | Registered by                                   |
| ------------------------------------------------------ | ---------- | ----------------------------------------------- |
| `list_peers`, `send_peer_message`, `tattler_receive`   | `deferred` | `extensions/tattler/`                           |
| `send_chorus_reply`                                    | `deferred` | `extensions/chorus.ts`                          |
| `web_fetch`                                            | `deferred` | `extensions/web-fetch/`                         |
| `web_search`                                           | `deferred` | `extensions/web-search/`                        |
| `skill`, `done`                                        | `direct`   | `extensions/system/`                            |
| `start_background_process`, `check_background_process` | `direct`   | `extensions/system/background-process-tools.ts` |

The background process tools stay loaded because Pi lists a tool's guidelines in `rules` only while the tool is declared, and their guideline ("Prefer `start_background_process` over nohup, `&`, or manually backgrounding jobs with bash") steers ordinary coding work.

`extensions/system/deferred-tools.ts`, registered by the system extension, does two things:

- In `before_agent_start`, it sets `systemPromptOptions.deferredTools` to the names of the registered tools with `deferred` exposure, sorted by name, except the tools Pi counts as MCP tools. `<mcp_servers>` describes MCP servers instead. The check is Pi's `isMcpToolName`, which the local patch exports. A namespace check would miss Pi's MCP resource tools (`list_mcp_resources`, `list_mcp_resource_templates`, `read_mcp_resource`), which have no namespace, and would also leave out namespaced tools from other extensions. This is a separate handler from the prompt hook, so it also runs under a user's custom prompt.
- In `session_start` and `before_agent_start`, it activates `tool_search` when a deferred tool is registered, as Pi's MCP extension does for MCP tools. Only a `tool_search` that declares `reachesTools` counts. When no such tool is registered and a deferred tool is not active, it warns once per session with `ctx.ui.notify`.

The patched `tools` section lists each deferred tool that is not active in a `<deferred_tools>` block, between the tool list and the closing line. A tool without a snippet is listed by its name alone. The block is present only when `tool_search` is declared and at least one deferred tool is not active:

```text
<tools>
- read: Read file contents
- tool_search: Search for tools that are not loaded yet and load the matches

<deferred_tools>
  <instructions>These tools are not loaded yet. Load one with `tool_search`, searching for its name. It can be called from your next call.</instructions>
  - web_fetch: Fetch a web page and return clean markdown content
</deferred_tools>

Additional tools may be available.
</tools>
```

Pi renders the sections again before every model call, against the tools active at that moment. When `tool_search` loads a tool, the next request declares it, adds its snippet to the tool list and its guidelines to `rules`, and drops it from the block. Pi records the loaded tool in the transcript, so it stays active after a resume.

## Prompt sections

`buildSandpiperSystemPrompt()` emits XML-style sections in order:

1. Persona (`<identity>`, `<interaction_style>`, and `<role>`, or the `--identity` override) — Sandpiper identity, operating principles, communication rules, and coding defaults.
2. `<user_profile>` — user-wide `USER.md` profile and working preferences, if present.
3. `<harness_docs>` — Pi/Sandpiper documentation routing and path differences when package roots are available.
4. `<skills>` — skill-loading rules plus available skills from Pi's `systemPromptOptions`, as `<available_skills>` entries. Rendered only when the model can reach the `skill` tool.
5. `<injected_context>` — injected `AGENTS.md` / `CLAUDE.md` context files from Pi's `systemPromptOptions`.
6. `<user_appended_prompt>` — user-appended system prompt content, if present.
7. `<system_notification_protocol>` — how to treat hidden system notifications.
8. `<environment>` — session start date, platform, and session-start VCS detection. Pi's `cwd` section carries the working directory.

## Templates

All prose Sandpiper writes into its prompt lives in Markdown templates in `packages/core/system-prompt/`, one file per section, named after its XML tag. TypeScript supplies only computed values.

| Template                                | Renders                                                      | Placeholders                                                                 |
| --------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `system_prompt.md`                      | The `<system_prompt>` frame and the whitespace between parts | `identity`, `sections`, `system_notification_protocol`, `environment`        |
| `identity.md`                           | `<identity>`                                                 | none                                                                         |
| `interaction_style.md`                  | `<interaction_style>`                                        | none                                                                         |
| `role.md`                               | `<role>`                                                     | none                                                                         |
| `user_profile.md`                       | `<user_profile>`                                             | `content`: `USER.md` text                                                    |
| `harness_docs.md`                       | `<harness_docs>`                                             | `piRoot`, `sandpiperRoot`, `piPackage`, `sandpiperPackage`, `piVersion`      |
| `skills.md`                             | `<skills>`                                                   | `loadInstruction`, `availableSkills`: the computed `<available_skills>` list |
| `skill_load_instruction_skill_tool.md`  | The `loadInstruction` when the `skill` tool is declared      | none                                                                         |
| `skill_load_instruction_tool_search.md` | The `loadInstruction` when the `skill` tool is deferred      | none                                                                         |
| `injected_context.md`                   | `<injected_context>`                                         | `contextFiles`: the computed `<context_file>` elements                       |
| `user_appended_prompt.md`               | `<user_appended_prompt>`                                     | `content`: the appended prompt text                                          |
| `system_notification_protocol.md`       | `<system_notification_protocol>`                             | none                                                                         |

`piRoot` and `sandpiperRoot` fall back to the environment variable names `PI_CODING_AGENT_PACKAGE` and `SANDPIPER_CODING_AGENT_PACKAGE`. `piPackage` and `sandpiperPackage` render an unset root as `undefined`, as the prompt always has. `piVersion` falls back to `<unknown>`. `<environment>` has no prose; TypeScript renders it whole.

### Template syntax

- A template's text is the file's contents without its final newline, so editors that add one change nothing. Every other byte, including trailing spaces, renders exactly.
- `{{name}}` is a placeholder, where `name` is a letter followed by letters, digits, or underscores. All other text is literal, including braces that do not form a placeholder.
- There are no conditionals, loops, or escapes. A placeholder that its section does not supply fails the render with the template path and the placeholder name.
- `.prettierignore` excludes the directory: formatting would change the rendered prompt.

### Manifest

`packages/core/src/system-prompt.ts` owns the structure:

- `SECTIONS` is the ordered list of optional sections, each `{ template, condition, data }`. `system_prompt.md` places the included sections between the identity and the notification protocol, with a newline before and after each one. To add, remove, or reorder a section, change its `SECTIONS` line and its template.
- The default identity is `identity.md`, `interaction_style.md`, and `role.md`, joined with newlines. An `--identity` override replaces all three.
- The skills load instruction is a separate template so `skills.md` stays free of conditionals.

### Loading

`loadSystemPromptTemplates()` reads every template from `packages/core/system-prompt/`, found by walking up from the module's own location. The source checkout and the packed package have the same layout, and the root file list packs the directory directly. Even the built bundle in a checkout reads the checkout's templates, so editing a template needs no rebuild.

The system extension loads the templates once per session, like `USER.md` and the `--identity` file, and reloads them at the next `session_start`. A template edit takes effect in the next session and never changes a running session's prompt.

## Editable spans

Rendering returns the text and a source map: `{ text, spans }`. Each span records a run of rendered text that is copied verbatim from a file:

```ts
interface EditableSpan {
  start: number; // offsets into the rendered text
  end: number;
  path: string; // absolute path of the source file
  sourceStart: number; // offsets into that file's text
  sourceEnd: number;
}
```

Offsets are UTF-16 code units (JavaScript string indices). `text.slice(start, end)` equals the file's text from `sourceStart` to `sourceEnd`. Sourced text is never escaped: the prompt's XML-like tags are a convention for the model, and nothing parses them.

Spans cover:

- every literal chunk of every template
- `USER.md` content, mapped to the agent directory's `USER.md`
- each context file's content, mapped to the path Pi reports
- `--identity` content, when the flag names a file
- appended system prompt content read from a file, when the parts the diagnostic supplies reproduce Pi's joined text exactly

Computed values — package roots, Pi version, session date, platform, VCS attributes, skill entries, context file tags and paths, and appended text given directly — have no span. Files that Pi changes as it reads them, such as files with a byte-order mark, get no span either.

### Diagnostic output

`sandpiper-system-prompt --json` prints a top-level `editableSpans` array of these span objects. Its offsets index the JSON `prompt` field, the full request-time prompt:

1. The system extension passes the preamble it sets as `customPrompt`, with spans shifted past any prepended prompt contributions, to the diagnostic's `onPreamble` hook on each run.
2. The diagnostic gives the extension the appended prompt sources from Pi's resource loader through `appendSystemPromptParts`, since extensions see only the joined text.
3. Pi renders the preamble first, so the diagnostic keeps the spans only when the captured prompt starts with the preamble.
4. It then keeps each span only if the prompt text still equals the current file text at the span's source offsets, and reports the file's real path.

With a custom system prompt, Sandpiper renders nothing and `editableSpans` is empty.

### Characterization

`packages/core/src/system-prompt.characterization.test.ts` pins complete rendered prompts for representative inputs as file snapshots in `packages/core/src/__snapshots__/system-prompt/`. After an intended prompt change, review the snapshot diff and update the snapshots with `bun run test:vitest -- -u`.

## Skill loading behavior

Sandpiper renders its `<skills>` section only when the model can reach the `skill` tool. `skillToolReachability()` in `packages/core/src/skill-tool-reachability.ts` decides this from Pi's `selectedTools` and `hiddenTools` and the `skill` tool's exposure, which the system extension reads from `pi.getAllTools()`. The first matching row applies:

| The `skill` tool is                            | Who renders `<skills>` | Load instruction                                  |
| ---------------------------------------------- | ---------------------- | ------------------------------------------------- |
| `deferred`, and `tool_search` is declared      | Sandpiper              | `skill_load_instruction_tool_search.md`           |
| declared: selected and not hidden              | Sandpiper              | `skill_load_instruction_skill_tool.md`            |
| not reachable: absent, not selected, or hidden | Pi                     | Pi's wording, naming `read` or `bash`, or neither |

A tool is declared when it is in `selectedTools` and not in `hiddenTools`; codemode's `only` mode hides the tools it wraps, so a hidden `skill` tool is not reachable. A deferred `skill` tool keeps the `tool_search` instruction after `tool_search` loads it, so loading it does not change the prompt mid-session.

When Sandpiper renders the section, it clears `systemPromptOptions.skills` so Pi does not render the skills again. The section treats `<available_skills>` as routing metadata: it tells agents to load matching skills by exact catalogue name, and to resolve relative scripts and references against the skill root the tool returns.

Otherwise Sandpiper leaves `systemPromptOptions.skills` intact and Pi renders its own `<skills>` section, in Pi's format, before its `cwd` section. Pi names the first of `read` and `bash` that is declared, names no tool when they are selected but hidden, and leaves the section out when neither is selected. That text comes from Pi, so it has no [editable span](#editable-spans).

## Startup context

`buildSandpiperStartupPrompt()` supplies stable launch metadata before calling the base prompt builder:

- Pi package path and version from `PI_CODING_AGENT_PACKAGE` / `PI_CODING_AGENT_VERSION`
- Sandpiper package path from `SANDPIPER_CODING_AGENT_PACKAGE`
- user profile content from `USER.md` in the agent directory resolved by Pi's `getAgentDir()`, when present
- session-start VCS detection (`jj`, `git`, or `none`)

Volatile one-shot startup context is not rendered into the system prompt. Moving volatile task, Journal, and working-copy state out of the system prompt preserves provider cache stability and keeps system guidance from changing mid-session.

## Custom prompts

If the user sets a custom prompt (`--system-prompt` or `SYSTEM.md`), Pi reports it as `systemPromptOptions.customPrompt` and Sandpiper does not replace it. `buildSandpiperStartupPrompt()` returns `undefined`, and the system extension leaves Pi's prompt handling intact. Because of the local patch, Pi still renders its `tools` and `rules` sections after a user's custom prompt, including the `<deferred_tools>` block.

## Provider requests

### Request invariants

`extensions/system/prompt-ownership.test.ts` runs the system extension's prompt hooks in a Pi session against a recording provider and asserts these invariants. "The Sandpiper prompt" means a replayed system prompt that starts with `<system_prompt>`.

| Invariant                                                                                                                  | Applies to                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every request carries the Sandpiper prompt                                                                                 | User-prompted runs. Every turn of a run started by an extension, including a fresh session's first run. Resumed sessions, whichever kind of run comes first |
| `session.state.systemPrompt`, which `/export` renders, carries the Sandpiper prompt                                        | After user-prompted runs and after runs started by extensions                                                                                               |
| A run started by an extension adds no system message when the prompt and tools are unchanged                               | Every request of such a run                                                                                                                                 |
| Each request extends the previous request byte-for-byte                                                                    | Consecutive requests without a prompt or tool change, across user-prompted runs and runs started by extensions                                              |
| Extension sections reach the provider                                                                                      | Every request, including the turns of runs started by extensions. The test sets `mcp_servers`.                                                              |
| Tool snippets and guidelines are in Pi's `tools` and `rules` sections; Sandpiper's preamble has no tool list or guidelines | Prompt rendering                                                                                                                                            |
| Tools whose declarations a `prepareLoadout` hook hides appear in neither section                                           | Prompt rendering                                                                                                                                            |
| After an active-tool change, the next request's `tools` section and tool declarations match the active tools               | Changes between user prompts, within a run, and during a run started by an extension                                                                        |

### Request shape

Custom providers, such as `pi-claude-code-cli-provider`, receive a `TranscriptContext` that holds only `messages`. The prompt and the tools travel in system messages:

| Part                           | Shape                                                                                                                                                                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Leading system message         | `content: ""`. `sections` holds `preamble` (the Sandpiper prompt) and Pi's sections: `tools`, `rules`, `skills` when Pi renders the skills, `cwd`, and any extension sections. `toolsAdded` holds the initial tool declarations.        |
| Later system messages          | Section patches, in which `null` removes a section, and `toolsAdded` and `toolsRemoved` deltas, in transcript order                                                                                                                     |
| Reading the prompt and tools   | `getCurrentSystemPrompt(messages)` and `getCurrentTools(messages)` from `@earendil-works/pi-ai` replay every system message. `resolveTranscript()` and `collapseSystemMessages()` handle APIs without mid-conversation system messages. |
| Sessions written before Pi 1.0 | They have no system messages. Pi writes the first one when the next run starts, after the old history, so it does not lead the transcript. A provider that reads the prompt only from a leading system message must handle this case.   |

## Diagnostics

- `sandpiper-system-prompt` (`packages/cli/system_prompt_diagnostic.ts`) runs one turn against an in-process capture provider and prints the first request's system prompt: the prompt Pi sends, including Pi's sections, with no credentials, network, or provider request. `--json` adds source metadata and [editable spans](#editable-spans). It loads Pi's `tool_search` as a built-in extension, as Pi's CLI does, so the output shows the `<deferred_tools>` block. It does not load Pi's other built-in extensions (MCP, codemode, and llama.cpp), so `<mcp_servers>` never appears in its output.
- When the system extension is created with dump mode enabled, or when `SANDPIPER_DUMP_SYSTEM_PROMPT=1`, a `context_with_system` hook prints the same request-time prompt and shuts the session down.
- The prompt is expected to stay the same for a whole session, so the system extension compares each prompt it renders with the session's first. When they differ, it warns "unexpected system prompt change!" with `ctx.ui.notify` and appends a unified diff to `<home directory>/<timestamp>-CHANGED-SYSPROMPT.diff`.

### Prompt editor

`sandpiper-system-prompt --edit [sandpiper options]` (`packages/cli/prompt_editor/`) opens the rendered prompt in a [Glimpse](https://github.com/hazat/glimpse) window. Text that comes from a file is editable; everything else is locked, and so are structural XML tags inside editable text. Edits are staged, previewed as unified diffs per file, and applied to the files only after a preview of the current draft. Applying writes each file atomically, keeps its mode, edits a symlink's target, and renders again; when that render fails, the files are restored.

Editor flags, removed before rendering:

| Flag                     | Meaning                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `--prompt-source <path>` | Another file to look for in the prompt. Repeatable.                                |
| `--edit-title <text>`    | Header title. Default: `Sandpiper`.                                                |
| `--edit-subtitle <text>` | Header subtitle, shown as `System prompt · <text>` when it differs from the title. |

- Every render runs the diagnostic again as a subprocess, `--json` plus the remaining options, in the same directory and environment.
- Editable regions come first from the diagnostic's `editableSpans` (`{ start, end, path, sourceStart, sourceEnd }`, offsets into `prompt`), each checked against its file; a `codec` field from older output is ignored. Files without a span are found by text: the `--prompt-source` files, the reported identity, system prompt, appended prompt, and context files, and the agent directory's `USER.md`. Each is tried whole, then without its frontmatter. Text is matched and written back verbatim: the editor never escapes or unescapes it. A leading byte order mark is skipped, as Pi skips it, and kept when the file is written. A match counts only when its text occurs exactly once. A region of only structural tags and whitespace, such as the text between two template placeholders, stays locked.
- Regions of one file with only generated text between them, such as a template split at its placeholders, share one card in the page: the regions are inline editable text, and the generated values between them show as inline value chips. A short region (up to 400 characters) of another file in the same directory, such as a sentence one template takes from a sibling template, sits inside that card with its file name. The outline lists that file once: as the element its first region opens, or as one file entry.
- A file changed on disk while the editor is open is reported in the page, polled once a second.
- Glimpse is optional. The editor finds the `glimpseui` executable through `SANDPIPER_GLIMPSEUI` or `PATH`, and imports `src/glimpse.mjs` from its package.
- The page is `page/prompt-editor.html`. Its CodeMirror editor, `page/prompt-markdown.ts`, is built into an IIFE and inlined into the page by a Bun macro (`page_assets.ts`), so `bun run build` embeds the finished page in `dist/`, and a run from source builds it on load.

## Invariants

- Keep prompt construction in `packages/core/src/`; extension code should stay glue-only.
- Keep Sandpiper's prompt prose in `packages/core/system-prompt/` templates, not in TypeScript.
- Preserve Pi-provided context-file and skill metadata instead of re-discovering it in the extension. Tool text is Pi's `tools` and `rules` sections; Sandpiper's prompt renders none.
- Do not parse Pi's rendered prompt string. Older notes that proposed parsing and replacing sections are archived.
- Keep Sandpiper's prompt provider-neutral. Provider-specific prompt text, such as the Claude Code CLI provider's clause that declares its synthetic update frames to be system prompt updates, belongs to that provider's extension and applies only to that provider's requests.
- Keep volatile task, Journal, and working-copy state out of the system prompt unless a separate design explicitly accounts for provider cache behavior.
