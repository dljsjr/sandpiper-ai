# Sandpiper system prompt architecture

- **Diátaxis mode**: Reference spec
- **Status**: Implemented
- **Implementation**: `packages/core/src/system-prompt.ts`, `packages/core/src/startup-prompt.ts`, `extensions/system/startup-hooks.ts`
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

`buildSandpiperSystemPrompt()` emits these sections in order:

1. Sandpiper persona and coding guidance.
2. Pi documentation paths and Sandpiper/Pi differences when `PI_CODING_AGENT_PACKAGE` is available.
3. Tool snippets and tool guidelines derived from Pi's `systemPromptOptions`.
4. User-appended system prompt content, if present.
5. Injected `AGENTS.md` / `CLAUDE.md` context files from Pi's `systemPromptOptions`.
6. Skills catalogue from Pi's `systemPromptOptions`, encoded as TOON.
7. Current date and current working directory.

## Startup context

`buildSandpiperStartupPrompt()` adds Sandpiper-specific context before calling the base prompt builder:

- project triggers
- active task context
- working-copy summary
- cold-start guidance
- previous standup content
- Pi package path and version from `PI_CODING_AGENT_PACKAGE` / `PI_CODING_AGENT_VERSION`

The expensive startup context is one-shot. `startupContextPending` and `coldStartGuidancePending` are cleared after the first prompt build for the session.

## Custom prompts

If Pi reports `systemPromptOptions.customPrompt`, Sandpiper does not replace the prompt. `buildSandpiperStartupPrompt()` returns `undefined`, and the system extension leaves Pi's prompt handling intact.

## Prompt dump mode

When the system extension is created with dump mode enabled, or when `SANDPIPER_DUMP_SYSTEM_PROMPT=1`, the `before_agent_start` hook prints the effective system prompt and shuts the session down.

## Invariants

- Keep prompt construction in `sandpiper-ai-core`; extension code should stay glue-only.
- Preserve Pi-provided tool, context-file, and skill metadata instead of re-discovering it in the extension.
- Do not parse Pi's rendered prompt string. Older notes that proposed parsing and replacing sections are archived.
- Keep static sections before volatile startup context where practical so provider prompt caches can reuse more prefix content.
