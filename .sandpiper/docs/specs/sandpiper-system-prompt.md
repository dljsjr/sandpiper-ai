# Sandpiper system prompt architecture

- **Diátaxis mode**: Reference spec
- **Status**: Implemented
- **Implementation**: `packages/core/src/system-prompt.ts`, `packages/core/src/startup-prompt.ts`, `packages/core/src/user-profile.ts`, `packages/core/src/version-control.ts`, `extensions/system/startup-hooks.ts`, `extensions/system/skill-loading-tool.ts`
- **Supersedes**: archived April 2026 parsing-plan notes

## Current architecture

Sandpiper replaces Pi's generated base prompt in the system extension's `before_agent_start` hook.

The hook receives Pi's `event.systemPromptOptions`, not just the already-rendered prompt string, and delegates prompt construction to `buildSandpiperStartupPrompt()` in `sandpiper-ai-core`.

```text
extensions/system/startup-hooks.ts
  -> buildSandpiperStartupPrompt()
    -> collect startup context
    -> buildSandpiperSystemPrompt()
```

## Prompt sections

`buildSandpiperSystemPrompt()` emits XML-style sections in order:

1. `<persona>` — Sandpiper identity, operating principles, communication rules, and coding defaults.
2. `<user_profile>` — user-wide `USER.md` profile and working preferences, if present.
3. `<tools>` — tool snippets and tool guidelines derived from Pi's `systemPromptOptions`.
4. `<harness_docs>` — Pi/Sandpiper documentation routing and path differences when package roots are available.
5. `<skills>` — skill-loading rules plus available skills from Pi's `systemPromptOptions`, as `<available_skills>` entries.
6. `<injected_context>` — injected `AGENTS.md` / `CLAUDE.md` context files from Pi's `systemPromptOptions`.
7. `<user_appended_prompt>` — user-appended system prompt content, if present.
8. `<environment>` — current date, current working directory, platform, and session-start VCS detection.

## Skill loading behavior

The `<skills>` section treats `<available_skills>` as routing metadata. When the `skill` tool is available, the prompt tells agents to load matching skills by exact catalogue name. When the tool is unavailable, the prompt falls back to reading the matching `SKILL.md` from the exact catalogue location. Relative scripts and references are resolved against the skill root returned by the tool, or the `SKILL.md` directory in fallback mode.

## Startup context

`buildSandpiperStartupPrompt()` supplies stable launch metadata before calling the base prompt builder:

- Pi package path and version from `PI_CODING_AGENT_PACKAGE` / `PI_CODING_AGENT_VERSION`
- Sandpiper package path from `SANDPIPER_CODING_AGENT_PACKAGE`
- user profile content from `USER.md` in the agent directory resolved by Pi's `getAgentDir()`, when present
- session-start VCS detection (`jj`, `git`, `hg`, `svn`, `fossil`, `perforce`, or `none`)

The older one-shot startup context fields (`projectTriggers`, `activeTaskContext`, `workingCopyContext`, `coldStartGuidance`, and `standupContent`) remain in the structured options for now but are not rendered into the system prompt. Moving volatile task, standup, and working-copy state out of the system prompt preserves provider cache stability and keeps system guidance from changing mid-session.

## Custom prompts

If Pi reports `systemPromptOptions.customPrompt`, Sandpiper does not replace the prompt. `buildSandpiperStartupPrompt()` returns `undefined`, and the system extension leaves Pi's prompt handling intact.

## Prompt dump mode

When the system extension is created with dump mode enabled, or when `SANDPIPER_DUMP_SYSTEM_PROMPT=1`, the `before_agent_start` hook prints the effective system prompt and shuts the session down.

## Invariants

- Keep prompt construction in `sandpiper-ai-core`; extension code should stay glue-only.
- Preserve Pi-provided tool, context-file, and skill metadata instead of re-discovering it in the extension.
- Do not parse Pi's rendered prompt string. Older notes that proposed parsing and replacing sections are archived.
- Keep volatile task, standup, and working-copy state out of the system prompt unless a separate design explicitly accounts for provider cache behavior.
