# Sandpiper system prompt architecture

- **Diátaxis mode**: Reference spec
- **Status**: Implemented
- **Implementation**: `packages/core/system-prompt/` (templates), `packages/core/src/system-prompt.ts`, `packages/core/src/prompt-template.ts`, `packages/core/src/startup-prompt.ts`, `packages/core/src/user-profile.ts`, `packages/core/src/version-control.ts`, `extensions/system/startup-hooks.ts`, `extensions/system/skill-loading-tool.ts`, `packages/cli/system_prompt_diagnostic.ts`, `patches/@earendil-works%2Fpi-coding-agent@1.5.2.patch`
- **Related**: [AGENT-290 Pi 1.0 migration spec](agent-290-pi-1-0-migration-spec.md) (decisions and invariants), [Pi 1.0 system prompt sections](pi-1-0-prompt-sections.md)
- **Supersedes**: archived April 2026 parsing-plan notes

## Current architecture

Sandpiper owns Pi's base prompt through Pi's custom base prompt. In the system extension's `before_agent_start` hook, it:

1. renders the Sandpiper prompt from Pi's `event.systemPromptOptions` with `buildSandpiperStartupPrompt()` in `packages/core/src/startup-prompt.ts`
2. sets `systemPromptOptions.customPrompt` to the rendered prompt, so Pi records it in the transcript as the `preamble` section
3. clears `appendSystemPrompt`, `contextFiles`, and `skills`, which Sandpiper renders itself
4. returns no `systemPrompt`: Pi applies a returned prompt to one run only and does not record it

Pi renders its own sections after Sandpiper's text: `tools` and `rules` (the tool list and every active tool's guidelines), `cwd`, and extension sections such as `mcp_servers`. Pi re-renders them before every model call and sends only changed sections.

Sandpiper carries a local `bun patch` of `@earendil-works/pi-coding-agent` so that a `customPrompt` keeps Pi's `tools` and `rules` sections; stock Pi drops them along with its default preamble.

Runs started by extensions, such as an idle `triggerTurn`, emit `before_agent_start` like prompted runs (Pi 1.2.0+), so they carry the Sandpiper prompt too, including a fresh session's first run.

```text
extensions/system/startup-hooks.ts
  -> buildSandpiperStartupPrompt()
    -> collect startup context
    -> buildSandpiperSystemPrompt()
      -> render packages/core/system-prompt/*.md
```

## Prompt sections

`buildSandpiperSystemPrompt()` emits XML-style sections in order:

1. Persona (`<identity>`, `<interaction_style>`, and `<role>`, or the `--identity` override) — Sandpiper identity, operating principles, communication rules, and coding defaults.
2. `<user_profile>` — user-wide `USER.md` profile and working preferences, if present.
3. `<harness_docs>` — Pi/Sandpiper documentation routing and path differences when package roots are available.
4. `<skills>` — skill-loading rules plus available skills from Pi's `systemPromptOptions`, as `<available_skills>` entries.
5. `<injected_context>` — injected `AGENTS.md` / `CLAUDE.md` context files from Pi's `systemPromptOptions`.
6. `<user_appended_prompt>` — user-appended system prompt content, if present.
7. `<system_notification_protocol>` — how to treat hidden system notifications.
8. `<environment>` — session start date, platform, and session-start VCS detection. Pi's `cwd` section carries the working directory.

## Templates

All prose Sandpiper writes into its prompt lives in Markdown templates in `packages/core/system-prompt/`, one file per section, named after its XML tag. TypeScript supplies only computed values.

