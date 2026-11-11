# AGENT-290 Pi 1.0 migration spec

- **Diátaxis mode**: Reference spec
- **Status**: Implemented and merged (2026-10-06). AGENT-301's packaging decisions moved to TOOLS-30.
- **Task**: AGENT-290 (subtasks AGENT-293 and AGENT-295 to AGENT-302)
- **Related**: [discovery notes](../../archive/agent-290-pi-1-0-discovery.md) (archived rationale and evidence), [Pi 1.0 system prompt sections](pi-1-0-prompt-sections.md) (Pi reference), [work plan](../../archive/agent-290-pi-1-0-migration-work-plan.md) (archived)

## Scope

Phase 1 of the migration: run Sandpiper on `@earendil-works/pi-coding-agent` 1.0.x while preserving current behavior.

Out of scope:

- adoption of new Pi 1.0 capabilities (see [Adoption candidates](#adoption-candidates))
- the build-topology simplification completed later under TOOLS-30
- the `pi-claude-code-cli-provider` migration, which happens in that repository

## Versions

| Item                                                 | Requirement                                                                                                                  |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `@earendil-works/pi-coding-agent`, `pi-ai`, `pi-tui` | `1.0.4` everywhere they appear (root, `packages/cli`, and `extensions/*`). Published to npm 2026-10-05. |
| Version policy                                       | Exact versions, as enforced by `bun run check:deps`.                                                                         |

## System prompt

Goal: every provider request carries Sandpiper's prompt, whatever started the turn. The mechanism is secondary.

A _synthetic turn_ is a run started by an extension rather than by user input, for example `pi.sendMessage(..., { triggerTurn: true })` from a background-process exit, Tattler, or Chorus. An _idle synthetic turn_ starts while no run is active.

### Ownership

> **Decided (2026-10-06): Shape B replaces the guard, with no patch for the first-turn gap.** Rationale: parity with today's behavior at the smallest patch. Sandpiper carries a small local `bun patch` of `@earendil-works/pi-coding-agent`. The workspace runtime loads the patched `dist/core/agent-session.js`. The patch would be provider-neutral, redone on every Pi bump, and removed when upstream fixes [#5581](https://github.com/earendil-works/pi/issues/5581). Shapes considered:
>
> - **Shape A: run `before_agent_start` for idle `triggerTurn` turns.** This needs a lock over the async preparation window to prevent concurrent runs, and leaves Esc during preparation as a gap. It also has to define what `prompt` means for a turn nobody typed. An empty-string sentinel was rejected as a hack. Passing the message text, or adding an explicit trigger field to the event, are the remaining options.
> - **Shape B: triggered runs never rewrite prompt sections.** They keep the prompt the transcript already records (written by the ownership steps below) and apply only tool loadout changes. This adds no hook semantics. A brand-new session whose first turn is a synthetic turn still gets Pi's default prompt for that run; 0.85 behaves the same way. Not yet prototyped.
>   Shape B does not close the first-turn gap: a new session has no recorded prompt until its first user-prompted run. The peer-supervisor direction would make synthetic first turns common, for example a launched peer that gets its work over Tattler. Ways to close it:
>   - Make Sandpiper's prompt part of Pi's base prompt options, which every run falls back to. This is the root fix, but it needs a patch hook for an extension-supplied base prompt, because the prompt's inputs exist only after Pi loads. Not yet sized.
>   - Run preparation only when the transcript has no prompt yet.
>   - Avoid synthetic first turns: launchers send the first work as a real prompt (RPC `prompt`), or Tattler holds messages until a prompt is recorded.
>
> Decision details:
>
> - **Patch:** Shape B. Idle synthetic runs keep the prompt the transcript records and apply only tool loadout changes; `before_agent_start` semantics are unchanged. The ownership steps below record Sandpiper's prompt in the transcript. The earlier `context_with_system` guard design is superseded; [Local Pi patch](#local-pi-patch) specifies the patch, and AGENT-295 implements it.
> - **Tool sections (2026-10-06):** do what Pi does. The same local patch makes Pi render its own `tools` and `rules` sections under a `customPrompt`, so Pi re-renders the tool list and guidelines before every model call and sends only changed sections. Sandpiper drops its own `<tools>` block. Rationale: Sandpiper already carries the patch, and without it the tool text lags tool changes until the next user prompt. AGENT-296 implements it.
> - **First-turn gap:** handled by option 3. Whatever launches a fresh session for work, such as the future peer supervisor, gives it its first task as a real prompt (RPC `prompt`). No patch.
> - **Option 1:** an extension-supplied base prompt API. Deferred as an input to the planned ground-up harness, which should support system prompt sections natively.
>
> Provider-specific prompt text, such as a clause declaring `pi-claude-code-cli-provider`'s synthetic update frames to be system updates, belongs to that provider's extension, contributed only while it is active. It does not go in Sandpiper's prompt.

The Sandpiper identity extension (`extensions/system/startup-hooks.ts`) owns the prompt through Pi's custom base prompt, not a forced prompt.

In `before_agent_start`, the extension:

1. Renders the Sandpiper prompt from `event.systemPromptOptions`, as today.
2. Sets `systemPromptOptions.customPrompt` to the rendered prompt.
3. Clears the inputs Sandpiper renders itself: `appendSystemPrompt = ""`, `contextFiles = []`, `skills = []`.
4. Returns no `systemPrompt`. Pi does not record forced prompts in the transcript, so a returned `systemPrompt` would leave the transcript, `/export`, and synthetic runs on Pi's default prompt.

When `systemPromptOptions.customPrompt` is already set by the user (`--system-prompt` or `SYSTEM.md`), Sandpiper leaves the prompt alone, as today.

### Rendered content

| Block                    | Inputs                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `<skills>`               | `skills` as received, before clearing                                                                            |
| `<injected_context>`     | `contextFiles` as received, before clearing                                                                      |
| `<user_appended_prompt>` | `appendSystemPrompt` as received, before clearing                                                                |
| `<environment>`          | Session start date, platform, and version control. No `<cwd>`: Pi's `cwd` section carries the working directory. |

Sandpiper renders no tool text. Pi renders `tools`, `rules`, `cwd`, and any extension sections, such as `mcp_servers`, after Sandpiper's text. Sandpiper does not override or remove them. Pi's `rules` adds its own fixed rules to the tool guidelines: a shell file-operations rule when no `grep`, `find`, or `ls` tool is active, "Be concise in your responses", and "Show file paths clearly when working with files".

### Local Pi patch

Sandpiper carries one local `bun patch` of `@earendil-works/pi-coding-agent`, saved under `patches/` with a `patchedDependencies` entry. It changes two compiled files:

| Part                     | File                         | Behavior                                                                                                                                                                                                                                                             |
| ------------------------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Synthetic runs (Shape B) | `dist/core/agent-session.js` | When a run starts without `before_agent_start` (no prepared prompt options), Pi keeps the system prompt sections the transcript records, re-renders only `tools` and `rules` from the active tools, and applies tool loadout changes. No reverting patch is written. |
| Tool sections            | `dist/core/system-prompt.js` | A `customPrompt` no longer suppresses Pi's `tools` and `rules` sections. `docs` stays suppressed; Sandpiper's `<harness_docs>` covers it.                                                                                                                            |

| Aspect                                             | Behavior                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `before_agent_start`                               | Unchanged: fires only for user-prompted runs.                                                                                                                                                                                                                                                                                                                                                              |
| Prompt input changes (`/reload`, resource changes) | Applied at the next user-prompted run.                                                                                                                                                                                                                                                                                                                                                                     |
| First-turn gap                                     | A fresh session whose first run is synthetic has no recorded prompt, so the patch leaves Pi's behavior alone: the run's first request carries tool declarations but an empty system prompt, and Pi's default sections arrive as a patch from its second turn (measured on 1.0.4). 0.85 used Pi's default for the whole run. Launchers give a fresh session its first task as a real prompt (RPC `prompt`). |
| Maintenance                                        | Redo the patch on every Pi bump. Remove the synthetic-runs part when upstream fixes [#5581](https://github.com/earendil-works/pi/issues/5581), and the tool-sections part if Pi lets a custom preamble keep its tool sections.                                                                                                                                                                             |

### Mid-session tool changes

Sandpiper must support changes to the active tool set during a session. Sources include `pi.setActiveTools()` (Navigator adds its tools and removes `edit` and `write` while watching), lazy tool registration, and `tool_search` loading deferred tools.

| Aspect                                 | Behavior under this spec                                                                                                      |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Tool declarations                      | Pi records `toolsAdded`/`toolsRemoved` deltas before the next request.                                                        |
| Tool text                              | Pi re-renders its `tools` and `rules` sections from the active tools before every model call and sends only changed sections. |
| Within a run or an idle synthetic turn | Declarations and tool text change together before the next model call.                                                        |

Alternatives considered before the 2026-10-06 tool-sections decision: Sandpiper-rendered tool sections without a patch (tool text lags until the next user prompt), no tool text in the prompt, and upstream per-request section rendering as Pi Durable's `section()` provides.

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

The clause declaring these frames to be system prompt updates lives in the provider's own bridge preamble, which it appends only to Claude Code's system prompt. Sandpiper's prompt stays provider-neutral.

### Invariants

The regression tests in AGENT-295 and AGENT-296 assert these. "Sandpiper prompt" means a replayed system prompt whose preamble starts with `<system_prompt>`.

| Invariant                                                                                                     | Applies to                                                                                              |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Every provider request carries the Sandpiper prompt                                                           | User-prompted runs, idle synthetic runs on every turn, resumed sessions. Exception: the first-turn gap. |
| No request contains Pi's default preamble text                                                                | All requests except the first-turn gap                                                                  |
| `session.state.systemPrompt`, which `/export` renders, carries the Sandpiper prompt                           | After any user-prompted run, including after later synthetic runs                                       |
| Each request extends the previous request byte-for-byte                                                       | Consecutive requests without a deliberate prompt or tool change, including across idle synthetic turns  |
| Pi's `rules` section contains every guideline Sandpiper rendered on Pi 0.85.1 for the same tools              | Prompt rendering                                                                                        |
| Sandpiper's preamble contains no tool list or tool guidelines                                                 | Prompt rendering                                                                                        |
| Extension sections reach the provider                                                                         | For example a test extension setting `sections.mcp_servers`                                             |
| After an active-tool change, request declarations and the `tools` and `rules` sections match the active tools | Changes between user prompts, within a run, and during an idle synthetic turn                           |

### Diagnostics

| Surface                                        | Requirement                                                                                                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sandpiper-system-prompt`                      | Writes the prompt the provider receives, including Pi's `tools`, `rules`, `cwd`, and extension sections, without credentials or network access. `--json` keeps its current source metadata. |
| `SANDPIPER_DUMP_SYSTEM_PROMPT=1`               | Dumps the same prompt as `sandpiper-system-prompt`                                                                                                                                          |
| Prompt-change canary (`lastKnownSystemPrompt`) | Unchanged: compares each render with the first render of the extension runtime                                                                                                              |

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

## Follow-up

| Item | Where |
| --- | --- |
| Retain only the workspace runtime and local helper builds | TOOLS-30 |

### Adoption candidates

These were discussed but are not authorized. Each needs Doug's go-ahead before it becomes a task:

- Render Sandpiper's blocks as Pi sections instead of one preamble, so changes travel as per-section updates.
- Remove the synthetic-runs part of the local Pi patch once upstream fixes [#5581](https://github.com/earendil-works/pi/issues/5581). The tests in `extensions/system/prompt-ownership.test.ts` should still pass without it.
- Declare `outputSchema` and return `structuredContent` from Sandpiper tools that return data.
- Add tool `annotations` (`readOnlyHint` and related hints) to Sandpiper tools.
- Register rarely used Sandpiper tools with `exposure: "deferred"` and enable `tool_search`, so their snippets and guidelines leave the `tools` and `rules` sections until the model loads them. `pi-claude-code-cli-provider` delivers mid-run tool additions through `tools/list_changed` since PCCP-304, so a loaded tool is callable in the same run.
- Register turn-control tools (`done`, `tattler_receive`) with `exposure: "model-only"` if codemode scripts calling them becomes a measured problem: calls from scripts ignore `terminate`.

### MCP client adoption

Doug approved replacing the internal mcporter library in the simplification work. TOOLS-100–102 delivered the adapter, dependencies, and verification. Sandpiper uses the standalone `@earendil-works/pi-mcp` client behind our existing `web_search` tool. It does not use `pi.registerMcpServer()` or expose additional server tools.

## Provider-facing request shape

Custom providers, including `pi-claude-code-cli-provider`, receive a `TranscriptContext` with `messages` only:

| Part                         | Shape                                                                                                                                                                                                                                                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Leading system message       | `content: ""`. `sections` hold `preamble` (the Sandpiper prompt), `tools`, `rules`, `cwd`, and any extension sections. `toolsAdded` holds the initial tool declarations.                                                                                                                                              |
| Later system messages        | Section patches (`null` removes a section) and `toolsAdded`/`toolsRemoved` deltas, in transcript order.                                                                                                                                                                                                               |
| Reading the prompt and tools | `getCurrentSystemPrompt(messages)` and `getCurrentTools(messages)` from `@earendil-works/pi-ai` replay all system messages. `resolveTranscript()` and `collapseSystemMessages()` handle APIs without mid-conversation system messages.                                                                                |
| Resumed pre-1.0 sessions     | A session written before Pi 1.0 has no system messages. Pi writes its first system message after the legacy history, just before the next user message, so it is not at the head of the transcript (measured on 1.0.4). Providers that take the prompt only from a leading system message must also handle this case. |
