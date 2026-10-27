# Sandpiper system prompt architecture

- **Diátaxis mode**: Reference spec
- **Status**: Implemented
- **Implementation**: `packages/core/src/system-prompt.ts`, `packages/core/src/startup-prompt.ts`, `packages/core/src/user-profile.ts`, `packages/core/src/version-control.ts`, `extensions/system/startup-hooks.ts`, `extensions/system/skill-loading-tool.ts`, `patches/@earendil-works%2Fpi-coding-agent@1.3.0.patch`
- **Related**: [AGENT-290 Pi 1.0 migration spec](agent-290-pi-1-0-migration-spec.md) (decisions and invariants), [Pi 1.0 system prompt sections](pi-1-0-prompt-sections.md)
- **Supersedes**: archived April 2026 parsing-plan notes

## Current architecture

Sandpiper owns Pi's base prompt through Pi's custom base prompt. In the system extension's `before_agent_start` hook, it:

1. renders the Sandpiper prompt from Pi's `event.systemPromptOptions` with `buildSandpiperStartupPrompt()` in `sandpiper-ai-core`
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
```

## Prompt sections

`buildSandpiperSystemPrompt()` emits XML-style sections in order:

1. Persona (`<identity>` and related blocks, or the `--identity` override) — Sandpiper identity, operating principles, communication rules, and coding defaults.
2. `<user_profile>` — user-wide `USER.md` profile and working preferences, if present.
3. `<harness_docs>` — Pi/Sandpiper documentation routing and path differences when package roots are available.
4. `<skills>` — skill-loading rules plus available skills from Pi's `systemPromptOptions`, as `<available_skills>` entries.
5. `<injected_context>` — injected `AGENTS.md` / `CLAUDE.md` context files from Pi's `systemPromptOptions`.
6. `<user_appended_prompt>` — user-appended system prompt content, if present.
7. `<system_notification_protocol>` — how to treat hidden system notifications.
8. `<environment>` — session start date, platform, and session-start VCS detection. Pi's `cwd` section carries the working directory.

## Skill loading behavior

The `<skills>` section treats `<available_skills>` as routing metadata. When the `skill` tool is available, the prompt tells agents to load matching skills by exact catalogue name. When the tool is unavailable, the prompt falls back to reading the matching `SKILL.md` from the exact catalogue location. Relative scripts and references are resolved against the skill root returned by the tool, or the `SKILL.md` directory in fallback mode.

## Startup context

`buildSandpiperStartupPrompt()` supplies stable launch metadata before calling the base prompt builder:

- Pi package path and version from `PI_CODING_AGENT_PACKAGE` / `PI_CODING_AGENT_VERSION`
- Sandpiper package path from `SANDPIPER_CODING_AGENT_PACKAGE`
- user profile content from `USER.md` in the agent directory resolved by Pi's `getAgentDir()`, when present
- session-start VCS detection (`jj`, `git`, `hg`, `svn`, `fossil`, `perforce`, or `none`)

The older one-shot startup context fields (`projectTriggers`, `activeTaskContext`, `workingCopyContext`, `coldStartGuidance`, and `standupContent`) remain in the structured options for now but are not rendered into the system prompt. Moving volatile task, Journal, and working-copy state out of the system prompt preserves provider cache stability and keeps system guidance from changing mid-session.

## Custom prompts

If the user sets a custom prompt (`--system-prompt` or `SYSTEM.md`), Pi reports it as `systemPromptOptions.customPrompt` and Sandpiper does not replace it. `buildSandpiperStartupPrompt()` returns `undefined`, and the system extension leaves Pi's prompt handling intact. Because of the local patch, Pi still renders its `tools` and `rules` sections after a user's custom prompt.

## Diagnostics

- `sandpiper-system-prompt` (`packages/cli/system_prompt_diagnostic.ts`) runs one turn against an in-process capture provider and prints the first request's system prompt: the prompt Pi sends, including Pi's sections, with no credentials, network, or provider request. `--json` adds source metadata.
- When the system extension is created with dump mode enabled, or when `SANDPIPER_DUMP_SYSTEM_PROMPT=1`, a `context_with_system` hook prints the same request-time prompt and shuts the session down.

## Invariants

- Keep prompt construction in `sandpiper-ai-core`; extension code should stay glue-only.
- Preserve Pi-provided context-file and skill metadata instead of re-discovering it in the extension. Tool text is Pi's `tools` and `rules` sections; Sandpiper's prompt renders none.
- Do not parse Pi's rendered prompt string. Older notes that proposed parsing and replacing sections are archived.
- Keep volatile task, Journal, and working-copy state out of the system prompt unless a separate design explicitly accounts for provider cache behavior.