| Template                               | Renders                                                      | Placeholders                                                                 |
| -------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `system_prompt.md`                     | The `<system_prompt>` frame and the whitespace between parts | `identity`, `sections`, `system_notification_protocol`, `environment`        |
| `identity.md`                          | `<identity>`                                                 | none                                                                         |
| `interaction_style.md`                 | `<interaction_style>`                                        | none                                                                         |
| `role.md`                              | `<role>`                                                     | none                                                                         |
| `user_profile.md`                      | `<user_profile>`                                             | `content`: `USER.md` text                                                    |
| `harness_docs.md`                      | `<harness_docs>`                                             | `piRoot`, `sandpiperRoot`, `piPackage`, `sandpiperPackage`, `piVersion`      |
| `skills.md`                            | `<skills>`                                                   | `loadInstruction`, `availableSkills`: the computed `<available_skills>` list |
| `skill_load_instruction_skill_tool.md` | The `loadInstruction` when the `skill` tool is selected      | none                                                                         |
| `skill_load_instruction_read_tool.md`  | The `loadInstruction` otherwise                              | none                                                                         |
| `injected_context.md`                  | `<injected_context>`                                         | `contextFiles`: the computed `<context_file>` elements                       |
| `user_appended_prompt.md`              | `<user_appended_prompt>`                                     | `content`: the appended prompt text                                          |
| `system_notification_protocol.md`      | `<system_notification_protocol>`                             | none                                                                         |

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
  codec: "direct";
}
```

Offsets are UTF-16 code units (JavaScript string indices). `text.slice(start, end)` equals the file's text from `sourceStart` to `sourceEnd`. The diagnostic contract also reserves codec `'xml-text'` for XML-escaped text; Sandpiper inserts all sourced text verbatim, so every span is `'direct'`.

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

The `<skills>` section treats `<available_skills>` as routing metadata. When the `skill` tool is available, the prompt tells agents to load matching skills by exact catalogue name. When the tool is unavailable, the prompt falls back to reading the matching `SKILL.md` from the exact catalogue location. Relative scripts and references are resolved against the skill root returned by the tool, or the `SKILL.md` directory in fallback mode.

## Startup context

`buildSandpiperStartupPrompt()` supplies stable launch metadata before calling the base prompt builder:

- Pi package path and version from `PI_CODING_AGENT_PACKAGE` / `PI_CODING_AGENT_VERSION`
- Sandpiper package path from `SANDPIPER_CODING_AGENT_PACKAGE`
- user profile content from `USER.md` in the agent directory resolved by Pi's `getAgentDir()`, when present
- session-start VCS detection (`jj`, `git`, or `none`)

Volatile one-shot startup context is not rendered into the system prompt. Moving volatile task, Journal, and working-copy state out of the system prompt preserves provider cache stability and keeps system guidance from changing mid-session.

## Custom prompts

If the user sets a custom prompt (`--system-prompt` or `SYSTEM.md`), Pi reports it as `systemPromptOptions.customPrompt` and Sandpiper does not replace it. `buildSandpiperStartupPrompt()` returns `undefined`, and the system extension leaves Pi's prompt handling intact. Because of the local patch, Pi still renders its `tools` and `rules` sections after a user's custom prompt.

## Diagnostics

- `sandpiper-system-prompt` (`packages/cli/system_prompt_diagnostic.ts`) runs one turn against an in-process capture provider and prints the first request's system prompt: the prompt Pi sends, including Pi's sections, with no credentials, network, or provider request. `--json` adds source metadata and [editable spans](#editable-spans).
- When the system extension is created with dump mode enabled, or when `SANDPIPER_DUMP_SYSTEM_PROMPT=1`, a `context_with_system` hook prints the same request-time prompt and shuts the session down.

## Invariants

- Keep prompt construction in `packages/core/src/`; extension code should stay glue-only.
- Keep Sandpiper's prompt prose in `packages/core/system-prompt/` templates, not in TypeScript.
- Preserve Pi-provided context-file and skill metadata instead of re-discovering it in the extension. Tool text is Pi's `tools` and `rules` sections; Sandpiper's prompt renders none.
- Do not parse Pi's rendered prompt string. Older notes that proposed parsing and replacing sections are archived.
- Keep volatile task, Journal, and working-copy state out of the system prompt unless a separate design explicitly accounts for provider cache behavior.
