# AGENT-290 Pi 1.0 migration spec

- **Diátaxis mode**: Reference spec
- **Status**: Draft
- **Task**: AGENT-290 (subtasks AGENT-293 to AGENT-303)
- **Related**: [discovery notes](agent-290-pi-1-0-discovery.md) (rationale and evidence), [Pi 1.0 system prompt sections](pi-1-0-prompt-sections.md) (Pi reference), [work plan](agent-290-pi-1-0-migration-work-plan.md)

## Scope

Phase 1 of the migration: run Sandpiper on `@earendil-works/pi-coding-agent` 1.0.x while preserving current behavior.

Out of scope:

- adoption of new Pi 1.0 capabilities (listed as candidates in the work plan)
- the build and distribution redesign (AGENT-301)
- the `pi-claude-code-cli-provider` migration, which happens in that repository

## Versions

| Item                                                 | Requirement                                                                                                                        |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `@earendil-works/pi-coding-agent`, `pi-ai`, `pi-tui` | `1.0.3` everywhere they appear (root, `packages/cli`, `extensions/*`, `plugins/pi/extensions`). Move to `1.0.4` once it is on npm. |
| Version policy                                       | Exact versions, as enforced by `bun run check:deps`. Pi's recommendation of `"*"` peer ranges is deferred to AGENT-301.            |

## System prompt

### Ownership

The Sandpiper identity extension (`extensions/system/startup-hooks.ts`) owns the prompt through Pi's custom base prompt, not a forced prompt.

In `before_agent_start`, the extension:

1. Renders the Sandpiper prompt from `event.systemPromptOptions`, as today.
2. Sets `systemPromptOptions.customPrompt` to the rendered prompt.
3. Clears the inputs Sandpiper renders itself: `appendSystemPrompt = ""`, `contextFiles = []`, `skills = []`.
4. Returns no `systemPrompt`. Pi applies forced prompts after `context_with_system` and does not record them, so a returned `systemPrompt` would defeat the guard and the transcript record.

When `systemPromptOptions.customPrompt` is already set by the user (`--system-prompt` or `SYSTEM.md`), Sandpiper leaves the prompt alone, as today.

### Rendered content

