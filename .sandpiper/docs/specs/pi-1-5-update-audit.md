# Pi 1.3.0 to 1.5.x update audit

- **Diátaxis mode**: Explanation with reference tables
- **Task**: AGENT-320, under AGENT-319
- **Status**: Audit complete. The update is not performed. No product code changed.
- **Versions compared**: `@earendil-works/pi-coding-agent`, `pi-ai`, `pi-tui`, and `pi-mcp` at 1.3.0 (current pin), 1.4.0, 1.5.0, 1.5.1, and 1.5.2
- **Date**: 2026-11-10
- **Related**: [AGENT-290 Pi 1.0 migration spec](agent-290-pi-1-0-migration-spec.md) (the last migration record), [Sandpiper system prompt architecture](sandpiper-system-prompt.md), [Pi 1.0 system prompt sections](pi-1-0-prompt-sections.md), [Build system reference](../../../docs/dev/build-system.md#local-pi-patch)

This document tells you what an update from Pi 1.3.0 to 1.5.x involves. A statement is a verified fact unless it is marked **Inference**. Citations of the form `coding-agent 1.5.0: dist/config.js:336` name a file and line in the published npm package of that version.

## Verdict

The update is small. One upstream change stops Sandpiper from starting, and its fix is mechanical. With that fix and the version pins updated, the full test suite passes on 1.5.0 and on 1.5.2.

**Recommended target: 1.5.2.** Reasons:

- The Codex model you want arrives in 1.5.0. 1.5.1 and 1.5.2 add no Codex models, but 1.5.1 fixes three defects on the path that Codex use takes: OAuth logins that fail with `invalid_grant` after Pi stops during a token refresh (#11692), Codex retry listeners that build up (#11708), and dropped provider streams that do not retry (#11879).
- 1.5.2 costs the same work as 1.5.0. The patch applies to both without change, the type errors are identical, and the trial passed on both.
- 1.5.1 changes some defaults (see [Behavior changes to accept](#behavior-changes-to-accept)). None of them broke a test. If you do not want them, 1.5.0 is the fallback.
- 1.5.2 was published on the day of this audit. That is the only argument for 1.5.1 over 1.5.2. 1.5.2 changes only the missing-folder prompt for sessions and one Anthropic OAuth header.

What the update requires, in order:

| #   | Step                                                                                                                                                                                               | Size                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 1   | Set the four pins to the target version in every manifest, and rename the `patchedDependencies` key. See [Pins](#pins).                                                                            | Small: 5 or 6 manifests       |
| 2   | Carry the local patch with the documented `bun patch` procedure. All four hunks apply. Decide whether the patch copies Pi's new one-line tools trailer. See [The patch](#the-patch).               | Small: about 15 minutes       |
| 3   | Replace `import { Type } from '@earendil-works/pi-ai'` with `import { Type } from 'typebox'` in 12 source files, and declare `typebox` where it is imported. Without this, the CLI does not start. | Small to medium: about 1 hour |
| 4   | Update the version literals in two tests, and the stale preamble marker in `extensions/system/prompt-ownership.test.ts`. The marker fails silently: the test still passes but stops checking.      | Small                         |
| 5   | Update the documents that name the version or the patch file.                                                                                                                                      | Small                         |
| 6   | Run `bun check` and `bun run test`. Then check by hand what the suite cannot: the interactive TUI, a ChatGPT login, and one request to `openai-codex/gpt-6.1-terra`.                               | Small                         |
| 7   | Check the extensions that live outside this repository against the target version. This audit did not. See [What was not checked](#what-was-not-checked).                                          | Unknown                       |

Optional, and separate from the update: the proposal to replace Sandpiper's update check with Pi's own works on 1.5.x with one more patch hunk. It has two side effects to decide on first. See [Native version check](#native-version-check).

## Required changes

### 1. `pi-ai` no longer exports TypeBox's `Type`

`pi-ai` 1.3.0 re-exports TypeBox: `dist/index.d.ts:1-2` has `export type { Static, TSchema } from "typebox"` and `export { Type } from "typebox"`. `pi-ai` 1.5.0, 1.5.1, and 1.5.2 have neither line, and `typebox` is gone from the `pi-ai` dependencies. The 1.5.0 changelog says:

> Extensions keep importing `Type`, `Static` and `TSchema` from `@earendil-works/pi-ai`: Pi maps that import to pi-ai's compat entry plus the TypeBox it bundles, now that pi-ai itself no longer re-exports TypeBox

That mapping lives in Pi's extension loader (`coding-agent 1.5.0: dist/core/extensions/loader.js:56-72`). It covers extensions that Pi loads from files through jiti. It does not cover Sandpiper's built-in extensions: the build bundles them and marks `@earendil-works/*` external (`package.json:43`), so their imports resolve to the real `pi-ai` module.

Effect, measured in the trial:

- Type check: 14 `TS2305` errors, `Module '"@earendil-works/pi-ai"' has no exported member 'Type'`, and one `TS2322` error that follows from them.
- Runtime: `sandpiper --version` exits with `SyntaxError: Export named 'Type' not found in module '.../node_modules/@earendil-works/pi-ai/dist/index.js'`.

Files that import `Type` from `pi-ai`:

| File                                                     | Line |
| -------------------------------------------------------- | ---- |
| `extensions/chorus.ts`                                   | 5    |
| `extensions/system/background-process-tools.ts`          | 1    |
| `extensions/system/prompt-recording-harness.ts`          | 13   |
| `extensions/system/skill-loading-tool.ts`                | 6    |
| `extensions/system/turn-control-tool.ts`                 | 1    |
| `extensions/tattler/index.ts`                            | 8    |
| `extensions/tattler/tattler-receive.ts`                  | 1    |
| `extensions/web-fetch/src/index.ts`                      | 6    |
| `extensions/web-search/src/index.ts`                     | 7    |
| `devtools/integration/probe-tool.ts`                     | 8    |
| `extensions/system/prompt-ownership.test.ts`             | 4    |
| `extensions/tattler/tattler-pending-cue.session.test.ts` | 10   |

`extensions/shell-relay/src/tools/inspect-pane.ts:1` and `start-relay.ts:1` have the same import. They matter only if Shell Relay still exists at update time.

The fix that Pi documents is `import { Type } from "typebox"` (`coding-agent 1.5.0: docs/extensions.md:162`). In the trial, changing only the import source in these 14 files cleared all 15 type errors, and the suite then passed. `StringEnum` is still exported by `pi-ai` (`pi-ai 1.5.0: dist/utils/string-enum.d.ts`); `extensions/tattler/index.ts:103` uses it and type-checks unchanged.

Two things follow from the fix:

- `typebox` becomes a direct import. It resolves today only because Bun hoists Pi's copy (`typebox@1.3.27`, `bun.lock:708`). `bun run check:knip` reports it as an unlisted dependency in each file. Knip is not part of `bun check`.
- **Inference**: declare `typebox` at exactly `1.3.27`, the version `pi-coding-agent` 1.5.2 depends on, in `extensions/system`, `extensions/web-fetch`, `extensions/web-search`, and the root package (for `extensions/chorus.ts`, `extensions/tattler/`, and `devtools/`). In the root package it must be a development dependency, because `devtools/rootProductMetadata.test.ts:46-52` pins the runtime `dependencies` to five entries. The build then bundles TypeBox into `dist/`, as it did in the trial, where the packed-install test passed.

### 2. Version pins and the patch file name

See [Pins](#pins). Two tests fail until their literals change:

- `devtools/rootProductMetadata.test.ts:47-50` and `:58`
- `devtools/packedCli.test.ts:164` and `:204`

### 3. A test marker that goes stale without failing

`extensions/system/prompt-ownership.test.ts:13` defines `PI_DEFAULT_PREAMBLE = 'operating inside pi, a coding agent harness'`. Line 96 asserts that no request contains it. That is the invariant "No request contains Pi's default preamble text" from the migration spec.

Pi 1.5.0 rewrote its default preamble (`coding-agent 1.5.0: dist/core/system-prompt.js:83`):

- 1.3.0: `You are an expert coding assistant operating inside pi, a coding agent harness. You help users by reading files, executing commands, editing code, and writing new files.`
- 1.5.0: `You are a coding assistant running inside pi, a coding agent harness. Help users inspect files, run commands, and modify code.`

The marker no longer occurs in any Pi prompt, so the assertion cannot fail. The test passed in the trial for that reason. Change the marker to text that 1.5.x still renders, for example `inside pi, a coding agent harness`.

### 4. Documents

See group D in [Pins](#pins). `pi-1-0-prompt-sections.md` needs no content change: it quotes none of the reworded text. Its status line still names Pi 1.0.3 and the v1.0.4 tag.

### Behavior changes to accept

These need no code change. They change what users or the model see.

| Version | Change                                                                                                                                                                                                                                  | Effect on Sandpiper                                                                                                                                                                                                                               |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.5.0   | "Tightened system prompt"                                                                                                                                                                                                               | The rendered Sandpiper prompt changes in two places only: see [System prompt sections](#system-prompt-sections).                                                                                                                                  |
| 1.5.0   | Breaking: "Tool argument validation runs on `@earendil-works/pi-schema`. TypeBox features outside JSON Schema (`Type.Refine()`, `Type.BigInt()`, `Type.Undefined()`, codecs, `Format.Set()` formats) no longer apply to tool arguments" | Sandpiper's tool schemas use only `Object`, `String`, `Optional`, `Union`, `Literal`, `Integer`, `Number`, `Boolean`, and `Array`. None of the affected features is used. Validation errors the model sees have a new wording.                    |
| 1.5.0   | "Changed the default OpenAI model from `gpt-5.5` to `gpt-6.1-sol`"                                                                                                                                                                      | Applies when no model is selected.                                                                                                                                                                                                                |
| 1.4.0   | Provider requests carry `User-Agent: pi/<version> (<platform>; <runtime>; <arch>)`. The version is Pi's `VERSION` constant (`coding-agent 1.5.0: dist/core/client-identity.js:11`, `dist/core/sdk.js:205`).                             | Under Sandpiper, `VERSION` is Sandpiper's package version, so every built-in provider API, Codex included, receives `pi/0.0.1`. 1.3.0 sent no version to Codex: `pi (<os> <release>; <arch>)`. See [Native version check](#native-version-check). |
| 1.5.0   | A saved "Do not trust" decision now wins for projects without trust-requiring resources (#10947)                                                                                                                                        | `resolveProjectTrust()` in `packages/cli/system_prompt_diagnostic.ts:50-54` copies the 1.3.0 rule. For such a project the diagnostic now reports a trusted prompt while the runtime treats the project as untrusted. Small drift.                 |
| 1.4.0   | "`generateSummary()` and `generateSummaryWithUsage()` now ignore their `reserveTokens` parameter. Summary requests use the model's output limit instead."                                                                               | Sandpiper calls neither. The compaction integration tests pass.                                                                                                                                                                                   |
| 1.4.0   | "Extensions' `before_provider_headers` handlers no longer see the OpenRouter, NVIDIA NIM, and OpenCode attribution headers"                                                                                                             | Sandpiper has no such handler.                                                                                                                                                                                                                    |
| 1.4.0   | "Fixed the `openai-codex` provider offering `gpt-5.5` and `gpt-5.3-codex-spark`, which always fail for ChatGPT accounts"                                                                                                                | Those two model ids disappear.                                                                                                                                                                                                                    |
| 1.5.1   | "`cacheWarming` now defaults to `"idle"` instead of `"streaming"`: pi also keeps eligible prompt caches warm for up to 30 minutes between agent runs, but only when a refresh is expected to pay for itself"                            | Idle sessions can send cache-refresh requests. Set `"cacheWarming": "streaming"` in global settings for the old behavior.                                                                                                                         |
| 1.5.1   | "Anthropic sessions now use message threads ... On by default for the `anthropic` provider on `api.anthropic.com`"                                                                                                                      | Applies to the built-in `anthropic` provider only. **Inference**: custom providers, such as the Claude Code CLI provider, are not affected.                                                                                                       |
| 1.5.1   | "The default model for the `anthropic` provider is now Claude Opus 5.5", and new defaults for 18 other providers                                                                                                                        | Applies when no model is selected.                                                                                                                                                                                                                |
| 1.5.1   | Breaking: "OpenAI-compatible models no longer send `"tools": []` when all tools are disabled in a session that has used tools"                                                                                                          | Not exercised by Sandpiper's tests.                                                                                                                                                                                                               |
| 1.5.1   | Breaking: "Custom `GrepOperations.readFile` callbacks are no longer called for context lines."                                                                                                                                          | Sandpiper defines no `GrepOperations`.                                                                                                                                                                                                            |
| 1.5.1   | "Fixed Markdown displaying HTML comments (`<!-- ... -->`) as visible text"                                                                                                                                                              | Display only.                                                                                                                                                                                                                                     |
| 1.5.2   | "When a session's working directory no longer exists ... interactive mode now offers `Continue`, `Fork`, or `Cancel` instead of only continuing."                                                                                       | Display only.                                                                                                                                                                                                                                     |

## What changed in Pi

### Changelogs

Only `pi-coding-agent` and `pi-mcp` ship a `CHANGELOG.md`. The `pi-ai` and `pi-tui` packages ship none. **Inference**: the `pi-coding-agent` changelog is the record for all of them, because it lists provider and terminal changes.

The entries that matter to Sandpiper are quoted in [Required changes](#required-changes), [Behavior changes to accept](#behavior-changes-to-accept), [Codex models](#codex-models), and [Overlap candidates](#overlap-candidates). The rest, by version:

| Version            | Contribution                                                                                                                                                                                                                                                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.4.0 (2026-10-21) | No section marked breaking. 25 fixes. Compaction summaries without a fixed output cap. Codemode waits for a free worker. `models.json` reference. Fixes to concurrent extension dialogs (#11166), resumed sessions leaving extension tools inactive (#11062), and the terminal staying in mouse-tracking mode after an abnormal exit (#11170). |
| 1.5.0 (2026-11-02) | One breaking change (tool validation). GPT-6.1 Terra. `PI_SELF_UPDATE_COMMAND`. Extension update changelogs. `keyText()` and `keyHint()` on render contexts. `pi.exec()` output limit. Faster streaming. Removed the `sandbox/` extension example. 74 fixes.                                                                                   |
| 1.5.1 (2026-11-09) | Two breaking changes (grep `readFile`, empty `tools`). `pi auth login` and `pi auth logout`. Idle cache warming. Anthropic message threads. Claude Fable 5.2. New default models. 72 fixes, including RPC shutdown (#11599), OAuth refresh on exit (#11692), and extensions loaded through symlinked paths (#8112).                            |
| 1.5.2 (2026-11-10) | Fork a session whose folder is gone. "Fixed Anthropic OAuth requests reporting an outdated Claude Code version".                                                                                                                                                                                                                               |

`pi-mcp`: 1.4.0 and 1.5.2 have empty entries. 1.5.0 restricts OAuth metadata URLs to `http:` and `https:`. 1.5.1 adds `PipeTransport`, the OAuth sign-in helpers moved from the coding agent, and naming and output-limit helpers, and fixes five Streamable HTTP and stdio defects. It also renames the shipped `LICENSES/` directory to `THIRD_PARTY_NOTICES/`.

### Package manifests

`engines` is `node >=22.19.0` in every package and version. `bin` is unchanged: `pi` in `pi-coding-agent`, `pi-ai` in `pi-ai`. No package gains install scripts that run for consumers.

| Package           | 1.4.0                             | 1.5.0                                                             | 1.5.1                                                      | 1.5.2 |
| ----------------- | --------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------- | ----- |
| `pi-coding-agent` | Sibling pins only                 | `minimatch` 10.2.6 to 11.0.3, `undici` 8.10.2 to 8.12.3           | `grok-mermaid` 0.2.3 removed, `lovely-mermaid` 0.3.3 added | None  |
| `pi-ai`           | Sibling pins only                 | `@earendil-works/pi-schema` 1.5.0 added, `typebox` 1.3.27 removed | Exports `./lazy-bedrock-provider` and `./lazy-oauth` added | None  |
| `pi-tui`          | `marked-cjk-friendly` 0.1.2 added | None                                                              | None                                                       | None  |
| `pi-mcp`          | None                              | None                                                              | `files`: `LICENSES` becomes `THIRD_PARTY_NOTICES`          | None  |

`pi-coding-agent` still depends on `typebox` 1.3.27 in 1.5.2. Its exports (`.` and `./rpc-entry`) do not change. `@earendil-works/pi-schema` is a new transitive package (0.62 MB unpacked at 1.5.0). The packed Sandpiper tarball in the trial contained it.

Unpacked size and file count, measured from the extracted tarballs:

| Package           | 1.3.0           | 1.4.0           | 1.5.0           | 1.5.1           | 1.5.2           |
| ----------------- | --------------- | --------------- | --------------- | --------------- | --------------- |
| `pi-coding-agent` | 23.25 MB (1276) | 23.42 MB (1279) | 24.04 MB (1286) | 24.39 MB (1324) | 24.40 MB (1324) |
| `pi-ai`           | 4.17 MB (837)   | 4.30 MB (845)   | 4.37 MB (861)   | 4.51 MB (886)   | 4.51 MB (886)   |
| `pi-tui`          | 2.40 MB (204)   | 2.41 MB (204)   | 2.45 MB (204)   | 2.46 MB (204)   | 2.46 MB (204)   |
| `pi-mcp`          | 0.39 MB (76)    | 0.39 MB (76)    | 0.40 MB (76)    | 0.60 MB (116)   | 0.60 MB (116)   |

## The patch

`patches/@earendil-works%2Fpi-coding-agent@1.3.0.patch` has four hunks. Each was tested with `patch -p1` against a copy of the extracted files.

| Hunk | File and function                                           | 1.4.0          | 1.5.0, 1.5.1, 1.5.2             | Code under the hunk  |
| ---- | ----------------------------------------------------------- | -------------- | ------------------------------- | -------------------- |
| 1    | `dist/config.js`, `getThemesDir()`                          | Applies at 330 | Applies at 349, offset 19 lines | Unchanged            |
| 2    | `dist/config.js`, `getExportTemplateDir()`                  | Applies at 347 | Applies at 371, offset 19 lines | Unchanged            |
| 3    | `dist/config.js`, `getInteractiveAssetsDir()`               | Applies at 381 | Applies at 405, offset 19 lines | Unchanged            |
| 4    | `dist/core/system-prompt.js`, `buildSystemPromptSections()` | Applies at 77  | Applies at 77, no offset        | Unchanged; see below |

The offset comes from two functions for `PI_SELF_UPDATE_COMMAND` that 1.5.0 adds earlier in `dist/config.js` (lines 267-286). `dist/config.js` and `dist/core/system-prompt.js` are byte-identical in 1.5.0, 1.5.1, and 1.5.2, and identical to 1.3.0 in 1.4.0. In the trial, `bun patch --commit` produced a 65-line patch for 1.5.0 with no `.bun-tag` lines; the same patch applied to 1.5.2 without offsets.

Hunk 4 needs one decision. It copies Pi's rendering of the `tools` section into the custom-prompt branch, including the closing sentence as it was in 1.3.0:

- Patch, and Pi 1.3.0: `In addition to the tools above, you may have access to other custom tools depending on the project.`
- Pi 1.5.0 (`dist/core/system-prompt.js:86`): `Additional tools may be available.`

Carried as is, the patch keeps the old sentence. Sandpiper's prompt then differs from stock Pi 1.5.x by that sentence. Copy the new sentence into the patch to follow Pi. No Sandpiper test pins either sentence.

Upstream added no supported replacement for either part of the patch:

- Asset directories: `PI_CODING_AGENT_PACKAGE` occurs in no file of `pi-coding-agent` 1.5.2. `getThemesDir()`, `getExportTemplateDir()`, and `getInteractiveAssetsDir()` still resolve only from `getPackageDir()`, which reads `PI_PACKAGE_DIR` (`coding-agent 1.5.0: dist/config.js:334-336`).
- Tools and rules under a custom prompt: the `if (customPrompt)` branch still sets only `preamble` (`coding-agent 1.5.0: dist/core/system-prompt.js:78-80`). `BuildSystemPromptOptions` has no new field.

One procedure note for `docs/dev/build-system.md`: reapplying the old patch with plain `patch -p1` leaves a `dist/config.js.orig` file when a hunk applies with an offset, and `bun patch --commit` then records that file in the new patch (625 lines instead of 65). Use `patch --no-backup-if-mismatch`, or delete `*.orig` before the commit step. Bun also keeps the old key in `patchedDependencies` and the old patch file; both must be removed by hand, as the procedure says.

## API and behavior

"Unchanged" means the declaration or code is the same in 1.3.0 and 1.5.0. The last column covers 1.5.1 and 1.5.2. Type declarations are in `coding-agent 1.5.0: dist/core/extensions/types.d.ts` unless another file is named. That file differs from 1.3.0 only by additions: `KeybindingHints`, the `blocked` option of `ui.custom()`, `messageId` and `timestamp` on `MessageRenderOptions`, and, in 1.5.1, options for `registerMarkdownTransformer()`. Shell Relay and the code that exists only for it were not audited.

### Extension events

| Event                     | Line | Sandpiper use                                                                                                                                                     | 1.5.0     | 1.5.2     |
| ------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------- |
| `resources_discover`      | 1211 | `packages/cli/sandpiper_resources.ts:24`                                                                                                                          | Unchanged | Unchanged |
| `session_start`           | 1212 | `extensions/system/startup-hooks.ts:88`, `:207`, `diagnostics-hooks.ts:60`, `startup-header.ts:74`, `migration-controls.ts:38`, `extensions/tattler/index.ts:207` | Unchanged | Unchanged |
| `session_shutdown`        | 1219 | `extensions/system/startup-hooks.ts:95`, `background-process-hooks.ts:5`, `extensions/chorus.ts:508`, `extensions/tattler/index.ts:332`                           | Unchanged | Unchanged |
| `context_with_system`     | 1224 | `extensions/system/startup-hooks.ts:157`                                                                                                                          | Unchanged | Unchanged |
| `before_provider_request` | 1226 | `packages/cli/system_prompt_diagnostic.test.ts`                                                                                                                   | Unchanged | Unchanged |
| `before_agent_start`      | 1230 | `extensions/system/startup-hooks.ts:174`, `extensions/tattler/tattler-inbox-hooks.ts:20`                                                                          | Unchanged | Unchanged |
| `agent_start`             | 1231 | `extensions/tattler/tattler-pending-cue.ts:16`                                                                                                                    | Unchanged | Unchanged |
| `agent_end`               | 1232 | `extensions/tattler/tattler-inbox-hooks.ts:46`, `extensions/system/prompt-recording-harness.ts:93`                                                                | Unchanged | Unchanged |
| `agent_settled`           | 1234 | `extensions/tattler/tattler-pending-cue.ts:19`, `tattler-receive.ts:52`                                                                                           | Unchanged | Unchanged |
| `turn_end`                | 1238 | `extensions/system/context-management.ts:19`                                                                                                                      | Unchanged | Unchanged |
| `message_end`             | 1241 | `extensions/tattler/tattler-inbox-hooks.ts:31`                                                                                                                    | Unchanged | Unchanged |
| `tool_result`             | 1248 | `extensions/autotoon/autotoon.ts:12`; `parentToolCallId` (1009) and `structuredContent` (1016, 1136) remain                                                       | Unchanged | Unchanged |

No event name was added or removed between 1.3.0 and 1.5.0. `before_agent_start` still passes `systemPromptOptions: NormalizedBuildSystemPromptOptions` (744).

### `ExtensionAPI` methods

| Member                    | Line | Sandpiper use (first production file)                                                                                                       | 1.5.0                                                               | 1.5.2     |
| ------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------- |
| `on`                      | 1210 | 14 production files                                                                                                                         | Unchanged                                                           | Unchanged |
| `registerTool`            | 1252 | 9 production files, for example `extensions/system/skill-loading-tool.ts`                                                                   | Unchanged                                                           | Unchanged |
| `registerCommand`         | 1254 | `extensions/chorus.ts`, `extensions/system/migration-controls.ts`, `startup-hooks.ts`                                                       | Unchanged                                                           | Unchanged |
| `registerFlag`            | 1261 | `extensions/system/migration-controls.ts`, `startup-hooks.ts`, `extensions/tattler/index.ts`                                                | Unchanged                                                           | Unchanged |
| `getFlag`                 | 1271 | Same three files                                                                                                                            | Unchanged                                                           | Unchanged |
| `registerMessageRenderer` | 1273 | `extensions/chorus/chorus-ui.ts`, `extensions/tattler/tattler-inbox-renderer.ts`                                                            | Unchanged                                                           | Unchanged |
| `registerEntryRenderer`   | 1277 | `extensions/system/diagnostics-hooks.ts`, `extensions/tattler/tattler-inbox-renderer.ts`                                                    | Unchanged                                                           | Unchanged |
| `sendMessage`             | 1281 | `extensions/chorus/chorus-ui.ts`, `extensions/tattler/index.ts`, system notifications                                                       | Unchanged                                                           | Unchanged |
| `sendUserMessage`         | 1290 | `extensions/chorus.ts`                                                                                                                      | Unchanged                                                           | Unchanged |
| `appendEntry`             | 1295 | `extensions/chorus/chorus-ui.ts`, `extensions/system/diagnostics-hooks.ts`, `startup-hooks.ts`                                              | Unchanged                                                           | Unchanged |
| `getActiveTools`          | 1305 | Tests and `devtools/integration/fixtures/native-mcp/transport-probe.ts`                                                                     | Unchanged                                                           | Unchanged |
| `getAllTools`             | 1307 | `devtools/integration/fixtures/native-mcp/transport-probe.ts`                                                                               | Unchanged                                                           | Unchanged |
| `setActiveTools`          | 1314 | `extensions/system/prompt-ownership.test.ts`                                                                                                | Unchanged; 1.5.0 keeps the order of tools that stay active (#11495) | Unchanged |
| `getCommands`             | 1316 | `extensions/system/skill-loading-tool.test.ts`                                                                                              | Unchanged                                                           | Unchanged |
| `registerProvider`        | 1381 | `packages/cli/system_prompt_diagnostic.ts:81`, `extensions/system/prompt-recording-harness.ts:106`, `devtools/integration/mock-provider.ts` | Unchanged                                                           | Unchanged |
| `events` (`on`, `emit`)   | 1429 | `extensions/chorus.ts`, `extensions/system/startup-hooks.ts`, `extensions/tattler/index.ts`; `createEventBus` in four tests                 | Unchanged; `dist/core/event-bus.js` identical                       | Unchanged |

### Context members

| Member                                                                                         | Line                             | Sandpiper use                                                                                    | 1.5.0                                          | 1.5.2                                                                               |
| ---------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| `ctx.ui`, `ctx.mode`, `ctx.cwd`, `ctx.sessionManager`, `ctx.model`                             | 234, 236, 240, 242, 246          | `extensions/system/`, `extensions/tattler/`, `extensions/chorus/`                                | Unchanged                                      | Unchanged                                                                           |
| `ctx.shutdown()`                                                                               | 265                              | `extensions/system/startup-hooks.ts:161`                                                         | Unchanged                                      | Declaration unchanged. 1.5.1 fixes RPC mode ignoring it while idle (#11599).        |
| `ctx.getContextUsage()`, `ctx.getSystemPrompt()`                                               | 267, 271                         | `extensions/system/context-management.ts`, `startup-hooks.ts`                                    | Unchanged                                      | Unchanged                                                                           |
| `ctx.getSystemPromptOptions()`, `ctx.reload()` (command context)                               | 307, 341                         | `extensions/system/startup-hooks.ts`, `migration-controls.ts`                                    | Unchanged                                      | Unchanged. 1.5.1 makes reload ask the caller to wait while a response runs (#9222). |
| `ctx.ui.input`, `notify`, `setStatus`, `setWidget`, `setHeader`, `setEditorComponent`, `theme` | 89, 91, 95, 112, 126, 194        | `extensions/chorus/chorus-ui.ts`, `extensions/system/startup-header.ts`, `migration-controls.ts` | Unchanged                                      | Unchanged                                                                           |
| `ctx.ui.custom()`                                                                              | 132                              | `extensions/chorus/chorus-ui.ts`                                                                 | Changed by addition: optional `blocked` option | 1.5.1 makes overlays honor `blocked`                                                |
| `sessionManager.getEntries()`, `getSessionFile()`, `getSessionId()`                            | `dist/core/session-manager.d.ts` | `extensions/system/startup-hooks.ts`, `extensions/tattler/index.ts`                              | Unchanged. `CURRENT_SESSION_VERSION` stays 3.  | Unchanged                                                                           |

### SDK entry points

All of these type-check against 1.5.0 and 1.5.2 with no change to Sandpiper code.

| Import                                                                                                                                                                                                                                        | Declared in (`coding-agent 1.5.0`)                                                                                          | Sandpiper use                                                                                                                                             | Status                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `main(args, { extensionFactories })`                                                                                                                                                                                                          | `dist/main.d.ts:12-15`                                                                                                      | `packages/cli/sandpiper_standalone.ts:62-64`                                                                                                              | Unchanged. 1.5.1 adds the `auth login` and `auth logout` subcommands inside `main`.                                 |
| `InlineExtension`, `ExtensionFactory`                                                                                                                                                                                                         | `dist/core/extensions/types.d.ts:1541-1548`                                                                                 | `packages/cli/sandpiper_resources.ts:1`, `:18`                                                                                                            | Unchanged                                                                                                           |
| `createAgentSessionRuntime`, `CreateAgentSessionRuntimeFactory`, `createAgentSessionServices`, `createAgentSessionFromServices`                                                                                                               | `dist/core/agent-session-runtime.d.ts`, `agent-session-services.d.ts`                                                       | `packages/cli/system_prompt_diagnostic.ts:157-208`                                                                                                        | Declarations unchanged in 1.5.0. 1.5.2 adds five lines to `agent-session-runtime.d.ts` for the missing-folder fork. |
| `ModelRuntime.create()`, `SessionManager.inMemory()`, `SettingsManager.create()`, `parseArgs()`                                                                                                                                               | `dist/core/model-runtime.d.ts`, `session-manager.d.ts`, `settings-manager.d.ts`, `dist/cli/args.d.ts`                       | `packages/cli/system_prompt_diagnostic.ts:118-139`                                                                                                        | Used signatures unchanged                                                                                           |
| `ProjectTrustStore`, `hasTrustRequiringProjectResources`                                                                                                                                                                                      | `dist/index.d.ts`                                                                                                           | `packages/cli/system_prompt_diagnostic.ts:50-54`                                                                                                          | Exports unchanged. Pi's own rule changed; see [Behavior changes to accept](#behavior-changes-to-accept).            |
| `getAgentDir()`                                                                                                                                                                                                                               | `dist/config.d.ts:116`                                                                                                      | `extensions/system/startup-hooks.ts`, `skill-loading-tool.ts`, `extensions/web-search/src/config-resolver.ts`, `packages/cli/system_prompt_diagnostic.ts` | Unchanged                                                                                                           |
| `createAgentSession`, `DefaultResourceLoader`, `AgentSession`                                                                                                                                                                                 | `dist/index.d.ts`                                                                                                           | `extensions/system/prompt-recording-harness.ts`, one Tattler test                                                                                         | Used signatures unchanged                                                                                           |
| `keyHint`, `keyText`, `rawKeyHint`, `VERSION`, `AppKeybinding`, `parseFrontmatter`, `initTheme`, `getMarkdownTheme`, `CustomEditor`, `DynamicBorder`, `KeybindingsManager`, `Theme`                                                           | `dist/index.d.ts`                                                                                                           | `extensions/system/startup-header.ts`, `skill-loading-tool.ts`, `extensions/web-fetch/src/tool-rendering.ts`, `extensions/chorus/chorus-ui.ts`            | Unchanged. The `app.*` keybinding ids and the key hints in Pi's own header are the same in 1.3.0 and 1.5.2.         |
| `pi-ai`: `getCurrentSystemPrompt`, `getCurrentTools`, `createAssistantMessageEventStream`, `InMemoryCredentialStore`, `StringEnum`, and the types `Api`, `Model`, `Message`, `Context`, `TranscriptContext`, `AssistantMessage`, `JsonObject` | `pi-ai 1.5.0: dist/utils/transcript.d.ts:26`, `:34`, `dist/utils/event-stream.d.ts:29`, `dist/auth/credential-store.d.ts:7` | `packages/cli/system_prompt_diagnostic.ts`, `extensions/system/`, `devtools/integration/mock-provider.ts`                                                 | Unchanged for these uses. `Tool<TParameters>` now constrains to `object` instead of TypeBox's `TSchema`.            |
| `pi-ai`: `Type`                                                                                                                                                                                                                               | Removed                                                                                                                     | 12 files                                                                                                                                                  | **Removed.** See [Required changes](#required-changes).                                                             |

### Environment and configuration

| Behavior                                                                                                      | Location (`coding-agent 1.5.0`)   | Sandpiper dependency                                                                                                                                       | 1.5.0                     | 1.5.2                                |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------ |
| `PI_PACKAGE_DIR` selects the product package                                                                  | `dist/config.js:334-336`          | `packages/cli/standalone_bootstrap.ts:55`                                                                                                                  | Unchanged                 | Unchanged                            |
| `PI_CODING_AGENT_PACKAGE` selects Pi's asset package                                                          | Only through the local patch      | `packages/cli/standalone_bootstrap.ts:53`, `packages/cli/pi_asset_paths.test.ts`                                                                           | Patch applies             | Patch applies                        |
| `piConfig.name` and `piConfig.configDir` give `APP_NAME`, `CONFIG_DIR_NAME`, and `SANDPIPER_CODING_AGENT_DIR` | `dist/config.js:488-496`, `:511`  | Root `package.json` `piConfig`, `packages/cli/standalone_bootstrap.ts:62-77`                                                                               | Unchanged                 | Unchanged                            |
| `PI_SKIP_VERSION_CHECK` disables Pi's version check                                                           | `dist/utils/version-check.js:66`  | `packages/cli/standalone_bootstrap.ts:56`                                                                                                                  | Unchanged; file identical | Unchanged; file identical            |
| `PI_TELEMETRY` overrides install telemetry                                                                    | `dist/core/telemetry.js:6`        | `packages/cli/standalone_bootstrap.ts:57`                                                                                                                  | Unchanged; file identical | Unchanged; file identical            |
| `--offline` or a truthy `PI_OFFLINE` sets `PI_OFFLINE=1` and `PI_SKIP_VERSION_CHECK=1`                        | `dist/main.js:455-458`            | `packages/core/src/system-diagnostics.ts:69` reads `PI_OFFLINE !== '1'`; `packages/cli/sandpiper_system_prompt.ts:79` sets it                              | Unchanged                 | Unchanged, at `dist/main.js:494-497` |
| Bash-tool commands get `PI_SESSION_ID`, `PI_SESSION_FILE`, `PI_PROVIDER`, `PI_MODEL`, `PI_REASONING_LEVEL`    | `dist/core/tools/bash.js:136-153` | The `rules` section tells the model to inspect `PI_*` variables; Sandpiper sets `SANDPIPER_SESSION_ID` itself in `packages/core/src/session-continuity.ts` | Unchanged; file identical | Unchanged, at `:161-177`             |
| New: `PI_SELF_UPDATE_COMMAND`                                                                                 | `dist/config.js:267-275`          | `mirrorPiSandpiperEnvironment()` would also accept `SANDPIPER_SELF_UPDATE_COMMAND`. **Inference**, not run.                                                | Added                     | Present                              |

### Native version check

The proposal: delete Sandpiper's own update check and banner, stop setting `PI_SKIP_VERSION_CHECK=1`, and let Pi's native check run, with one more hunk in the local patch so that the check compares the Pi version instead of Sandpiper's package version.

**It works on 1.5.0, 1.5.1, and 1.5.2**, in the sense that the check then compares the right version and shows Pi's banner. This was established by reading the code. The hunk was applied to copies of the three files; it was not run. Two side effects need a decision: the banner tells the user to run `sandpiper update`, which does not update Sandpiper, and the check runs in interactive mode only.

**1. The native check is the same as in 1.3.0.**

| Part                                                                                                                                                               | 1.5.0                                                  | 1.5.1 and 1.5.2                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------------- |
| `VERSION = pkg.version \|\| "0.0.0"`, from the package at `PI_PACKAGE_DIR`                                                                                         | `dist/config.js:493`                                   | Same line                                                        |
| `this.version = VERSION`                                                                                                                                           | `dist/modes/interactive/interactive-mode.js:376`       | Line 389                                                         |
| `checkForNewPiVersion(this.version)`                                                                                                                               | `dist/modes/interactive/interactive-mode.js:859`       | Line 872                                                         |
| Endpoint `https://pi.dev/api/latest-version`                                                                                                                       | `dist/utils/version-check.js:4`                        | Same. The file is byte-identical to 1.3.0 in all three versions. |
| The version goes out in the `User-Agent`                                                                                                                           | `dist/utils/version-check.js:41`                       | Same                                                             |
| `PI_OFFLINE` returns nothing                                                                                                                                       | `dist/utils/version-check.js:37`                       | Same                                                             |
| `PI_SKIP_VERSION_CHECK` returns nothing                                                                                                                            | `dist/utils/version-check.js:66`                       | Same                                                             |
| Banner: "Update Available", "New version X is available. Run `<APP_NAME> update`", an optional release note from pi.dev, and "Changelog: https://pi.dev/changelog" | `dist/modes/interactive/interactive-mode.js:3874-3890` | Lines 3938 and 3939                                              |

On 2026-11-10 the endpoint answered `{"ok":true,"version":"1.5.2","packageName":"@earendil-works/pi-coding-agent"}`.

**2. The smallest hunk.** Against `pi-coding-agent` 1.5.0:

```diff
--- a/dist/modes/interactive/interactive-mode.js
+++ b/dist/modes/interactive/interactive-mode.js
@@ -856,7 +856,8 @@
                 .finally(() => clearTimeout(timeout));
         }
         // Start version check asynchronously
-        checkForNewPiVersion(this.version).then((newRelease) => {
+        // Sandpiper local patch: compare the Pi version; this.version is the product package version.
+        checkForNewPiVersion(process.env.PI_CODING_AGENT_VERSION || this.version).then((newRelease) => {
             if (newRelease) {
                 this.showNewVersionNotification(newRelease);
             }
```

It applies to 1.5.0 at line 856 and to 1.5.1 and 1.5.2 at line 869 (offset 13 lines). `packages/cli/standalone_bootstrap.ts:54` sets `PI_CODING_AGENT_VERSION` before Pi loads. The same value then goes out in the check's `User-Agent`, because `getLatestPiRelease()` builds it from its argument. This puts a third file in the local patch.

**3. Other uses of `VERSION` and `this.version`, which still see Sandpiper's `0.0.1`.**

| Use                                                                                                 | Location (`coding-agent 1.5.0: dist/`)                                               | Is `0.0.1` harmless?                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--version` output                                                                                  | `main.js:513`                                                                        | Correct. It is Sandpiper's version, and `devtools/packedCli.test.ts` asserts it.                                                                                                                                                                                                    |
| Built-in header `v<version>`                                                                        | `modes/interactive/interactive-mode.js:741`, `:743`                                  | Harmless. Sandpiper replaces the header (`extensions/system/startup-header.ts`).                                                                                                                                                                                                    |
| Changelog tracking: `setLastChangelogVersion(VERSION)` and the condensed "Updated to v..." line     | `modes/interactive/interactive-mode.js:579`, `:1018`, `:1024`                        | Harmless. `getChangelogPath()` resolves in Sandpiper's package, which ships no root `CHANGELOG.md`, so no entries are found. `lastChangelogVersion` is saved as `0.0.1`.                                                                                                            |
| Install telemetry: `reportInstallTelemetry(VERSION)`                                                | `modes/interactive/interactive-mode.js:1019`, `:1025`, `:1082-1096`                  | Harmless while `PI_TELEMETRY=0`, which Sandpiper sets by default (`standalone_bootstrap.ts:57`). If a user enables telemetry, pi.dev receives `version=0.0.1` once.                                                                                                                 |
| "was updated to X while this session was running (`VERSION`)"                                       | `modes/interactive/interactive-mode.js:1766`, `config.js:460-474`                    | Correct. It compares Sandpiper's own `package.json` on disk with the version read at startup.                                                                                                                                                                                       |
| `User-Agent` of provider requests                                                                   | `core/client-identity.js:11`, `core/sdk.js:205`                                      | Unknown. Every built-in provider API receives `pi/0.0.1 (...)`. New since 1.4.0 and independent of this proposal. **Inference**: a provider that gates on the client version could treat `0.0.1` differently; none is known to. One more hunk in `client-identity.js` would fix it. |
| `User-Agent` of the model catalog requests to pi.dev                                                | `core/remote-catalog-provider.js:62`                                                 | Harmless as far as the code shows. The catalog request also sends `?types=` and is filtered by model type, not by version.                                                                                                                                                          |
| `User-Agent` of `fd` and `rg` release lookups on GitHub                                             | `utils/tools-manager.js:89`                                                          | Harmless.                                                                                                                                                                                                                                                                           |
| MCP client info `{ name: "pi", version: VERSION }`                                                  | `extensions/mcp/runtime.js:279-281`                                                  | Harmless. MCP servers see `pi 0.0.1`.                                                                                                                                                                                                                                               |
| Crash logs and bug reports                                                                          | `core/crash-log.js:102`, `core/bug-report.js:58-59`                                  | Misleading only: a report names `0.0.1` and not the Pi version.                                                                                                                                                                                                                     |
| `sandpiper update`: `getLatestPiRelease(VERSION)`, the comparison, and the "Updated ... from" lines | `package-manager-cli.js:47`, `:108`, `:604`, `:616`, `:625`, `:672`, `:989`, `:1028` | **Not harmless once the banner advertises the command.** See below.                                                                                                                                                                                                                 |

The banner says "Run `sandpiper update`". That command's self-update step does not do what the banner implies. `getSelfUpdatePlan()` returns a plan to run whenever pi.dev's `packageName` differs from `PACKAGE_NAME` (`package-manager-cli.js:614-616`), and `PACKAGE_NAME` is `sandpiper-ai-cli` under Sandpiper (`config.js:489`). So the plan always runs and targets `@earendil-works/pi-coding-agent@<latest>`. **Inference**, from reading `config.js:259-265` and `:287-298`, not from running it:

- From a checkout, or any install that a global package manager does not own, it prints `Update @earendil-works/pi-coding-agent@<latest> using the package manager, wrapper, or source checkout that provides this installation.` and exits with code 1.
- From a global npm, pnpm, yarn, or Bun install of the Sandpiper tarball, it runs that manager's global install of `@earendil-works/pi-coding-agent@<latest>`. That installs stock Pi next to Sandpiper and leaves Sandpiper's bundled, patched Pi unchanged.

This behavior exists today. The proposal would start advertising it. Ways to close the gap: a second hunk that changes the banner's instruction text, or the `selfUpdateCommand` setting or `PI_SELF_UPDATE_COMMAND` (1.5.0), which replaces the self-update step with a command of your choice.

**4. Readers of `PI_SKIP_VERSION_CHECK`.** One: `dist/utils/version-check.js:66`, inside `checkForNewPiVersion()`. `dist/main.js:458` writes it for `--offline`. No other file that Sandpiper loads from `pi-coding-agent`, `pi-ai`, `pi-tui`, or `pi-mcp` 1.5.0 to 1.5.2 names it; the separate `dist/bundle/` build of the `pi` command was not searched. `sandpiper update` does not read it; it calls `getLatestPiRelease()` directly. So if Sandpiper stops setting it, only the interactive startup check changes. A user can still set `PI_SKIP_VERSION_CHECK=1` to turn the check off. `SANDPIPER_SKIP_VERSION_CHECK` does not work, because the name is on the exemption list of `mirrorPiSandpiperEnvironment()` (`standalone_bootstrap.ts:19-24`, `:74`).

**5. Modes.** Interactive mode only. `checkForNewPiVersion()` has one caller, `InteractiveMode.run()`. RPC mode, print mode, and JSON mode never check. Sandpiper's current check runs on `session_start` in every mode and appends a `sandpiper:update-banner` entry to the session file each time an update exists (`extensions/system/diagnostics-hooks.ts:60-73`); Pi's banner is not stored in the session.

**6. No supported alternative.** `MainOptions` has only `extensionFactories` (`dist/main.d.ts:12-14`). `InteractiveMode` takes no version option; `version` is a private field. No setting configures the check: `enableInstallTelemetry` "Does not control update checks" (`docs/settings.md:171`). The only documented switch is `PI_SKIP_VERSION_CHECK` (`docs/environment-variables.md:85`). The hunk is needed.

**What the proposal would let Sandpiper delete.**

| Code                                                                                                                                                                                         | Size                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `packages/core/src/update-check.ts` and `update-check.test.ts`, and the export at `packages/core/src/index.ts:15`                                                                            | 66 and 69 lines      |
| The update banner in `extensions/system/diagnostics-hooks.ts`: the entry type (line 8), the `checkForUpdates` parameter (16), the renderer (38-58), the call (67-73), and their tests        | About 35 of 75 lines |
| `shouldCheckForUpdates` in `packages/core/src/system-diagnostics.ts:69`. With it goes Sandpiper's dependency on Pi setting `PI_OFFLINE=1`.                                                   | A few lines          |
| The `checkForUpdates` option and `defaultCheckForUpdates()` in `extensions/system/extension-factories.ts:2`, `:28`, `:33-42`, and the stub at `packages/cli/system_prompt_diagnostic.ts:144` | About 12 lines       |
| `env.PI_SKIP_VERSION_CHECK = '1'` at `packages/cli/standalone_bootstrap.ts:56` and the assertion at `standalone_bootstrap.test.ts:123`                                                       | 2 lines              |

Differences from today's check that the deletion brings:

- The request goes to pi.dev instead of `registry.npmjs.org`, with a `User-Agent` that names the Pi version, the platform, the runtime, and the architecture.
- Pi reports only a newer version (semver). Sandpiper's check reports any version that differs.
- No check in RPC, print, or JSON mode.
- Sessions that already hold `sandpiper:update-banner` entries lose their renderer. **Inference**: such entries are then not shown.
- The integration harness and two tests set `PI_SKIP_VERSION_CHECK=1` themselves (`devtools/integration/harness.ts:136`, `packages/cli/standalone_resource_discovery.test.ts:63`, `extensions/tattler/tattler-pending-cue.session.test.ts:142`). They run no interactive mode, so they are unaffected either way.

### RPC mode, print mode, and custom providers

| Item                                                                                          | Location (`coding-agent 1.5.0`)                          | Sandpiper use                                                                              | 1.5.0                     | 1.5.2                                                                           |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------- |
| RPC commands `prompt`, `steer`, `compact`, `get_entries`, and the `response` frame            | `dist/modes/rpc/rpc-types.d.ts:16`, `:22`, `:74`, `:118` | `devtools/integration/rpc-driver.ts`, the `*.integration.test.ts` files                    | Unchanged; file identical | Types identical. `rpc-mode.js` changes in 1.5.1 for shutdown handling (#11599). |
| RPC events `message_update`, `message_end`, `tool_execution_end`, `agent_settled`             | `dist/modes/rpc/rpc-mode.js`                             | Same files                                                                                 | Unchanged; file identical | Tests pass                                                                      |
| Print mode (`-p`) and `--mode json`                                                           | `dist/modes/print-mode.js`                               | `devtools/integration/print-mode-driver.ts`, `devtools/packedCli.test.ts`                  | Unchanged; file identical | Changed in 1.5.1: a signal during final cleanup no longer kills it. Tests pass. |
| `registerProvider()` with `streamSimple`, an `openai-completions` API name, and inline models | `dist/core/extensions/types.d.ts:1381`                   | `devtools/integration/mock-provider.ts`, `packages/cli/system_prompt_diagnostic.ts:81-112` | Unchanged                 | Unchanged                                                                       |
| Assistant stream events `start`, `text_start`, `text_delta`, `text_end`, `toolcall_*`, `done` | `pi-ai 1.5.0: dist/utils/event-stream.d.ts`              | `devtools/integration/mock-provider.ts:93-169`                                             | Unchanged; file identical | Tests pass                                                                      |

### Compaction and steer

`devtools/integration/wave1-compaction.integration.test.ts` pins three things: manual `compact` succeeds with `compaction.keepRecentTokens` lowered, a steered message appears in `get_entries`, and a turn after compaction ends with `stopReason: 'stop'`. Both tests pass on 1.5.0 and 1.5.2.

`dist/core/compaction/compaction.js` changed in 1.4.0: summary requests no longer pass `maxTokens`, and `/compact <instructions>` now also reaches the turn-prefix summary. `keepRecentTokens` and `reserveTokens` still exist in settings (`coding-agent 1.5.0: dist/core/settings-manager.js:13-14`).

### `pi-mcp` client

`extensions/web-search/src/parallel-adapter.ts:91-118` uses `new McpClient({ name, version, requestTimeoutMs })`, `connect()`, `callTool(name, args, { timeoutMs })`, `close()`, and `new StreamableHttpTransport({ url })`.

| Item                      | Location (`pi-mcp 1.5.0`)                        | 1.5.0                     | 1.5.2                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `McpClient`               | `dist/client.d.ts:39`, `:45`, `:67`, `:68`       | Unchanged; file identical | Declaration and `client.js` identical to 1.3.0                                                                                                                            |
| `StreamableHttpTransport` | `dist/transports/streamable-http.d.ts:49`, `:61` | Declaration unchanged     | Declaration unchanged. `streamable-http.js` changes in 1.5.1: size limits now cover JSON replies, CR-only SSE line endings work, and error bodies are read to 8 KiB only. |

The adapter's own connection timer covers a gap in the client's request timer. `client.js` is unchanged, so the timer is still needed. The unit tests and the packed-install probe for `web_search` pass on both versions.

### `pi-tui` components

Sandpiper imports `Box`, `Container`, `Spacer`, `Text`, `Key`, `matchesKey`, `truncateToWidth`, `visibleWidth`, `wrapTextWithAnsi`, `KeybindingsManager`, `setKeybindings`, and the types `Component`, `EditorTheme`, and `TUI`, in `extensions/chorus/chorus-ui.ts`, `extensions/system/diagnostics-hooks.ts`, `skill-loading-tool.ts`, `startup-header.ts`, `turn-control-tool.ts`, `extensions/tattler/tattler-inbox-renderer.ts`, and `extensions/web-fetch/src/tool-rendering.ts`.

All are still exported (`pi-tui 1.5.0: dist/index.d.ts:4`, `:6`, `:16`, `:17`, `:22`, `:23`, `:32`, `:35`). The declarations of `Box`, `Text`, `Spacer`, and the key functions are identical to 1.3.0. The other changes are additions: `getSelectPageIndex()`, `replaceControlCharacters()`, and an optional `capturesViewportInput` member on components. `pi-tui` has the same declarations in 1.5.0 and 1.5.2.

### System prompt sections

The rendered prompt was captured with `sandpiper-system-prompt --no-skills --no-context-files --no-extensions` on 1.3.0 and on the 1.5.0 trial, with the patch carried as is. The two outputs differ in two places only:

- `<harness_docs>`: `Pi version: 1.3.0` becomes `1.5.0`.
- `<rules>`: the four guidelines of the `edit` tool become two.

  1.3.0:

  ```text
  - Use edit for precise changes (edits[].oldText must match exactly)
  - When changing multiple separate locations in one file, use one edit call with multiple entries in edits[] instead of multiple edit calls
  - Each edits[].oldText is matched against the original file, not after earlier edits are applied. Do not emit overlapping or nested edits. Merge nearby changes into one edit.
  - Keep edits[].oldText as small as possible while still being unique in the file. Do not pad with large unchanged regions.
  ```

  1.5.0:

  ```text
  - Use edit for targeted changes. Batch changes to one file in a single call.
  - Each edits[].oldText must exactly and uniquely match the original file. Keep matches short and non-overlapping; merge nearby changes without including large unchanged regions.
  ```

Per section:

| Section                                 | 1.5.0 compared with 1.3.0                                                                                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `preamble`                              | Sandpiper's prompt, through `customPrompt`. Mechanism unchanged. Pi's default preamble text changed; it matters only to the stale test marker.                                                                           |
| `tools`                                 | Rendered by the patch. Tool snippets unchanged. Closing sentence: see [The patch](#the-patch).                                                                                                                           |
| `rules`                                 | Rendered by the patch through Pi's `buildRules()`, which is unchanged. The `edit` guidelines changed. The two fixed rules, "Be concise in your responses" and "Show file paths clearly when working with files", remain. |
| `docs`                                  | Still suppressed under a custom prompt. Its text changed, which does not reach Sandpiper.                                                                                                                                |
| `addendum`, `project_context`, `skills` | Sandpiper clears their inputs and renders its own blocks. Pi's `skills` hint text changed (`dist/core/skills.js:290`), which does not reach Sandpiper.                                                                   |
| `cwd`, extension sections               | Unchanged. Section-name rule unchanged (`dist/core/system-prompt.js:71-75`).                                                                                                                                             |

The prompt-ownership tests, which cover the invariants of the migration spec, pass on both versions. One of them no longer checks anything; see [Required changes](#required-changes).

## Codex models

**What becomes available.** One model: `gpt-6.1-terra` on the `openai-codex` provider. It arrives in 1.5.0. 1.5.1 and 1.5.2 change nothing in the Codex catalog.

| Version      | `openai-codex` catalog change (`pi-ai`: `dist/providers/data/openai-codex.json`)                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.3.0        | `gpt-5.3-codex-spark`, `gpt-5.5`, `gpt-5.6-luna`, `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-6-astra`, `gpt-6-luna`, `gpt-6-sol`, `gpt-6.1-sol`                                                                    |
| 1.4.0        | Removes `gpt-5.3-codex-spark` and `gpt-5.5`                                                                                                                                                                  |
| 1.5.0        | Adds `gpt-6.1-terra`: 500,000-token context, 128,000 output tokens, text and image input, thinking levels `off` to `max`, $1 input and $5 output per million tokens, $2 and $7.50 above 272,000 input tokens |
| 1.5.1, 1.5.2 | No change                                                                                                                                                                                                    |

`gpt-6.1-sol` on `openai-codex` is already in 1.3.0. On the `openai` provider, 1.5.0 also adds `gpt-6.1-terra` (272,000-token context), `gpt-5.6-cyber`, and `chat-latest`.

The 1.5.0 changelog:

> Added GPT-6.1 Terra for OpenAI, Azure OpenAI Responses, and OpenAI Codex, with tool search and mid-conversation thinking-level changes. It supports thinking `off`; Codex offers a 500K context window

**What using it takes.**

| Item           | Value                                                                                                                                                                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider id    | `openai-codex`. API `openai-codex-responses`, base URL `https://chatgpt.com/backend-api` (`pi-ai 1.5.0: dist/providers/openai-codex.js`).                                                                                                                            |
| Display name   | "OpenAI Codex (legacy)" in 1.3.0 to 1.5.0. "OpenAI Codex" from 1.5.1.                                                                                                                                                                                                |
| Model id       | `openai-codex/gpt-6.1-terra`, for example `--model openai-codex/gpt-6.1-terra`.                                                                                                                                                                                      |
| Authentication | OAuth with a ChatGPT Plus or Pro subscription: `/login`, then the OpenAI Codex entry. No API key. From 1.5.1, also from the shell without a session. **Inference**: as `sandpiper auth login openai-codex`, because the command is handled inside `main()`; not run. |
| Configuration  | None required. The model is in the built-in catalog.                                                                                                                                                                                                                 |
| Alternative    | The `openai` provider serves the same model with a 272,000-token context, through `OPENAI_API_KEY` or "Sign in with ChatGPT".                                                                                                                                        |

One request detail changes for Codex. 1.3.0 sent `User-Agent: pi (<os> <release>; <arch>)` to the Codex backend (`pi-ai 1.3.0: dist/api/openai-codex-responses.js:1284`). 1.5.x sends `pi/<version> (<platform>; <runtime>; <arch>)` (`pi-ai 1.5.0: dist/api/openai-codex-responses.js:181`), and under Sandpiper the version is `0.0.1`. Both send `originator: pi`. Whether the backend acts on the version is unknown.

Not tested: a login, and a real request to the model.

**An observation about the current installation.** Pi overlays a model catalog from pi.dev on the built-in one, in 1.3.0 as well. `~/.sandpiper/agent/models-store.json` on this machine already holds a pi.dev catalog for `openai-codex` that includes `gpt-6.1-terra`, checked on 2026-11-10, with `lastModified: 0`. **Inference**, from reading `coding-agent 1.3.0: dist/core/remote-catalog-provider.js:50-55` and not from running it: Pi applies a stored catalog only when its `lastModified` is later than the build date of the bundled catalog, so an entry with `lastModified: 0` is ignored. That would explain why the model is stored but not offered on 1.3.0. It also means the catalog overlay cannot be relied on to deliver new models between Pi updates.

## Overlap candidates

Pi features in 1.4.0 to 1.5.2 that touch something Sandpiper implements. These are candidates only. Nothing is removed in this task, and this document recommends no removal.

| Area                                  | Sandpiper code                                                                                                                                                         | Pi 1.4.0 to 1.5.2                                                                                                                                                                                                       | Assessment                                                                                                                                                                                                                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Skill-loading tool                    | `extensions/system/skill-loading-tool.ts`                                                                                                                              | None. Pi has no `skill` tool; skills still load through `read` and `/skill:name`.                                                                                                                                       | No overlap.                                                                                                                                                                                                                                                                     |
| Background processes                  | `extensions/system/background-process-tools.ts`, `packages/core/src/process-manager.ts`                                                                                | None. `dist/extensions/` and `dist/core/tools/` hold the same tools in 1.3.0 and 1.5.2. 1.5.1 only improves the bash tool's timeout message when a background child keeps writing (#11613).                             | No overlap.                                                                                                                                                                                                                                                                     |
| System notifications, custom messages | `packages/core/src/system-notification.ts`, the Tattler and Chorus renderers                                                                                           | 1.5.1: `registerMarkdownTransformer()` can run on `custom` messages that have no renderer.                                                                                                                              | No replacement. Sandpiper's notifications are hidden custom messages, and Tattler and Chorus register their own renderers.                                                                                                                                                      |
| Update checks                         | `packages/core/src/update-check.ts` asks npm for the latest `pi-coding-agent`; `PI_SKIP_VERSION_CHECK=1` turns Pi's own check off                                      | 1.5.0: `PI_SELF_UPDATE_COMMAND` and the `selfUpdateCommand` setting let `pi update` run a custom command. 1.5.0: extension packages can show a changelog after an update. 1.5.1: `pi update` lists each package change. | Candidate, with one more patch hunk: Pi's native check can replace Sandpiper's check and banner. See [Native version check](#native-version-check). Sandpiper's check will report 1.5.2 as soon as the pin is 1.5.0, and its changelog link still points to `badlogic/pi-mono`. |
| Prompt customization                  | The `system-prompt.js` part of the local patch                                                                                                                         | None.                                                                                                                                                                                                                   | No overlap. The patch is still needed.                                                                                                                                                                                                                                          |
| Asset directories                     | The `config.js` part of the local patch                                                                                                                                | None.                                                                                                                                                                                                                   | No overlap. The patch is still needed.                                                                                                                                                                                                                                          |
| Session environment variables         | `packages/core/src/session-continuity.ts` sets `SANDPIPER_SESSION_ID` and `SANDPIPER_SESSION_FILE`                                                                     | Unchanged. `PI_SESSION_ID` and the others predate 1.3.0 and reach bash-tool commands only.                                                                                                                              | Existing overlap, not new. See [Concurrent Sessions](concurrent-sessions.md).                                                                                                                                                                                                   |
| MCP                                   | `extensions/web-search/src/parallel-adapter.ts`                                                                                                                        | 1.5.1 moves helpers into `pi-mcp`: `limitMcpContent()` and `MCP_OUTPUT_MAX_BYTES`, `createMcpToolName()`, `validateMcpServerConfig()`, OAuth sign-in, `PipeTransport`.                                                  | Small candidate. The adapter keeps its own result limit and timers. The response-size fixes in 1.5.1 apply to it without a code change.                                                                                                                                         |
| Key hints                             | `keyHint`, `keyText`, and `rawKeyHint` imported in `extensions/system/startup-header.ts`, `skill-loading-tool.ts:506`, `extensions/web-fetch/src/tool-rendering.ts:86` | 1.5.0 passes `keyText()` and `keyHint()` on the tool render context and the message and entry renderer options, and recommends them over the import.                                                                    | Candidate for the two tool renderers. **Inference**: the import is safe for built-in extensions today, because they share Pi's module instance. The header has no render context.                                                                                               |
| Project trust rule                    | `resolveProjectTrust()` in `packages/cli/system_prompt_diagnostic.ts:50-54`                                                                                            | `resolveProjectTrusted()` exists in `dist/core/project-trust.js` but is not exported from the package root.                                                                                                             | Not replaceable today. The local copy needs the 1.5.0 rule.                                                                                                                                                                                                                     |
| Login from the shell                  | None                                                                                                                                                                   | 1.5.1: `pi auth login <provider>` and `pi auth logout <provider>`.                                                                                                                                                      | A gain, not an overlap.                                                                                                                                                                                                                                                         |

The adoption candidates of the migration spec (sections, `outputSchema`, `annotations`, deferred exposure) are unaffected: the fields they rely on are unchanged in 1.5.x.

## Pins

Every place in tracked files that names the version `1.3.0` or the patch file.

**A. Must change for the install to resolve**

| File                                                    | Lines                                                  | Content                                                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `package.json`                                          | 58-61                                                  | The four dependency pins                                                                                 |
| `package.json`                                          | 86                                                     | `patchedDependencies` key and patch path                                                                 |
| `extensions/autotoon/package.json`                      | 8                                                      | `pi-coding-agent`                                                                                        |
| `extensions/system/package.json`                        | 16-18                                                  | `pi-ai`, `pi-coding-agent`, `pi-tui`                                                                     |
| `extensions/web-fetch/package.json`                     | 16-18                                                  | `pi-ai`, `pi-coding-agent`, `pi-tui`                                                                     |
| `extensions/web-search/package.json`                    | 11, 18-20                                              | `pi-mcp`, `pi-ai`, `pi-coding-agent`, `pi-tui`                                                           |
| `extensions/shell-relay/package.json`                   | 10-11                                                  | `pi-ai`, `pi-coding-agent`; only if Shell Relay still exists                                             |
| `patches/@earendil-works%2Fpi-coding-agent@1.3.0.patch` | File name, index lines, hunk headers                   | Replaced by the new patch file                                                                           |
| `bun.lock`                                              | 8-11, 31, 41-42, 53-55, 71-73, 80, 87-89, 105, 186-198 | Regenerated by `bun install`. Lines 186-198 also pin `pi-agent-core`, `pi-codemode`, and `pi-telemetry`. |

`bun.lock` also contains `1.3.0` for unrelated packages (`fast-sha256`, `tinyexec`, and two version ranges). They do not change.

**B. Tests that assert the version and fail until changed**

| File                                   | Lines     |
| -------------------------------------- | --------- |
| `devtools/rootProductMetadata.test.ts` | 47-50, 58 |
| `devtools/packedCli.test.ts`           | 164, 204  |

**C. Tests that use `1.3.0` as sample data and do not fail**

| File                                        | Lines                   |
| ------------------------------------------- | ----------------------- |
| `packages/cli/standalone_bootstrap.test.ts` | 121, 125, 134, 150, 159 |

**D. Current documents to update**

| File                                                              | Line    | Content                                                                 |
| ----------------------------------------------------------------- | ------- | ----------------------------------------------------------------------- |
| `.sandpiper/docs/specs/sandpiper-system-prompt.md`                | 5       | Patch file name in the implementation list                              |
| `.sandpiper/docs/specs/retained-surface-inventory.md`             | 56, 168 | Patch file name in row K-3; "Pi version `1.3.0` is hard-coded 12 times" |
| `.sandpiper/docs/specs/build-simplification-work-plan.md`         | 124     | `@earendil-works/pi-mcp@1.3.0`                                          |
| `.sandpiper/docs/specs/web-search-mcp-transport-investigation.md` | 40, 88  | "The installed `@earendil-works/pi-mcp` version is 1.3.0"               |

`docs/dev/build-system.md` names no version and needs no pin change. `docs/`, `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, and `.sandpiper/playbooks/` contain neither string.

**E. Historical records to leave as they are**

`.sandpiper/journal.md` (lines 4, 35), `.sandpiper/standup.md` (lines 263-298), `.sandpiper/notes/mcp-transport-handoff.md` (11), `.sandpiper/notes/minimal-build-handoff.md` (14), `.sandpiper/notes/simplification-handoff.md` (73, 77).

## Trial results

The trial ran in an isolated checkout on a machine under heavy load from other sessions (load average 30 to 70). All trial changes were discarded afterwards.

**Baseline on 1.3.0.** 84 test files and 726 tests passed. An earlier run under load failed 7 tests, 6 of them with timeouts; the rerun was clean.

**Setup.** The four pins were set to 1.5.0 in six manifests, Shell Relay's included, because `check:deps` requires consistent pins. The patch was carried with the documented procedure. Two things needed manual action: removing `dist/config.js.orig` before `bun patch --commit`, and removing the old `patchedDependencies` key and patch file.

**Pass 1: pins and patch only, 1.5.0.**

| Step                 | Result                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `bun install`        | Passed. Both patched files contain the patch marker.                                                             |
| `bun run check:deps` | Passed.                                                                                                          |
| `bun check`          | Failed at the type check with 15 errors. The Biome step, run separately, passed.                                 |
| `bun run test`       | The build passed. 19 of 84 test files failed: 56 failed tests and 2 files that failed to load. 656 tests passed. |

Type errors:

| File and position                                              | Error                                                                                                                                                                                |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `devtools/integration/probe-tool.ts(8,10)`                     | TS2305: Module '"@earendil-works/pi-ai"' has no exported member 'Type'.                                                                                                              |
| `extensions/chorus.ts(5,10)`                                   | TS2305, same message                                                                                                                                                                 |
| `extensions/shell-relay/src/tools/inspect-pane.ts(1,10)`       | TS2305, same message                                                                                                                                                                 |
| `extensions/shell-relay/src/tools/start-relay.ts(1,10)`        | TS2305, same message                                                                                                                                                                 |
| `extensions/system/background-process-tools.ts(1,10)`          | TS2305, same message                                                                                                                                                                 |
| `extensions/system/background-process-tools.ts(110,11)`        | TS2322: the `execute` result is not assignable, `details.pid`: `number \| undefined` against `undefined`. A consequence of the unresolved `Type`; it disappears with the import fix. |
| `extensions/system/prompt-ownership.test.ts(4,41)`             | TS2305, same message                                                                                                                                                                 |
| `extensions/system/prompt-recording-harness.ts(13,3)`          | TS2305, same message                                                                                                                                                                 |
| `extensions/system/skill-loading-tool.ts(6,10)`                | TS2305, same message                                                                                                                                                                 |
| `extensions/system/turn-control-tool.ts(1,10)`                 | TS2305, same message                                                                                                                                                                 |
| `extensions/tattler/index.ts(8,22)`                            | TS2305, same message                                                                                                                                                                 |
| `extensions/tattler/tattler-pending-cue.session.test.ts(10,3)` | TS2305, same message                                                                                                                                                                 |
| `extensions/tattler/tattler-receive.ts(1,10)`                  | TS2305, same message                                                                                                                                                                 |
| `extensions/web-fetch/src/index.ts(6,10)`                      | TS2305, same message                                                                                                                                                                 |
| `extensions/web-search/src/index.ts(7,10)`                     | TS2305, same message                                                                                                                                                                 |

Failing tests, by file:

| File                                                     | Failed            | Message                                                                                                                      |
| -------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `extensions/system/prompt-ownership.test.ts`             | 14                | `Error: prompt recorder model is not registered`                                                                             |
| `extensions/tattler/tattler-receive.test.ts`             | 6                 | `TypeError: Cannot read properties of undefined (reading 'Object')`                                                          |
| `extensions/web-fetch/src/index.test.ts`                 | 6                 | Same `TypeError`                                                                                                             |
| `packages/cli/standalone_cli_smoke.test.ts`              | 6                 | `Error: Command failed: bun ... sandpiper --help` and the `--version`, `list`, and extension-loading variants                |
| `extensions/system/background-process-tools.test.ts`     | 3                 | Same `TypeError`                                                                                                             |
| `extensions/system/skill-loading-tool.test.ts`           | 3                 | Same `TypeError`                                                                                                             |
| `extensions/tattler/index.test.ts`                       | 3                 | Same `TypeError`                                                                                                             |
| `extensions/system/turn-control-tool.test.ts`            | 2                 | Same `TypeError`                                                                                                             |
| `extensions/tattler/tattler-pending-cue.session.test.ts` | 2                 | `Error: probe model was not registered`                                                                                      |
| `devtools/integration/wave1-skill.integration.test.ts`   | 2                 | `Error: RPC session process exited. stderr: SyntaxError: Export named 'Type' not found in module '.../pi-ai/dist/index.js'.` |
| `packages/cli/standalone_resource_discovery.test.ts`     | 2                 | Same `TypeError`; the built CLI did not start                                                                                |
| `packages/cli/system_prompt_diagnostic.test.ts`          | 2                 | `Error: Command failed: bun run --bun ./packages/cli/sandpiper_system_prompt.ts ...`; `AssertionError: expected 1 to be +0`  |
| `devtools/integration/smoke.integration.test.ts`         | 1                 | `AssertionError: expected 1 to be +0` (the CLI exit code)                                                                    |
| `extensions/system/extension-factories.test.ts`          | 1                 | Same `TypeError`                                                                                                             |
| `extensions/web-search/src/index.test.ts`                | 1                 | Same `TypeError`                                                                                                             |
| `devtools/packedCli.test.ts`                             | 1                 | `AssertionError: expected '1.5.0' to be '1.3.0'`                                                                             |
| `devtools/rootProductMetadata.test.ts`                   | 1                 | `AssertionError: expected { …(5) } to deeply equal { …(5) }` (the four pins)                                                 |
| `extensions/chorus.test.ts`                              | File did not load | Same `TypeError`                                                                                                             |
| `packages/cli/sandpiper_resources.test.ts`               | File did not load | Same `TypeError`                                                                                                             |

All of these except the two version assertions have one cause, the missing `Type` export.

**Pass 2: the import fix.** One cause hid everything else, so the trial changed the import source of `Type` to `typebox` in the 14 files, and nothing else. `typebox` was not added to any manifest.

| Step           | Result                                                                                                                                                                                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type check     | Passed with no errors.                                                                                                                                                                                                                                            |
| Biome          | Reported the import order in the 14 files, an artifact of the scripted edit, fixable with `biome check --write`.                                                                                                                                                  |
| `bun run test` | 3 of 726 tests failed: the two version assertions, and `standalone_cli_smoke.test.ts` "loads a user extension with a runtime Pi import through the built sandpiper bin" with `Test timed out in 15000ms`. The timeout test is load-sensitive and passed on rerun. |

**Pass 3: version literals.** With `'1.3.0'` changed to `'1.5.0'` in the two test files, `devtools/packedCli.test.ts` failed three times with `Error: spawnSync npm ETIMEDOUT` at its 60-second limit. The same offline `npm install`, run by hand, took 66 seconds under the load and succeeded. With the timeouts in that test raised for the trial only, it passed, and a full run gave **84 of 84 files and 726 of 726 tests passing on 1.5.0**.

**1.5.2.** The trial was repeated on 1.5.2 because the recommendation depends on it. The patch produced for 1.5.0 applied without change. `check:deps` passed. Without the import fix, the type check gave the same 15 errors, and the CLI failed with the same `SyntaxError`. With the same three trial edits, the type check passed and **84 of 84 files and 726 of 726 tests passed on 1.5.2**.

1.4.0 and 1.5.1 were not installed.

**Cleanup.** Every trial change was discarded with `jj restore`. `node_modules` was removed and reinstalled from the committed lockfile, which gives the 1.3.0 packages with the patch applied.

## What was not checked

- **Extensions outside this repository.** The Claude Code CLI provider (`pi-claude-code-cli-provider`) and `fling-agents` load through Pi's extension loader, so their `Type` imports keep working. Their use of other `pi-ai` and SDK surfaces was not checked against 1.5.x. Changes they could meet: the request option `telemetryContext` is now `telemetry`, a new `identity` request option replaces the attribution-header merge, and `Tool` no longer constrains its parameters to TypeBox's `TSchema`.
- **Shell Relay**, and `install-shell-integrations.ts`, `preflight.ts`, `host-context.ts`, and `paths.ts` in `packages/core/src/`. Excluded by the task. Its two `Type` imports are listed only because they appeared in the trial output.
- **Interactive mode.** No interactive session ran on 1.5.x. The startup header, the Chorus editor and widgets, the Tattler renderers, and the tool renderers were checked by type and by unit test only.
- **Real providers.** No request went to a real provider. A ChatGPT login and a request to `openai-codex/gpt-6.1-terra` were not tried. `auth.json` was not read.
- **The catalog-overlay explanation** in [Codex models](#codex-models) comes from reading code and one local file.
- **Tool declarations.** The system prompt was compared between versions. The tool descriptions and schemas that Pi sends as declarations were not.
- **1.4.0 and 1.5.1 as install targets.** They were compared file by file, not installed.
- **Transitive packages.** The changelogs of `pi-agent-core`, `pi-codemode`, `pi-telemetry`, and `pi-schema` were not read. `pi-ai` and `pi-tui` ship none.
- **The default changes of 1.5.1** (idle cache warming, Anthropic message threads, default models) were read from the changelog, not measured.
- **`sandpiper auth login`, `SANDPIPER_SELF_UPDATE_COMMAND`, and `sandpiper update`** were not run.
- **The native version check.** The hunk in [Native version check](#native-version-check) was applied to copies of the files and not run. The banner, and what `sandpiper update` does from a global install, come from reading the code. The pi.dev endpoint was queried once, by hand.
- **Windows and Linux.** Everything ran on macOS arm64 with Bun 1.4.4.
- **Other negative assertions.** Only the stale preamble marker was found. Other tests that assert the absence of Pi-authored text were searched for in `extensions/system/`, `packages/cli/`, and `devtools/integration/`; none was found, but the search was by pattern, not exhaustive.
