# AGENT-290 Pi 1.0 migration spec

- **Diátaxis mode**: Reference spec
- **Status**: Draft
- **Task**: AGENT-290 (subtasks AGENT-293 and AGENT-295 to AGENT-302)
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

Goal: every provider request carries Sandpiper's prompt, whatever started the turn. The mechanism is secondary.

A _synthetic turn_ is a run started by an extension rather than by user input, for example `pi.sendMessage(..., { triggerTurn: true })` from a background-process exit, Tattler, or Chorus. An _idle synthetic turn_ starts while no run is active.

### Ownership

> **Decided (2026-10-06): Shape B replaces the guard, with no patch for the first-turn gap.** Rationale: parity with today's behavior at the smallest patch. Sandpiper carries a small local `bun patch` of `@earendil-works/pi-coding-agent`. Doug runs only the uncompiled standalone, which loads the patched `dist/core/agent-session.js`. The patch would be provider-neutral, redone on every Pi bump, and removed when upstream fixes [#5581](https://github.com/earendil-works/pi/issues/5581). Shapes considered:
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
> - **Patch:** Shape B. Idle synthetic runs keep the prompt the transcript records and apply only tool loadout changes; `before_agent_start` semantics are unchanged. The ownership steps below record Sandpiper's prompt in the transcript. The earlier `context_with_system` guard design is superseded; [Synthetic runs](#synthetic-runs-shape-b-patch) specifies the patch, and AGENT-295 implements it.
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

| Block                    | Inputs                                                                                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<tools>` tool list      | `toolSnippets` for `selectedTools` minus `hiddenTools`, in `selectedTools` order                                                                                     |
| `<tools>` guidelines     | `toolGuidelines[name]` for each listed tool in that order, then `promptGuidelines`; trimmed, de-duplicated, and filtered as `normalizePromptGuidelines()` does today |
| `<skills>`               | `skills` as received, before clearing                                                                                                                                |
| `<injected_context>`     | `contextFiles` as received, before clearing                                                                                                                          |
| `<user_appended_prompt>` | `appendSystemPrompt` as received, before clearing                                                                                                                    |
| `<environment>`          | Session start date, platform, and version control. No `<cwd>`: Pi's `cwd` section carries the working directory.                                                     |

Pi renders `cwd` and any extension sections, such as `mcp_servers`, after Sandpiper's text. Sandpiper does not override or remove them.

### Synthetic runs (Shape B patch)

Sandpiper carries a local `bun patch` of `@earendil-works/pi-coding-agent` (`dist/core/agent-session.js`, saved under `patches/` with a `patchedDependencies` entry).

| Aspect                                             | Behavior                                                                                                                                                                                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Idle synthetic runs                                | When a run starts without `before_agent_start` (no prepared prompt options), Pi keeps the system prompt sections the transcript records and applies only tool loadout changes, instead of rebuilding sections from its base options. No reverting patch is written. |
| `before_agent_start`                               | Unchanged: fires only for user-prompted runs.                                                                                                                                                                                                                       |
| Prompt input changes (`/reload`, resource changes) | Applied at the next user-prompted run.                                                                                                                                                                                                                              |
| First-turn gap                                     | A fresh session whose first turn is synthetic gets Pi's default prompt for that run, as on 0.85. Launchers give a fresh session its first task as a real prompt (RPC `prompt`).                                                                                     |
| Maintenance                                        | Redo the patch on every Pi bump; remove it when upstream fixes [#5581](https://github.com/earendil-works/pi/issues/5581).                                                                                                                                           |

### Mid-session tool changes

Sandpiper must support changes to the active tool set during a session. Sources include `pi.setActiveTools()` (Navigator adds its tools and removes `edit` and `write` while watching), lazy tool registration, and `tool_search` loading deferred tools.

| Aspect                                 | Behavior under this spec                                                                                                                                       |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tool declarations                      | Pi records `toolsAdded`/`toolsRemoved` deltas before the next request.                                                                                         |
| Sandpiper's `<tools>` block            | Rendered into the preamble in `before_agent_start`, so it catches up at the next user-prompted run, and the change travels as an update of the whole preamble. |
| Within a run or an idle synthetic turn | Declarations change immediately; the `<tools>` text stays stale until the next user prompt.                                                                    |

Open design (AGENT-295, AGENT-296): keep the `<tools>` block current within runs without resending the whole prompt for each change. Candidates:

- A separate Sandpiper tools section, as stock Pi does with its `tools` and `rules` sections, so a tool change updates one small section rather than the whole preamble.
- No tool text in the prompt: declarations only, with per-tool guidelines dropped from the prompt.
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

The clause declaring these frames to be system prompt updates lives in the provider's own bridge preamble, which it appends only to Claude Code's system prompt. Sandpiper's prompt stays provider-neutral.

### Invariants

The regression tests in AGENT-295 and AGENT-296 assert these. "Sandpiper prompt" means a replayed system prompt whose preamble starts with `<system_prompt>`.

| Invariant                                                                           | Applies to                                                                                              |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Every provider request carries the Sandpiper prompt                                 | User-prompted runs, idle synthetic runs on every turn, resumed sessions. Exception: the first-turn gap. |
| No request contains Pi's default preamble text                                      | All requests except the first-turn gap                                                                  |
| `session.state.systemPrompt`, which `/export` renders, carries the Sandpiper prompt | After any user-prompted run, including after later synthetic runs                                       |
| Each request extends the previous request byte-for-byte                             | Consecutive requests without a deliberate prompt or tool change, including across idle synthetic turns  |
| The `<tools>` guidelines match those rendered on Pi 0.85.1 for the same tools       | Prompt rendering                                                                                        |
| Extension sections reach the provider                                               | For example a test extension setting `sections.mcp_servers`                                             |
| After an active-tool change, request declarations match the active tools            | Changes between user prompts, within a run, and during an idle synthetic turn                           |

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
| Later system messages        | Section patches (`null` removes a section) and `toolsAdded`/`toolsRemoved` deltas, in transcript order.                                                                                                                                |
| Reading the prompt and tools | `getCurrentSystemPrompt(messages)` and `getCurrentTools(messages)` from `@earendil-works/pi-ai` replay all system messages. `resolveTranscript()` and `collapseSystemMessages()` handle APIs without mid-conversation system messages. |