| Block                    | Inputs                                                                                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<tools>` tool list      | `toolSnippets` for `selectedTools` minus `hiddenTools`, in `selectedTools` order                                                                                     |
| `<tools>` guidelines     | `toolGuidelines[name]` for each listed tool in that order, then `promptGuidelines`; trimmed, de-duplicated, and filtered as `normalizePromptGuidelines()` does today |
| `<skills>`               | `skills` as received, before clearing                                                                                                                                |
| `<injected_context>`     | `contextFiles` as received, before clearing                                                                                                                          |
| `<user_appended_prompt>` | `appendSystemPrompt` as received, before clearing                                                                                                                    |
| `<environment>`          | Session start date, platform, and version control. No `<cwd>`: Pi's `cwd` section carries the working directory.                                                     |

Pi renders `cwd` and any extension sections, such as `mcp_servers`, after Sandpiper's text. Sandpiper does not override or remove them.

### Guard

The identity extension registers a `context_with_system` handler that runs on every request.

| Rule                           | Behavior                                                                                                                                                                                                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| When it is active              | Only while Sandpiper owns the prompt. It does nothing when the user supplied a custom prompt (`ctx.getSystemPromptOptions().customPrompt` is set).                                                                                                                         |
| Recognizing Sandpiper's prompt | A `preamble` that starts with `<system_prompt>`                                                                                                                                                                                                                            |
| Reverting patches              | For each system message, track the replayed `preamble`. A message whose `sections` patch moves the preamble from a Sandpiper prompt to anything else loses its `sections` and `content`; its `toolsAdded` and `toolsRemoved` stay. A message left with nothing is dropped. |
| No Sandpiper prompt yet        | If the replayed preamble is not a Sandpiper prompt, as when a new session's first turn is an idle wake, the request carries a Sandpiper prompt rendered from `ctx.getSystemPromptOptions()` in place of Pi's default sections.                                             |
| Everything else                | Non-system messages, tool declarations, and Pi's `cwd` and extension sections pass through unchanged.                                                                                                                                                                      |

The guard affects only the outgoing request. Pi may still record a reverting patch in the session file after a multi-turn idle wake; the next user-prompted run records Sandpiper's prompt again.

### Mid-session tool changes

Sandpiper must support changes to the active tool set during a session. Sources include `pi.setActiveTools()` (Navigator adds its tools and removes `edit` and `write` while watching), lazy tool registration, and `tool_search` loading deferred tools.

| Aspect                       | Behavior under this spec                                                                                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tool declarations            | Pi records `toolsAdded`/`toolsRemoved` deltas before the next request; the guard passes them through unchanged.                                                |
| Sandpiper's `<tools>` block  | Rendered into the preamble in `before_agent_start`, so it catches up at the next user-prompted run, and the change travels as an update of the whole preamble. |
| Within a run or an idle wake | Declarations change immediately; the `<tools>` text stays stale until the next user prompt.                                                                    |

Open design (AGENT-295, AGENT-296): keep the `<tools>` block current within runs without resending the whole prompt for each change. Candidates:

- The guard derives a separate tools section patch from each transcript tool delta. It must be deterministic so request prefixes stay stable. It would not appear in the session file.
- Upstream support for per-request section rendering, as Pi Durable's `section()` provides.

Provider constraint (Claude Code 2.1.290, reported by the `pi-claude-code-cli-provider` agent from a decompiled binary; cache costs not yet measured):

- Claude Code's system prompt is fixed per process, and its recorded prompt snapshot is replayed on `--resume` until compaction. Measured on 2.1.290: a resumed session launched with a new appended prompt still answered from the old one. With `systemPromptSnapshot: false` it used the new prompt and re-cached the prefix. The provider applies a prompt or section change in one of two ways:
  - an append-only user-side insertion: the cache survives, but the model sees user-turn context
  - a restart with the snapshot off: a correct system prompt, at the cost of a full cache rebuild
- Tool changes go through `mcp_set_servers` in-process. With inline tool announcements off, a swap may rewrite the tool list and break the prefix cache.

So with this provider, every change to Sandpiper's prompt text is expensive, and tool changes may be. Under consideration: a Sandpiper protocol clause, like the existing system-notification protocol, that gives framed user-side prompt updates system authority. That would make the cache-preserving path semantically correct, with the same prompt-injection exposure the notification protocol has.

### Invariants

The AGENT-294 regression tests assert these. "Sandpiper prompt" means a replayed system prompt whose preamble starts with `<system_prompt>`.

| Invariant                                                                           | Applies to                                                                                                  |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Every provider request carries the Sandpiper prompt                                 | User-prompted runs, idle triggered runs on every turn, wakes before the first user prompt, resumed sessions |
| No request contains Pi's default preamble text                                      | All requests                                                                                                |
| `session.state.systemPrompt`, which `/export` renders, carries the Sandpiper prompt | After any user-prompted run                                                                                 |
| Each request extends the previous request byte-for-byte                             | Consecutive requests without a deliberate prompt or tool change, including across idle wakes                |
| The `<tools>` guidelines match those rendered on Pi 0.85.1 for the same tools       | Prompt rendering                                                                                            |
| Extension sections reach the provider                                               | For example a test extension setting `sections.mcp_servers`                                                 |
| After an active-tool change, request declarations match the active tools            | Changes between user prompts, within a run, and during an idle wake                                         |

### Diagnostics

| Surface                                        | Requirement                                                                                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `sandpiper-system-prompt`                      | Writes the prompt the provider receives, including Pi's `cwd` and extension sections, without credentials or network access. `--json` keeps its current source metadata. |
| `SANDPIPER_DUMP_SYSTEM_PROMPT=1`               | Dumps the same prompt as `sandpiper-system-prompt`                                                                                                                       |
| Prompt-change canary (`lastKnownSystemPrompt`) | Unchanged: compares each render with the first render of the extension runtime                                                                                           |

## AutoTOON

`extensions/autotoon/autotoon.ts` handles `tool_result` as follows:

| Case                                                                              | Behavior                                                                         |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `event.parentToolCallId` is set (nested call, for example from a codemode script) | No change                                                                        |
| `event.isError`                                                                   | No change, as today                                                              |
| JSON text converted                                                               | Returns the converted `content` and `structuredContent: event.structuredContent` |

## Extension API adjustments

Only the test doubles and the integration mock provider change. AGENT-293 lists them.

Production extension code needs no other API changes: `tsc` against Pi 1.0.3 reports errors only in those files.

## Open items

| Item                                                                                | Owner                            |
| ----------------------------------------------------------------------------------- | -------------------------------- |
| Codemode and Bun OAuth in the compiled standalone app                               | AGENT-299                        |
| Defaults for fullscreen TUI, `/bug`, startup header, built-in extensions, telemetry | AGENT-300 (needs user decisions) |
| CLI versus Pi-package artifacts, host-provided dependency warning, asset copying    | AGENT-301                        |

## Provider-facing request shape

Custom providers, including `pi-claude-code-cli-provider`, receive a `TranscriptContext` with `messages` only:

| Part                         | Shape                                                                                                                                                                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Leading system message       | `content: ""`. `sections` hold `preamble` (the Sandpiper prompt), `cwd`, and any extension sections. `toolsAdded` holds the initial tool declarations.                                                                                 |
| Later system messages        | Section patches (`null` removes a section) and `toolsAdded`/`toolsRemoved` deltas, in transcript order. The guard may have dropped reverting section patches.                                                                          |
| Reading the prompt and tools | `getCurrentSystemPrompt(messages)` and `getCurrentTools(messages)` from `@earendil-works/pi-ai` replay all system messages. `resolveTranscript()` and `collapseSystemMessages()` handle APIs without mid-conversation system messages. |
