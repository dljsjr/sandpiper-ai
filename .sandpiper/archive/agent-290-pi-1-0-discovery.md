# AGENT-290 Pi 1.0 discovery notes

- **Diátaxis mode**: Explanation / working design notes
- **Status**: Discovery complete; platform decided (stay on `pi-coding-agent` 1.0.x, see [Platform decision](#platform-decision))
- **Task**: AGENT-290 (related: AGENT-291, AGENT-292)
- **Evidence date**: 2026-10-05, Pi 0.85.1 (current pin) against Pi 1.0.3 (npm `latest`) and the v1.0.4 git tag

This page records what changed between the pinned Pi and Pi 1.0, what that means for Sandpiper, and why Sandpiper stays on the coding agent rather than moving to Pi Durable. The AGENT-290 migration design builds on the findings and constraints recorded here.

## Release state

- npm `latest` is `1.0.3`. `v1.0.4` is tagged on GitHub (2026-10-05) but not yet published; `bun install` cannot resolve it.
- `@earendil-works/pi-coding-agent` removed no public exports between 0.85.1 and 1.0.4. The 1.0 docs are much shorter than 0.85's and defer exact types to [`core/extensions/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts).
- `@earendil-works/pi-agent-core` 1.0.0 removed its experimental harness; durable sessions moved to `@earendil-works/pi-durable`. Sandpiper does not import `pi-agent-core` directly.
- The coding-agent package now depends on new packages: `chord`, `pi-codemode`, `pi-mcp`, and `pi-telemetry`.

## How the scratch build behaved

A copy of the tree with every Pi pin moved to `1.0.3` (fresh install, no lockfile):

| Check               | Result                                                                                                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsc --noEmit`      | 4 errors, all in test doubles and the integration mock provider: `pi.on` now returns an unsubscribe function, tool `execute` receives `ExtensionToolContext`, and `ToolCall.arguments` must be JSON values |
| `bun run test`      | 126 files, 1,152 tests passed, including the headless integration lane                                                                                                                                     |
| `test:distribution` | Passed, including the compiled standalone app                                                                                                                                                              |

The green suite is not evidence of a safe upgrade. None of the regressions below fail a test.

## Behavioral regressions found

### Tool guidelines disappear from the Sandpiper prompt

Pi 0.85 flattened every tool's `promptGuidelines` into `systemPromptOptions.promptGuidelines`. Pi 1.0 moves them into a per-tool `toolGuidelines` map and leaves `promptGuidelines` for extra rules only. `toolGuidanceBlock()` in `packages/core/src/system-prompt.ts` reads only `promptGuidelines`.

Rendering the prompt with `sandpiper-system-prompt --approve` on both versions shows the entire `Guidelines:` block (22 bullets covering read, edit, skill, done, background processes, Tattler, and Chorus) missing on 1.0.3. Nothing else changes except paths, version strings, and tool order.

### Extension-triggered turns run on Pi's default prompt

Pi 0.85 kept a `before_agent_start` prompt override (`_systemPromptOverride`) until the next user prompt. Pi 1.0 scopes it to one run and clears it when the run ends. Turns started by `pi.sendMessage(..., { triggerTurn: true })` do not emit `before_agent_start`, so they fall back to the transcript prompt.

The transcript prompt is Pi's own default ("You are an expert coding assistant operating inside pi..."), because a forced prompt is projected onto requests but never recorded.

A probe with a recording provider and `createSandpiperIdentityExtension()` sent one user prompt, then one triggered custom message:

| Pi     | Request 1 (user prompt)       | Request 2 (triggered turn)     |
| ------ | ----------------------------- | ------------------------------ |
| 0.85.1 | Sandpiper prompt, 6,867 chars | Sandpiper prompt, 6,867 chars  |
| 1.0.3  | Sandpiper prompt, 6,161 chars | Pi default prompt, 2,721 chars |

The 706-character difference on request 1 is the missing guidelines block.

This is upstream issue [#5581](https://github.com/earendil-works/pi/issues/5581) (filed by Doug, open). Up to 0.85 it only affected triggered turns before the first user prompt, because the override then persisted on the agent. 1.0 widens it to every idle synthetic turn. The proposed fix, PR [#8262](https://github.com/earendil-works/pi/pull/8262), is unmerged as of 2026-10-05, so Sandpiper needs a workaround until it lands.

In Sandpiper, background-process exits, Tattler receives, and Chorus room messages all start turns this way. Those are exactly the turns that need the `<system_notification_protocol>` block.

### Pi's recommended prompt mechanism has the same hole

Pi's docs recommend mutating `event.systemPromptOptions` (sections, `customPrompt`) instead of returning `systemPrompt`. A second probe set `customPrompt` and a `persona` section in `before_agent_start`, then triggered a run whose first response was a tool call:

| Request                   | Prompt the provider received                     |
| ------------------------- | ------------------------------------------------ |
| 1 (user prompt)           | Sandpiper sections                               |
| 2 (triggered run, turn 1) | Sandpiper sections, replayed from the transcript |
| 3 (triggered run, turn 2) | Pi default                                       |

Between turns, `prepareNextTurnWithContext` rebuilds from `_runSystemPromptOptions ?? _baseSystemPromptOptions`. A triggered run has no run options, so it diffs the base options against the transcript and appends a patch that reverts the extension's sections.

This also affects Pi's own MCP extension, which writes `sections.mcp_servers` from `before_agent_start`. The reverting patch is written into the transcript, so each idle synthetic turn also costs extra prompt-cache rewrites. A 2026-09-27 comment on #5581 already reports this, so there is nothing new to file.

### Workarounds verified before an upstream fix

Each candidate was tested with the same probes on Pi 1.0.3: a recording provider, one user prompt, then an idle triggered run whose first response is a tool call. The probes are not committed; the migration turns them into regression tests.

| Approach                                                                                                                                                                                                                                                                                                                          | Result                                                                                                                                                                    | Tradeoffs                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Own the outgoing system message in a `context_with_system` handler: replace the leading system message's text, keep Pi's tool declarations and later tool deltas, and strip text from later system messages                                                                                                                       | Sandpiper prompt on all 3 requests, including turn 2 of a triggered run, on stock Pi                                                                                      | Public API, and also fixes #5581's original first-turn case that 0.85 had. The session file still records Pi's default sections. A tool change rewrites the head, which matches 0.85 cache behavior. Pi applies forced-prompt overrides after this hook, so nothing may also return `systemPrompt`.                                                                                                                      |
| Hybrid: in `before_agent_start`, set `systemPromptOptions.customPrompt` to Sandpiper's whole prompt and clear the pieces Sandpiper renders itself (skills, context files, appended prompt), so the transcript records it. Add a `context_with_system` guard that resends Sandpiper's prompt when the transcript has been reverted | Model got Sandpiper's prompt on all 4 requests. `/export` shows it, except between a multi-turn idle synthetic turn and the next user prompt, where it shows Pi's default | No Pi patch, and export is accurate almost all the time. Pi still writes its reverting patch into the session file after multi-turn synthetic turns. To avoid a cache miss, the guard should resend the last correct system state verbatim rather than re-render. Pi still appends its own `cwd` section.                                                                                                                |
| Local patch to Pi's idle `triggerTurn` path (about 25 lines in `dist/core/agent-session.js`) that runs `before_agent_start` and prompt preparation, as `prompt()` does                                                                                                                                                            | Forced-prompt and sections probes both correct on all requests                                                                                                            | Fixes the root cause for every extension, including the MCP section and the transcript flapping, and makes a sections-native Sandpiper prompt viable. It has to be carried as a patch on compiled output, re-checked every Pi bump, and only applies to Sandpiper's own runtime. A proper version must mirror `prompt()`'s pre-run compaction check and cover the gap where `isIdle()` reads true before the run starts. |

#### What a hybrid guard needs

The probes showed what a `context_with_system` guard needs, and Sandpiper's existing prompt cache in `extensions/system/startup-hooks.ts` covers only part of it:

- **The latest render, not the first.** `lastKnownSystemPrompt` keeps the first prompt of the extension runtime and never updates; it is a change canary. A guard compares against Sandpiper's latest render.
- **A comparison of the `preamble` section.** Pi appends its own `cwd` section and other extensions' sections, such as `mcp_servers`, after the preamble, so the full rendered prompt never equals Sandpiper's text.
- **Removal, not re-rendering.** Rewriting the leading system message changes bytes the provider already cached. Dropping the `sections` of each system message that moves the preamble away from Sandpiper's prompt, while keeping its tool deltas, kept every request a byte-for-byte extension of the one before it, across an idle synthetic turn and the next user prompt.
- **A check on every request.** A guard that acted only on a mismatch let Pi's reverting patch back into mid-history on the next user-prompted request.

Two constraints follow from the design but were not probed:

- Older history stays stable when Sandpiper's prompt legitimately changes only if the guard recognizes Sandpiper's prompt by a stable marker, such as its `<system_prompt>` root, rather than by exact equality.
- When a brand-new session's first turn is a synthetic turn, the transcript has no Sandpiper prompt yet, so the guard has to render one from `ctx.getSystemPromptOptions()`.

Two approaches were rejected:

- A static base prompt through `--system-prompt` or `SYSTEM.md`. A custom base prompt switches off Pi's dynamic tools, rules, and docs sections, and the session-start date of a resumed session is unknown at the entry point.
- Rerouting Sandpiper's synthetic turns through `sendUserMessage`. That adds user-visible user messages and breaks Tattler's custom-message delivery tracking.

### Built-in MCP prompt section is dropped

Pi 1.0 loads `codemode`, `tool-search`, `mcp`, and `llama.cpp` as built-in extensions. The MCP extension advertises servers through `systemPromptOptions.sections.mcp_servers`. Sandpiper's prompt builder ignores `sections`, so with MCP configured the model is never told the servers exist.

Codemode guidance arrives through tool snippets and guidelines, so it is lost with the guidelines block above.

### AutoTOON breaks codemode results

Codemode is a built-in 1.0 tool. Instead of making one tool call per model turn, the model writes a JavaScript script that runs in a QuickJS WebAssembly sandbox inside the Pi process. The script calls other tools as functions (`await tools.read({ path })`, MCP tools, `models.classify()`), and only its printed output and return value reach the model. It is inactive unless enabled with `defaultTools: ["+codemode"]` or activated by MCP servers with `codemode` exposure. See Pi's `docs/codemode.md`.

`extensions/autotoon/autotoon.ts` rewrites JSON text in every non-error `tool_result`. In 1.0:

- nested calls made by codemode scripts through `ctx.executeTool()` also emit `tool_result` (with `parentToolCallId`), so scripts would receive TOON where they expect JSON
- replacing `content` without returning `structuredContent` drops the structured result; built-in `bash` now returns structured content to scripts

The fix direction is to skip nested calls and pass `structuredContent` through. Codemode is inactive by default, so this only bites when someone enables it.

### Session transcripts and `/export` misreport the prompt

With a forced prompt, the session file records Pi's default structured sections as the system message, not the text the model received. Session-history tooling (`read-session-memories`, stint) would show the wrong prompt.

`/export` regresses too. It renders `agent.state.systemPrompt`:

- **0.85:** the live override, so exports showed Sandpiper's prompt. The session file itself stored no prompt.
- **1.0:** derived from the transcript's system messages, so exports show Pi's default whenever Sandpiper forces its prompt.

A probe confirmed the regression:

| Pi     | Prompt `/export` shows    |
| ------ | ------------------------- |
| 0.85.1 | Sandpiper's, 6,867 chars  |
| 1.0.3  | Pi's default, 2,721 chars |

Sessions written by Pi 1.0 also contain `role: "system"` message entries. Treat the upgrade as one-way for any session file it touches.

### Forced prompts and tool gating

Upstream issue [#9932](https://github.com/earendil-works/pi/issues/9932) (open) reports that a forced prompt keeps advertising tools that another `before_agent_start` handler removed with `setActiveTools()`. Sandpiper's prompt builder renders its own tool list from `selectedTools`. Re-check that interaction once the prompt design is settled.

## Where Pi's prompt sections overlap Sandpiper's

[Pi 1.0 system prompt sections](pi-1-0-prompt-sections.md) describes how Pi assembles the prompt. Under the hybrid, Sandpiper's whole prompt sits in `preamble`. Setting `customPrompt` suppresses Pi's `tools`, `rules`, and `docs`, but the remaining sections still render after Sandpiper's text:

| Pi section        | Sandpiper block                | Effect under the hybrid                                                                        |
| ----------------- | ------------------------------ | ---------------------------------------------------------------------------------------------- |
| `addendum`        | `<user_appended_prompt>`       | Duplicated unless Sandpiper clears `appendSystemPrompt`                                        |
| `project_context` | `<injected_context>`           | Duplicated unless Sandpiper clears `contextFiles`                                              |
| `skills`          | `<skills>`                     | Duplicated unless Sandpiper clears `skills`                                                    |
| `cwd`             | `<cwd>` inside `<environment>` | Duplicated; Pi always renders it, though an extension section named `cwd` can replace its text |
| `mcp_servers`     | None                           | New content Sandpiper never rendered                                                           |

The `cwd` duplication is not new to Pi: its 0.85 custom-prompt path also appended the working directory, but Sandpiper's forced prompt replaced everything. Because Pi renders its sections after the preamble, `cwd` and `mcp_servers` land outside Sandpiper's `<system_prompt>` envelope. Rendering Sandpiper's blocks as Pi sections instead of one preamble would keep a single structure, and changes would travel as per-section updates.

Sandpiper's tool block also needs two inputs that are new in 1.0: per-tool `toolGuidelines` and `hiddenTools`.

## Distribution and packaging

- The generated `dist/package.json` is both the standalone CLI and a Pi package. As a CLI it needs `@earendil-works/pi-coding-agent` and `pi-ai` in `dependencies`. As a Pi package, Pi 1.0 warns when host-provided packages appear in `dependencies` (`resource-loader.ts`, `collectExtensionPackageWarnings`). Pi also recommends `"*"` peer ranges where Sandpiper pins exact versions. AGENT-290's build reassessment should separate these two artifacts.
- The compiled standalone app does not run Pi's Bun setup (`src/bun/runtime-setup.ts`). It was already missing `registerBunOAuthFlows()` and `setBedrockProviderModule()`. 1.0 adds `setEmbeddedQuickJSWasmPath()`, which is not a public export, plus a codemode worker entrypoint. Expect codemode to fail inside the compiled app.
- Pi 1.0 still resolves its assets through `PI_PACKAGE_DIR`, so Sandpiper's branding mechanism (`piConfig.name` and `configDir`) still works. Distribution still copies all of Pi's `dist/modes` and `dist/core` (about 8.6 MB) when it only needs themes, interactive assets, and export templates.
- AGENT-292: Sandpiper exports `PI_PACKAGE_DIR` to child processes, so `pi` run from a Sandpiper shell reports itself as `sandpiper` 0.0.1 and uses `.sandpiper` state. This explains the "`pi --version` prints 0.0.1" note in the AGENT-289 handoff.

## Inherited 1.0 behavior that needs a product decision

- **Fullscreen TUI by default** (`tuiMode`). Chorus's custom editor and widget, and the Tattler and diagnostics entry renderers, need live dogfooding.
- **`/bug`** uploads diagnostics, and optionally transcripts, to the Pi developers through Radius, labelled with Sandpiper's app name and version. Unexplained errors and crash notices advertise it.
- **Startup header** shows the Pi logo with Sandpiper's version. The first-run text reads "Welcome to sandpiper, the minimal coding agent."
- **Built-in codemode, tool search, MCP, and llama.cpp** load by default. Users disable them with `-builtin:<name>` in settings.
- **Install telemetry** remains on by default (`enableInstallTelemetry`), as in 0.85.

## Cross-project dependencies

| Project                                                                         | Exposure                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pi-claude-code-cli-provider` (the provider Doug currently runs Sandpiper with) | Reads `context.systemPrompt` and `context.tools`. Since Pi 0.86, providers receive a branded `TranscriptContext` with only `messages`, so both are `undefined`: Claude Code would run with no Sandpiper prompt and no tools. It also has to handle mid-conversation `role: "system"` messages. Blocking for Doug's daily driver; must migrate in lockstep. |
| `pi-yaams`                                                                      | Returns `systemPrompt: event.systemPrompt + block` from `before_agent_start`, so it inherits the triggered-turn loss. Its comments assume flattened `promptGuidelines`.                                                                                                                                                                                    |
| `reinforced-guidance` pi-extension                                              | Uses `context` (now system-message-free, which is safe) and `systemPromptOptions.contextFiles` (unchanged). Low risk.                                                                                                                                                                                                                                      |

## Pi Durable

`@earendil-works/pi-durable` (npm `1.0.3`, MIT) is a separate, experimental harness library: storage-backed conversations, tasks, documents, and extensions defined in code. Its README warns that "the API changes without notice between releases", and 1.0.3 and 1.0.4 both shipped breaking `ExecutionEnv` changes. It moved into its own package on 2026-09-18 and has about 104 commits.

It provides:

- crash-safe runs that resume from per-step checkpoints
- many concurrent conversations and forks
- task-owned subagents and background tasks
- an inbox with steer, follow-up, and exactly-once `requestId`
- typed documents with fork semantics
- system prompt sections recorded as transcript deltas
- `watch()` and `viewState()` for multiple attached clients
- pluggable storage (memory, SQLite, JSONL) and execution environments (local; SSH through `pi-env`)

It does not provide a CLI, TUI, resource loading (skills, `AGENTS.md`, prompt templates), settings files, package management, login flows, session pickers, tree navigation, print/RPC/JSON modes, HTML export, or codemode/MCP wiring. Its demo coding agent (`coding-agent/src/experimental/durable`) borrows Pi's model runtime, settings, and interactive components. Most of those components are public exports of `pi-coding-agent` 1.0, including `CustomEditor`, `AssistantMessageComponent`, `ToolExecutionComponent`, `UserMessageComponent`, `FooterComponent`, the model and session selectors, `KeybindingsManager`, and the theme functions.

Two signals matter for Sandpiper's direction:

1. **Pi is rebuilding on it.** Pi's own experimental next-generation coding agent (`pi server` / `pi client`, source-only and excluded from npm) runs each session as a Durable `Harness` in a worker process. It uses Chord facets as a new plugin format (`src/session.ts` + `src/tui.ts`, see `examples/plugins/pi-example-plugin`) and talks to the TUI over `pi-server`, `pi-client`, and `pi-protocol`. Today's `ExtensionAPI` is the stable 1.0 surface; the facet model looks like its eventual successor.
2. **Sandpiper's roadmap overlaps it.** Several in-flight designs rebuild Durable primitives by hand:
   - TAT-70: durable message log with per-agent read cursors
   - Chorus: shared rooms with multiple writers
   - Peer-supervisor sketch: full Sandpiper peers with their own identities and sessions
   - Branch-local state and context projections
   - Birdup: persistent identities (Piper, Roux, Huginn, Muninn)

## Platform decision

Decided 2026-10-05: Sandpiper stays on `pi-coding-agent` 1.0.x. There will be no Durable rebuild and no Durable spike.

Doug's long-term plan is his own durable agent substrate, with a different philosophy and framework, and Sandpiper will eventually move onto that. Durable ships no application shell (CLI, TUI, resource loading, settings, login), so building on it would mean building that shell on an experimental substrate that is itself slated for replacement. Pi Durable and Pi's experimental server/client stay useful as prior art for that substrate: task ownership, documents with fork semantics, exactly-once submissions, and prompt sections as transcript deltas.

This changes how much 1.0 adoption is worth. Because Sandpiper's medium-term platform is now the coding agent, capability adoption is no longer throwaway. The plan is still:

1. a behavior-preserving port
2. then deliberate adoption of the 1.0 features Sandpiper benefits from, such as a sections-based prompt, `outputSchema`/`structuredContent` on Sandpiper tools, and native MCP for the web-search Parallel adapter
