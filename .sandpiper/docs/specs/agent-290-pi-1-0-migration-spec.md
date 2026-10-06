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

> **Under discussion (2026-10-06): replacing the guard with a small local `bun patch` of `@earendil-works/pi-coding-agent`.** Doug runs only the uncompiled standalone, which loads the patched `dist/core/agent-session.js`. The patch would be provider-neutral, redone on every Pi bump, and removed when upstream fixes [#5581](https://github.com/earendil-works/pi/issues/5581). Candidate shapes:
>
> - **Run `before_agent_start` for idle `triggerTurn` turns.** This needs a lock over the async preparation window to prevent concurrent runs, and leaves Esc during preparation as a gap. It also has to define what `prompt` means for a turn nobody typed. An empty-string sentinel was rejected as a hack. Passing the message text, or adding an explicit trigger field to the event, are the remaining options.
> - **Triggered runs never rewrite prompt sections.** They keep the prompt the transcript already records (written by the ownership steps below) and apply only tool loadout changes. This adds no hook semantics. A brand-new session whose first turn is a wake still gets Pi's default prompt for that run; 0.85 behaves the same way. Not yet prototyped.
>
> Provider-specific prompt text, such as a clause declaring `pi-claude-code-cli-provider`'s synthetic update frames to be system updates, belongs to that provider's extension, contributed only while it is active. It does not go in Sandpiper's prompt.

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

Provider constraint (Claude Code 2.1.290, reported by the `pi-claude-code-cli-provider` agent from a decompiled binary and live probes):

- Claude Code's system prompt is fixed per process, and its recorded prompt snapshot is replayed on `--resume` until compaction. Measured on 2.1.290: a resumed session launched with a new appended prompt still answered from the old one. With `systemPromptSnapshot: false` it used the new prompt and re-cached the prefix. The provider applies a prompt or section change in one of two ways:
  - an append-only user-side insertion: the cache survives, but the model sees user-turn context
  - a restart with the snapshot off: a correct system prompt, at the cost of a full cache rebuild
- Tool changes go through `mcp_set_servers` in-process and keep the prefix cache warm. Measured on Opus 5.5 with CC 2.1.290 and a ~12K-token prompt:

  | Turn                | cache_read | cache_create |
  | ------------------- | ---------- | ------------ |
  | Baseline            | 11,897     | 43           |
  | After a tool add    | 11,940     | 179          |
  | After a tool remove | 12,163     | 45           |

  Claude Code announces an added tool inline as a deferred tool, so only the new definition is new input. Not yet tested: the model calling a tool added mid-session.

Decision (PCCP-266, 2026-10-06): the provider never restarts Claude Code to apply a prompt change. It renders each mid-conversation system message with pi-ai's `renderSystemMessageUpdate()` and writes it to Claude Code as a hidden synthetic user frame. Tool deltas still go through `mcp_set_servers`. A stock-Pi-style tools section therefore costs one small update per tool change and keeps the cache on Claude Code too, so the choice between a tools section and no tool text no longer depends on this provider.

Sandpiper's prompt must declare that these frames are system prompt updates, like the existing system-notification protocol; otherwise Claude Code gives them user priority. The provider will supply the exact marker block around the `renderSystemMessageUpdate()` text. This clause carries the same prompt-injection exposure as the notification protocol.

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
