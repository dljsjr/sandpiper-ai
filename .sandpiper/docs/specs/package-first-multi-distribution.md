# Package-First Multi-Distribution Refactor

Status: Draft plan  
Owner task: AGENT-84  
Created: 2026-04-27

## Summary

Sandpiper should stop treating the repository root as the canonical Pi package. The repository should become a package-first monorepo whose source of truth lives under `packages/`, with separate distribution assemblies for:

1. **Standalone Sandpiper CLI** — a Sandpiper-branded executable/app distribution built on Pi's SDK/CLI entrypoints.
2. **Neutral Pi package** — Sandpiper's enhanced capabilities, skills, prompts, themes, and CLIs installable into vanilla Pi without Sandpiper identity or system-prompt branding.
3. **Claude Code plugin** — the same neutral capability/resource set adapted to Claude Code's plugin model where supported.

This is a large structural refactor. The work should proceed through seams, tests, and distribution smoke tests before deleting or moving the existing top-level Pi-package layout.

## Context

The current repository is both a Bun workspace and a Pi package:

- package source lives in `packages/`
- Pi extensions live in `extensions/`
- skills live in `skills/`
- prompts live in `prompts/`
- themes live in `themes/`
- `devtools/postinstall.sh` assembles a Pi package in `dist/`
- the root `package.json` declares `piConfig`, `pi.extensions`, `pi.skills`, `pi.prompts`, and `pi.themes`

That shape made sense while Sandpiper was primarily a rebranded Pi package. It now couples unrelated concerns:

- Sandpiper identity/system prompt
- neutral agent capabilities
- Pi package resource propagation
- standalone CLI concerns
- future Claude Code plugin distribution

Pi 0.70.x makes a cleaner split more realistic:

- Pi routes more hardcoded `pi` / `.pi` branding through `APP_NAME` and `CONFIG_DIR_NAME` derived from `piConfig`.
- Pi exports `main(args, { extensionFactories })`, which allows embedded/custom entrypoints to pass inline extension factories.
- Pi package manifests can expose resource paths independently of CLI branding.
- Pi's SDK/resource loader APIs accept explicit `cwd`, `agentDir`, additional resource paths, and extension factories.

## Goals

- Move source-of-truth code/resources under `packages/` with clearer package boundaries.
- Separate Sandpiper identity from neutral capabilities.
- Make neutral packages host-aware through explicit context objects, not hardcoded Sandpiper/Pi paths.
- Produce a standalone Sandpiper CLI distribution using Pi's rebranding and extension-factory support.
- Produce a neutral Pi package distribution without Sandpiper identity/system prompt.
- Produce a Claude Code plugin distribution where capabilities map cleanly to Claude Code.
- Keep existing users' data migratable and avoid silent data loss.
- Preserve or improve testability and verification coverage throughout the migration.

## Non-Goals

- Do not rewrite feature behavior while moving code. Behavior changes get separate tasks.
- Do not require true single-file binary distribution unless a spike proves it is practical. A binary plus sidecar assets/package metadata is acceptable if that matches Pi/Bun constraints.
- Do not edit vendored third-party skills except through the vendoring workflow.
- Do not remove the current root Pi-package assembly until replacement distributions are smoke-tested.
- Do not solve every historical task-system or shell-relay issue as part of this refactor.

## Architecture Principles

### 1. Packages are the source of truth

Top-level `extensions/`, `skills/`, `prompts/`, and `themes/` should stop being authored source directories. The canonical source should live under `packages/`.

Distribution-specific directories may still exist under `dist/`, but they should be generated artifacts.

### 2. Capability packages are host-neutral

Neutral packages must not hardcode:

- `~/.sandpiper`
- `./.sandpiper`
- `~/.pi`
- `./.pi`
- `SANDPIPER_*`
- Pi-specific package-root assumptions

Host adapters provide config/session/resource paths explicitly.

### 3. Identity is a product concern

Sandpiper identity includes:

- app name/title
- config directory name
- system prompt/persona
- startup/handoff behavior specific to Sandpiper
- Sandpiper update messaging
- Pi-to-Sandpiper migration commands

Neutral distributions must not include this identity layer.

### 4. Adapters stay thin

Host-specific adapters should wire host APIs to neutral implementation modules. Business logic should live in packages that can be tested without Pi, Claude Code, or a real user config directory.

### 5. Tool definitions are adapter concerns

Harness-neutral code should not define Pi `ToolDefinition`s, Claude/MCP tool definitions, or any other host-specific model-facing tool contract.

The baseline design should be:

- capability core packages expose typed operations and pure implementation logic
- host adapters own model-facing names, descriptions, schemas, rendering, lifecycle hooks, and transport details
- Pi adapters translate capability operations into Pi extension factories/tools
- Claude adapters translate capability operations into stdio-based MCP servers/tools

If duplication across host adapters becomes painful, introduce a small internal capability-contract abstraction that adapters consume. That abstraction must still be host-neutral and must not leak Pi extension types, MCP server types, or runtime-specific lifecycle assumptions into capability core packages.

### 6. Distribution manifests should be generated from one source

Each distribution should be assembled from package/resource manifests rather than hand-maintained duplicated path lists.

## Target Package Groups

Names are provisional; refine during implementation.

| Package group | Purpose |
| --- | --- |
| `packages/host-context` | Shared host/app/session/path abstractions and test helpers. |
| `packages/sandpiper-identity` | Sandpiper-only system prompt, startup behavior, update checks, migration commands. |
| `packages/capability-background-process` | Host-neutral background process lifecycle logic; no Pi or MCP tool definition imports. |
| `packages/capability-shell-relay` | Host-neutral shell relay/session orchestration logic; adapters expose host tools where supported. |
| `packages/capability-web-fetch` | Host-neutral fetch/extract/convert pipeline; adapters expose host tools. |
| `packages/capability-autotoon` | Host-neutral JSON-to-TOON conversion logic; adapters expose host hooks/tools. |
| `packages/adapter-pi` | Pi extension factories/tool definitions that expose selected capability packages. |
| `packages/adapter-claude-code` | Claude Code hooks and stdio MCP adapters over selected capability packages. |
| `packages/tasks-core` | Task data model, storage, parsing, and operations. |
| `packages/tasks-cli` | `sandpiper-tasks` binary/CLI wrapper around task core. |
| `packages/standup-core` | Standup/session-continuity data model and file operations. |
| `packages/standup-cli` | `sandpiper-standup` binary/CLI wrapper around standup core. |
| `packages/resources-skills` | First-party skills and vendored third-party skill bundle metadata; maps to Pi skills and Claude plugin `skills/`. |
| `packages/resources-prompts` | Prompt templates; maps directly to Pi prompts, and may map to Claude plugin `commands/` or skills where behavior is equivalent. |
| `packages/resources-themes` | Theme resources; maps to Pi themes and Claude plugin `themes/` after schema compatibility review. |
| `packages/distribution-manifest` | Shared manifest describing resources and entrypoints used by distribution assemblers. |
| `packages/dist-pi-package` | Neutral Pi package assembler. |
| `packages/dist-sandpiper-cli` | Standalone Sandpiper app/binary assembler. |
| `packages/dist-claude-plugin` | Claude Code plugin assembler. |

## Host Context Abstraction

Introduce a small typed boundary for host-provided paths and identity. Exact names can change, but the shape should be explicit and injectable:

```ts
interface HostContext {
  readonly appName: string;
  readonly cwd: string;
  readonly agentDir: string;
  readonly projectConfigDir?: string;
  readonly sessionId?: string;
  readonly sessionFile?: string;
}
```

Additional typed wrappers may be useful for specific concerns:

- `AgentConfigDir`
- `ProjectConfigDir`
- `SessionIdentity`
- `ResourceRoot`
- `DistributionFlavor`
- `PluginRoot`
- `PluginDataDir`

The key rule is: parse host-specific state at the boundary, then pass typed values through the rest of the implementation. For Claude Code, the adapter should translate `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, and `CLAUDE_PLUGIN_OPTION_*` environment values into typed inputs before invoking capability code.

## Distribution Products

### Standalone Sandpiper CLI

Expected characteristics:

- Branded as Sandpiper.
- Uses Sandpiper config directory defaults.
- Includes Sandpiper identity/system prompt.
- Includes all neutral capability packages/resources.
- Uses Pi `main(args, { extensionFactories })` or SDK/runtime APIs rather than pretending the repo root is a Pi package.
- Uses `bun compile` if feasible, with sidecar assets if required by Pi's asset/package lookup behavior.

Open question: whether a true single-file binary is practical. Pi's current compiled-binary model still expects package metadata and assets to be discoverable, so the first target should be a reliable app bundle rather than a strict one-file binary.

### Neutral Pi Package

Expected characteristics:

- Installable with `pi install` from npm/git/local path.
- Generated npm package manifests must not contain Bun-only `catalog:` or `workspace:*` specs.
- Package-owned support code shipped beside a generated artifact should be referenced with local `file:` dependencies whose package roots are present in the artifact.
- Pi packages imported by extensions should be peer dependencies with `"*"` ranges, matching Pi package guidance.
- Ships enhanced functionality: skills, prompt templates, themes, and neutral extensions/tools.
- Does **not** set Sandpiper identity, Sandpiper system prompt, or Sandpiper config directory.
- May still ship CLIs named `sandpiper-tasks` and `sandpiper-standup` if those are product/tool names rather than host identity.
- Uses Pi's config/path APIs (`getAgentDir()`, session/runtime context, resource loader paths) rather than hardcoded Sandpiper paths.

### Claude Code Plugin

Expected characteristics:

- Ships neutral skills/resources and compatible hooks/tools via Claude Code's plugin model.
- Uses a plugin root with `.claude-plugin/plugin.json` metadata plus publishable npm package metadata for marketplace-discovered installs.
- Provides a root `.claude-plugin/marketplace.json` that validates as a Claude marketplace and points installs at the npm plugin package.
- Exposes automatic lifecycle behavior through Claude plugin hooks where the host has an equivalent event.
- Exposes model-facing tools through plugin-provided MCP servers, normally stdio servers configured in `.mcp.json` or inline `plugin.json`, not Pi extension factories.
- Does not ship Sandpiper identity/system prompt.
- Has its own Claude adapter layer instead of reusing Pi extension glue directly.
- Consumes the same host-neutral capability operations as the Pi adapter, but owns Claude-specific hook configuration, MCP tool names, descriptions, schemas, result-size metadata, request/response mapping, process lifecycle, and transport behavior.
- Uses Claude's plugin path variables (`${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`) for bundled files and persistent plugin state.

Claude plugin support is primarily an adapter and packaging problem, not a Pi-extension parity problem. Skills can map to Claude plugin `skills/`; some Pi prompt templates may map to Claude `commands/` or skills, but that mapping should be reviewed case-by-case because Claude has no identical Pi prompt-template component. Automatic lifecycle behavior should use Claude hooks when the host event matches the capability, while model-facing tool support should be implemented as MCP server adapters over neutral capability cores. Pi lifecycle hooks that do not have a Claude/MCP equivalent must either move into a different abstraction, become Sandpiper/Pi-only, or be documented as unsupported in the Claude distribution.

## Claude Code Plugin Reference Findings

Source: <https://code.claude.com/docs/en/plugins-reference> and <https://code.claude.com/docs/en/mcp>.

Claude plugins are self-contained directories. Marketplace-installed plugins are copied into Claude's plugin cache, so installed plugins cannot rely on relative paths that traverse outside the plugin root. Symlinks inside the plugin directory are preserved, but normal references to external workspace files should not be part of the distribution design.

Default component locations:

| Claude component | Default path | Notes for Sandpiper |
| --- | --- | --- |
| Manifest | `.claude-plugin/plugin.json` | Optional, but needed for metadata and custom paths. If present, `name` is required. Repository metadata in this manifest is a string URL, not an npm-style repository object. |
| Skills | `skills/` | Directory-per-skill with `SKILL.md`; closest match to Pi skills. |
| Commands | `commands/` | Flat markdown command/skill files; possible target for selected prompt templates. |
| Agents | `agents/` | Optional future distribution surface; plugin agents cannot include hooks, MCP servers, or permission mode. |
| Hooks | `hooks/hooks.json` or manifest inline | Event handlers can run commands, HTTP calls, MCP tools, prompts, or agents. |
| MCP servers | `.mcp.json` or manifest inline | Main tool-adapter mechanism for Claude; plugin servers start when plugin is enabled. |
| LSP servers | `.lsp.json` or manifest inline | Optional future capability, not part of the first migration. |
| Monitors | `monitors/monitors.json` or manifest inline | Background line-producing processes; potentially relevant to shell relay/process monitoring but not a direct Pi extension equivalent. |
| Themes | `themes/` | Theme schema compatibility needs review. |
| Executables | `bin/` | Added to Claude's Bash tool `PATH` while plugin is enabled. Useful for bundled helper CLIs. |
| Settings | `settings.json` | Limited supported keys; do not assume arbitrary defaults. |

Manifest path rules:

- Custom component paths must be relative to the plugin root and start with `./`.
- For `skills`, `commands`, `agents`, `outputStyles`, `themes`, and `monitors`, specifying a custom path replaces the default path rather than adding to it. Include the default path explicitly if both are needed.
- Hooks, MCP servers, and LSP servers support multiple sources with their own semantics.

Claude plugin environment and state:

- `${CLAUDE_PLUGIN_ROOT}` is the absolute path to the installed plugin version. It changes on update and should be treated as read-only/disposable.
- `${CLAUDE_PLUGIN_DATA}` is persistent plugin state at `~/.claude/plugins/data/{id}/` and survives plugin updates until uninstall. This is the Claude adapter's durable state location.
- `userConfig` in `plugin.json` prompts users for plugin options and exports them to subprocesses as `CLAUDE_PLUGIN_OPTION_<KEY>`.
- Sensitive `userConfig` values are stored in secure storage or Claude credentials fallback, not plain plugin files.

MCP-specific constraints:

- Plugin MCP servers start automatically when the plugin is enabled and appear as standard MCP tools.
- Stdio MCP servers are local processes and are not automatically reconnected after disconnect; design servers to be robust and fail loudly.
- Claude supports MCP `list_changed` notifications, so servers can update tools/prompts/resources dynamically.
- Claude has MCP tool-search behavior that can defer tool schema loading. Server instructions and concise tool descriptions matter; descriptions/instructions are truncated around 2KB.
- Large MCP results are subject to Claude output thresholds. Tool entries can set `_meta["anthropic/maxResultSizeChars"]` up to Claude's ceiling for large text results.
- MCP servers can request elicitation; plugin hooks can respond to `Elicitation` and `ElicitationResult` events.

These constraints reinforce that neutral packages should expose operations, not model-facing tool definitions. Pi and Claude adapters can share operation code, but each adapter must own its tool schema, lifecycle, transport, and result-shaping behavior.

## Migration Plan

### Phase 0 — Plan and inventory

Task: AGENT-84

Deliverables:

- This plan document.
- Task breakdown.
- Initial risk/open-question list.
- Inventory targets for hardcoded branding/path assumptions.

### Phase 1 — Standalone CLI spike

Task: AGENT-85

Build the smallest useful proof of concept:

- a Sandpiper entrypoint that calls Pi `main(args, { extensionFactories })`
- one inline/bundled extension factory loaded without relying on root `pi.extensions`
- one bundled skill/resource path loaded without relying on root `pi.skills`
- Sandpiper app/config identity proven in a temp config directory
- asset/package behavior documented for `bun compile`

Spike findings are captured in [standalone-cli-spike.md](standalone-cli-spike.md). Initial result: Pi's `main(args, { extensionFactories })` works for inline extension injection, `resources_discover` works for bundled resource discovery, and the first standalone deliverable should be an app bundle with sidecar package metadata/assets rather than a true single-file binary.

### Phase 2 — Host context and path abstraction

Task: AGENT-86

Introduce typed host-context resolution and update neutral code to receive paths/session identity explicitly.

Early candidates:

- task CLI directory resolution
- standup CLI directory/session resolution
- shell integration install paths
- session continuity PID paths
- any direct `.sandpiper` / `~/.sandpiper` use in neutral-capability code

#### AGENT-86 inventory

Initial hardcoded host-path/env references found before introducing the seam:

| Area | Current references | Classification for AGENT-86 |
| --- | --- | --- |
| Standup CLI (`packages/sandpiper-standup-cli`) | `./.sandpiper/standup.md`, `SANDPIPER_SESSION_ID`, `SANDPIPER_SESSION_FILE` | First vertical-slice consumer; should receive explicit project paths and session identity. |
| Task CLI (`packages/sandpiper-tasks-cli`) | `./.sandpiper/tasks`, `.sandpiper-tasks.json`, `./.sandpiper/settings.json` | Candidate for later consumer; avoid a task-storage redesign in AGENT-86. |
| Shell integration install/preflight | `~/.sandpiper/shell-integrations`, `PI_PACKAGE_DIR` | Small second consumer if the standup slice stays contained. |
| Shell relay runtime | `SANDPIPER_SESSION_ID`, `SHELL_RELAY_SESSION`, XDG/tmp FIFO paths | Host-adapter/capability boundary candidate; leave deeper runtime split for later capability package work. |
| Sandpiper identity/adapters (`packages/cli`, `extensions/system`, migration helpers) | Sandpiper/Pi env mirroring, migration paths, system prompt text, package sidecar config | Allowed to remain host-specific. |
| Startup context (`packages/core/src/startup-context.ts`) | `.sandpiper/tasks` project metadata discovery | Sandpiper identity/support behavior; revisit after task/standup seams exist. |

AGENT-86 introduced a typed seam in `packages/core/src/host-context.ts` and proved it through two consumers:

- `packages/sandpiper-standup-cli` resolves project config paths and session identity through explicit host-context inputs. Command modules no longer construct `./.sandpiper/standup.md` directly.
- `packages/core/src/install-shell-integrations.ts` accepts explicit source/target paths and can derive target paths from a host context. Its default remains Sandpiper-specific because shell integration installation is still a Sandpiper adapter behavior.

AGENT-86 verification uses these checks:

```bash
bun check
bun --filter sandpiper-ai-core test
bun --filter sandpiper-standup-cli test
bun run test:standalone
rg -n "\.sandpiper|~/.sandpiper|SANDPIPER_|PI_" packages/core/src packages/sandpiper-standup-cli/src --glob '!**/*.test.ts'
```

Expected remaining search matches are Sandpiper adapter/identity defaults, user-facing CLI help text, migration helpers, and existing startup/task discovery behavior that will be revisited in later package-split work.

### Phase 3 — Split identity from capabilities

Task: AGENT-87

Decompose the current `extensions/system.ts` responsibilities:

Sandpiper-only:

- system prompt/persona
- startup prompt composition
- Pi-to-Sandpiper migration commands
- Sandpiper update banner
- Sandpiper-specific env mirroring

Neutral:

- background process tools
- generic diagnostics/preflight where host-neutral
- standup/session-continuity hooks after path abstraction
- resource/capability guidance that does not imply Sandpiper identity

#### AGENT-87 inventory

`extensions/system.ts` is already thin glue, but it composes identity and neutral capability behavior into a single Pi extension. Phase 3 should split those registrations without changing user-visible behavior in the legacy Sandpiper package or standalone Sandpiper CLI.

| Current registration | Current location | Classification | AGENT-87 treatment |
| --- | --- | --- | --- |
| Background process tools | `extensions/system/background-process-tools.ts` | Neutral capability exposed through a Pi adapter | Move behind a neutral capability extension factory that can load without Sandpiper identity. |
| Background process completion context and shutdown cleanup | `extensions/system/startup-hooks.ts` | Neutral capability support for background process tools | Keep with the neutral background process capability extension. |
| Sandpiper prompt replacement, startup task/project/standup context, cold-start guidance, system prompt dump flag | `extensions/system/startup-hooks.ts` | Sandpiper identity/startup behavior | Move behind a Sandpiper identity extension factory. |
| Session continuity PID files and `SANDPIPER_SESSION_*` env export | `extensions/system/startup-hooks.ts` | Sandpiper session adapter behavior today; candidate for later host-neutral standup package work | Keep with the Sandpiper identity extension for AGENT-87 so neutral mode does not write Sandpiper env vars or PID files in vanilla Pi. |
| Migration and shell-integration flags/command | `extensions/system/migration-controls.ts` | Sandpiper identity/migration behavior | Keep with the Sandpiper identity extension. |
| Diagnostics banner, unmigrated Pi config warning, Sandpiper update banner | `extensions/system/diagnostics-hooks.ts` | Sandpiper identity/support behavior | Keep with the Sandpiper identity extension. |
| `extensions/shell-relay`, `extensions/web-fetch`, `extensions/autotoon` | Separate extension entrypoints | Neutral capability candidates, though shell-relay still has Sandpiper-specific install/preflight wording | Continue to expose them as neutral-capability extension factories; deeper host-neutral package extraction is AGENT-88+. |
| Resource discovery for skills/prompts/themes | `packages/cli/sandpiper_resources.ts` | Distribution adapter behavior | Keep as an explicit resource adapter and make factory grouping identity-aware. |

AGENT-87 should leave a legacy composed `system` extension for existing root Pi-package behavior, plus explicit factory groups for:

- **Sandpiper identity**: system prompt/startup, session continuity, migration controls, diagnostics/update banners.
- **Neutral capabilities**: background process tools/hooks, shell relay, web fetch, AutoTOON, and shared resource discovery.

Completion is proven when tests can load the neutral factory set without registering Sandpiper identity flags or prompt hooks, and the Sandpiper factory set still registers the existing identity flags exactly once.

AGENT-87 implementation results:

- `extensions/system/extension-factories.ts` owns the split between:
  - `createSandpiperIdentityExtension(...)` for Sandpiper prompt/startup/session/migration/diagnostics/update behavior.
  - `createNeutralCapabilityExtension(...)` for background process tools plus completion/shutdown hooks.
  - `createSandpiperSystemExtension(...)` for the legacy composed `extensions/system.ts` entrypoint, preserving existing root package behavior.
- `extensions/capabilities.ts` is the neutral Pi-loadable system capability entrypoint. It intentionally omits Sandpiper identity flags, prompt hooks, migration controls, diagnostics, and update banners.
- `packages/cli/sandpiper_resources.ts` exposes identity-aware factory groups:
  - `createNeutralCapabilityExtensionFactories(resourceRoot)`
  - `createSandpiperIdentityExtensionFactories()`
  - `createSandpiperExtensionFactories(resourceRoot)`
- Standup CLI help/error text now derives from configured session env names rather than duplicating `SANDPIPER_SESSION_*` strings in command registration.

AGENT-87 verification uses these checks:

```bash
bun check
bun x vitest run extensions/capabilities.test.ts extensions/system/extension-factories.test.ts
bun x vitest run packages/cli/sandpiper_resources.test.ts packages/cli/standalone_cli_smoke.test.ts
bun --filter sandpiper-standup-cli test -- helpers.test.ts
bun run test:standalone
rg -n "migrate-pi-configs|install-shell-integrations|before_agent_start|buildSandpiperSystemPrompt" extensions/capabilities.ts packages/cli/sandpiper_resources.ts
rg -n "SANDPIPER_SESSION_ID|SANDPIPER_SESSION_FILE" packages/sandpiper-standup-cli/src/commands/write-cmd.ts
```

Expected invariant-search results:

- The neutral `extensions/capabilities.ts` entrypoint and `packages/cli/sandpiper_resources.ts` factory grouping contain no migration flag strings, no `before_agent_start` prompt hook wiring, and no direct Sandpiper prompt builder imports.
- `write-cmd.ts` contains zero direct `SANDPIPER_SESSION_*` string references; those names live in the standup command helper identity constants until a later host-neutral standup package split.

### Phase 4 — Move source under packages

Task: AGENT-88

Move neutral packages/resources under `packages/` after seams exist and tests cover behavior.

The first moves should be low-risk and testable. Avoid moving everything in one commit/change.

#### AGENT-88 migration slice

AGENT-88 starts with **AutoTOON** as the first package-first migration slice. It is the lowest-risk neutral capability because its core behavior is a pure JSON→TOON transform, its Pi adapter is a single `tool_result` hook, and it already has focused tests.

| Candidate | Current source | Package-first risk | AGENT-88 decision |
| --- | --- | --- | --- |
| AutoTOON | `extensions/autotoon/autotoon.ts` | Low: pure transform plus one Pi event adapter; no filesystem/session/config behavior | Move source of truth to `packages/capability-autotoon`; leave `extensions/autotoon` as compatibility bridge. |
| Web fetch | `extensions/web-fetch/src/*` | Medium: multiple modules, external dependencies, Pi tool adapter and host-neutral fetch pipeline already mixed in extension package | Defer until AutoTOON package pattern is proven. |
| Shell relay | `extensions/shell-relay/src/*` | Higher: Zellij/FIFO runtime, shell integration preflight, Sandpiper-specific install wording and session env assumptions | Defer to a dedicated host-neutral shell-relay package task. |
| Background process tools | `extensions/system/background-process-tools.ts`, `extensions/system/startup-hooks.ts` | Medium: neutral behavior now split by AGENT-87, but adapter code is still co-located with Sandpiper identity helpers | Defer until neutral adapter package naming is settled. |
| Skills/prompts/themes resources | `skills/`, `prompts/`, `themes/` | Medium: distribution assembly currently copies top-level resource directories and docs/skills refer to those paths | Defer broad resource movement until distribution manifest work. |

AutoTOON target shape:

- `packages/capability-autotoon/src/core.ts` owns host-neutral transform constants and `tryConvertJsonToToon(...)`; it imports no Pi or MCP types.
- `packages/capability-autotoon/src/pi-extension.ts` owns the Pi `tool_result` adapter.
- `extensions/autotoon/autotoon.ts` becomes a small compatibility bridge so the legacy root Pi package keeps its current manifest path.
- `packages/cli/sandpiper_resources.ts` imports the package-first Pi adapter directly for standalone/dogfood distribution paths.

AGENT-88 implementation results:

- Added `packages/capability-autotoon/` as the package-first source for AutoTOON.
- Moved AutoTOON behavior tests to the new package:
  - `packages/capability-autotoon/src/core.test.ts`
  - `packages/capability-autotoon/src/pi-extension.test.ts`
- Replaced the legacy top-level AutoTOON extension implementation with a compatibility bridge and a small bridge test.
- Updated standalone resource wiring to import the package-first Pi adapter directly.
- Updated package/build/docs metadata so `packages/capability-autotoon/` is the documented source of truth.

AGENT-88 verification uses these checks:

```bash
bun check
bun --filter sandpiper-capability-autotoon test
bun --filter sandpiper-capability-autotoon build
bun x vitest run extensions/autotoon/autotoon.test.ts packages/cli/sandpiper_resources.test.ts
bun run test:standalone
bun --filter sandpiper-ai-core build
bun --filter sandpiper-standup-cli build
bun --filter sandpiper-tasks-cli build
(cd packages/cli && mkdir -p dist && bun build --production --minify --target=node ./pi_wrapper.ts --outfile ./dist/sandpiper)
bash devtools/postinstall.sh
rg -n "@mariozechner|ExtensionAPI|ToolDefinition|McpServer|@modelcontextprotocol" packages/capability-autotoon/src/core.ts
rg -n "@toon-format/toon|pi\\.on\\('tool_result'|function tryConvertJsonToToon" extensions/autotoon --glob '*.ts'
```

The narrow `packages/cli` build command above prepares the legacy CLI artifact that `postinstall.sh` expects without invoking the standalone bundle target; the standalone target still has known native-asset follow-up work for AGENT-91.

Expected invariant-search results:

- The host-neutral AutoTOON core has zero Pi/MCP adapter imports or types.
- The legacy top-level AutoTOON extension directory has zero transform implementation or Pi `tool_result` hook definitions; it only re-exports the package-first adapter and tests the bridge.

### Phase 5 — Add invariant checks and smoke tests

Task: AGENT-89

Add automated checks that enforce the new architecture:

- neutral packages contain no hardcoded Sandpiper/Pi config dirs
- neutral capability packages do not import Pi extension/tool types, MCP server types, or host lifecycle APIs
- distribution manifests are internally consistent
- generated Pi package resolves extension/skill/prompt/theme paths
- standalone Sandpiper runs with temp config dirs
- no tests touch real `~/.sandpiper` or `~/.pi`

AGENT-89 implementation slices:

| Slice | Check surface | Completion signal |
| --- | --- | --- |
| Source-boundary invariants | Neutral package sources and neutral Pi capability entrypoints | Automated test fails if neutral core code gains Sandpiper/Pi config strings, Pi adapter imports, MCP server imports, or identity hook registrations. |
| Pi package manifest smoke | Root and generated Pi package manifests | Automated test verifies declared extension/skill/prompt/theme paths exist relative to their package roots and generated `dist/package.json` preserves expected metadata shape. |
| Standalone smoke gate | Existing standalone tests plus distribution script | `test:distribution` runs standalone help/resource smoke tests with temp agent directories and no reliance on a user `sandpiper` executable. |
| Local workflow docs | Build docs and package scripts | Contributors have one command for distribution invariants, with documented generated-artifact prerequisites. |

AGENT-89 intentionally does not build the final neutral Pi package, final Bun app bundle, or Claude plugin. Those artifacts remain AGENT-90, AGENT-91, and AGENT-92 respectively; AGENT-89 creates the checks those tasks must satisfy.

AGENT-89 verification is anchored by:

```bash
bun run test:distribution
```

The distribution test script prepares the legacy `dist/` assembly, runs source-boundary invariant tests, verifies Pi package manifest resource paths, and runs standalone smoke tests against temporary agent directories.

### Phase 6 — Build distribution artifacts

Tasks: AGENT-90, AGENT-91, AGENT-92

Create the three distribution assemblies:

- neutral Pi package
- standalone Sandpiper app/binary
- Claude Code plugin

Each distribution must have a smoke test and documented local development workflow.

#### AGENT-90 neutral Pi package target

AGENT-90 introduces a local neutral Pi package artifact at `dist/neutral-pi-package/`. It is a transition artifact, not the final npm-published package. The goal is to prove that Pi can load Sandpiper's neutral resources without the Sandpiper identity layer.

Artifact shape:

- `dist/neutral-pi-package/package.json`
  - `name`: `sandpiper-ai-neutral-pi-package`
  - `keywords`: includes `pi-package`
  - `pi.extensions`: `./extensions/capabilities.ts`, `./extensions/shell-relay`, `./extensions/web-fetch`, `./extensions/autotoon`
  - `pi.skills`: `./skills/sandpiper`, `./skills/third-party`
  - `pi.prompts`: `./prompts`
  - `pi.themes`: `./themes`
  - no `piConfig`, no Sandpiper app identity, no `bin: sandpiper`
- Source/resource copies under the artifact root preserve the manifest paths above.
- Package-first implementation support packages needed by compatibility bridges, such as `packages/capability-autotoon`, are copied into the artifact.

AGENT-90 completion signal:

- A local Pi resource-loader smoke test loads `dist/neutral-pi-package/` or an equivalent temp-built artifact as a package.
- Neutral tools/resources are present.
- Sandpiper identity flags/hooks are absent: no migration flags, no install-shell-integration flag, no `before_agent_start` Sandpiper prompt hook, and no `extensions/system.ts` in the loaded extension set.
- The artifact manifest paths are covered by the AGENT-89 distribution invariant helpers.

AGENT-90 verification is anchored by:

```bash
bun run test:neutral-pi-package
bun run test:distribution
```

`test:neutral-pi-package` builds `dist/neutral-pi-package/` and runs the focused neutral package manifest/load smoke tests. `test:distribution` includes those neutral checks along with the existing distribution invariant and standalone smoke gates.

#### AGENT-91 standalone Sandpiper app bundle target

AGENT-91 promotes the dogfood standalone CLI into a local standalone app-bundle artifact. The target is still an app bundle, not a strict single-file executable: Bun and Pi both need sidecar package metadata/assets, and native/data assets such as `canvas.node` and `css-tree/data/patch.json` may need filesystem paths outside the executable.

Artifact shape:

- `dist/standalone-sandpiper/`
  - `sandpiper` — Bun-compiled executable when feasible; a runnable Bun-targeted launcher is acceptable only as an intermediate test fixture, not the final AGENT-91 completion signal.
  - `package.json` — sidecar metadata read before importing Pi. It includes Sandpiper `piConfig` (`name: sandpiper`, `configDir: .sandpiper`, `bin: sandpiper`) and intentionally does not declare `pi.extensions`, `pi.skills`, `pi.prompts`, or `pi.themes`; resources are loaded through explicit factories/resource discovery.
  - `README.md` / `CHANGELOG.md` where present.
  - `extensions/`, `skills/`, `prompts/`, `themes/` — copied resource roots used by `createSandpiperExtensionFactories(...)` and `resources_discover`.
  - `packages/` support packages needed by compatibility bridges and package-first adapters, including `packages/core` and `packages/capability-autotoon`.
  - `dist/modes` and `dist/core` — Pi internal assets copied or linked into the sidecar package layout so Pi interactive/export flows keep working.
  - native/data sidecars required by the executable. These must be shipped intentionally, not by copying a whole source-tree `node_modules/` directory.

Runtime rules:

- The executable resolves its resource root and package metadata relative to the app-bundle directory by default. Development overrides such as `SANDPIPER_STANDALONE_RESOURCE_ROOT` and `SANDPIPER_STANDALONE_PACKAGE_DIR` may remain for tests and dogfooding.
- The app bundle must preserve Sandpiper identity/config behavior through Pi's package metadata before importing `@mariozechner/pi-coding-agent`.
- It must not require a bare `sandpiper` executable on `$PATH`, a configured legacy Sandpiper Pi package, or the source repo root.
- It must not ship a full copied `node_modules/`; if Bun-native or `createRequire(...)` assets need filesystem support, copy only the known asset paths needed by the compiled/bundled runtime and document them in the assembler.

AGENT-91 completion signal:

- `bun run build:standalone-app` (or the final script name chosen during implementation) writes `dist/standalone-sandpiper/`.
- A smoke test runs the app-bundle executable from that artifact with temp Sandpiper agent/config directories.
- Help output proves Sandpiper identity flags load, neutral capability tools/resources load from the artifact, and the executable does not rely on root `pi.extensions` / `pi.skills` manifest entries.
- The standalone asset requirements and known sidecars are documented in the build docs or package README.

AGENT-91 implementation results:

- Added `devtools/standaloneSandpiperApp.ts` as the standalone app-bundle assembler and executable build script.
- Added `dist/standalone-sandpiper/` as the local app-bundle artifact root.
- Added `bun run prepare:standalone-app`, `bun run build:standalone-app`, and `bun run test:standalone-app`.
- The compiled app bundle resolves package metadata/resources relative to `dirname(process.execPath)`, while source/dogfood mode keeps the existing env overrides and generated `dist/standalone-package/` sidecar.
- `deferred_pi_import.ts` keeps Pi behind a local dynamic-import boundary so Sandpiper package metadata is configured before Pi's module-level constants are evaluated.
- `css-tree` remains external in the dogfood JS bundle, but the app-bundle build plugin rewrites its JSON/package metadata modules to static imports so `css-tree/data/patch.json` and `css-tree/package.json` are bundled into the executable. Optional `canvas` remains external; jsdom treats it as unavailable without requiring a native sidecar.

AGENT-91 verification is anchored by:

```bash
bun run test:standalone-app
bun run test:distribution
```

#### Claude Code plugin target

The local Claude Code plugin artifact lives at `dist/claude-plugin/`. It is a transition artifact used to prove Claude-compatible packaging and adapter seams before the repository fully moves source resources under package directories.

Artifact shape:

- root `.claude-plugin/marketplace.json`
  - validates as a Claude marketplace manifest
  - points the `sandpiper-neutral` plugin at npm package `sandpiper-claude-code-plugin`
- `dist/claude-plugin/.claude-plugin/plugin.json`
  - `name`: `sandpiper-neutral`
  - `skills`: `./skills/sandpiper/` and `./skills/third-party/`
  - `commands`: `./commands/`
  - `themes`: `./themes/`
  - `hooks`: `./hooks/hooks.json`
  - includes author/homepage/repository/license metadata for Claude validation and attribution
  - no Sandpiper system prompt, Pi package metadata, or `piConfig`
- `dist/claude-plugin/package.json`
  - `name`: `sandpiper-claude-code-plugin`
  - `type`: `module`
  - no `private`
  - includes npm `files` metadata so `npm pack` includes the Claude manifest/resources and excludes unrelated workspace files
- `dist/claude-plugin/hooks/hooks.json`
  - declares Claude Code plugin hooks, starting with the AutoTOON `PostToolUse` hook
  - invokes bundled hook scripts with `${CLAUDE_PLUGIN_ROOT}` paths
- `dist/claude-plugin/hooks/autotoon-post-tool-use.js`
  - bundles Claude hook glue that rewrites eligible tool output through the host-neutral AutoTOON core
- `dist/claude-plugin/skills/`
  - copies first-party and vendored skills using Claude's plugin skill directory layout
  - materializes generated skill scripts instead of preserving source-tree symlinks to external workspace paths
- `dist/claude-plugin/commands/`
  - copies compatible Sandpiper prompt templates as Claude command files
- `dist/claude-plugin/bin/`
  - includes neutral helper CLIs such as `sandpiper-tasks`, `sandpiper-standup`, and `dash` for skills that invoke bundled scripts

Initial Claude adapter scope:

- Expose the package-first AutoTOON core as a Claude `PostToolUse` hook so conversion remains automatic rather than becoming a manual MCP tool.
- Keep Claude hook configuration, command entrypoints, and event-shape mapping in `packages/adapter-claude-code/`.
- Do not expose Pi extension factories, Pi lifecycle hooks, Sandpiper identity hooks, or migration flags through the Claude plugin.
- Defer MCP tools until a capability has a host-neutral core and a clear reason to add a Claude model-facing tool. Shell Relay is the likely first candidate for a future MCP adapter; `web_fetch` and background-process tools overlap Claude built-ins.

Completion signal:

- `bun run build:claude-plugin` writes `dist/claude-plugin/` with the manifest, resources, helper binaries, hook configuration, and bundled hook scripts.
- A local plugin smoke test validates Claude path rules, publishable package metadata, self-contained helper binaries, hook references, and marketplace metadata without touching real Claude user state.
- A hook smoke test executes the bundled AutoTOON hook with a representative `PostToolUse` payload.
- `bun run test:distribution` includes the Claude plugin checks alongside the neutral Pi package and standalone app gates.

Implementation results:

- Added `devtools/claudeCodePlugin.ts` as the Claude plugin assembler and hook bundler.
- Added `dist/claude-plugin/` as the local Claude plugin artifact root.
- Added `packages/adapter-claude-code/` as the Claude-specific hook adapter package.
- The initial Claude adapter exposes AutoTOON as a `PostToolUse` hook by calling the host-neutral `sandpiper-capability-autotoon` core.
- The plugin assembly copies Claude-compatible skills, command files, themes, helper CLIs, and generated skill scripts without preserving source-tree symlinks to the workspace.
- The generated plugin package is named `sandpiper-claude-code-plugin`, is not private, carries author/homepage/repository/license metadata, and validates with `claude plugin validate dist/claude-plugin`.
- Added root `.claude-plugin/marketplace.json` so `claude plugin marketplace add ...` can discover the npm-sourced plugin package; it validates with `claude plugin validate .`.
- Added `bun run prepare:claude-plugin`, `bun run build:claude-plugin`, and `bun run test:claude-plugin`.
- Wired Claude plugin checks into `bun run test:distribution`.

Verification is anchored by:

```bash
bun run test:claude-plugin
bun run test:distribution
```

#### AGENT-150 ecosystem install certification target

AGENT-150 shores up release/install compatibility before AGENT-93 retires the legacy root assembly. The goal is to make installability a tested invariant rather than an assumption from local builds.

Certified paths:

| Install path | Source root | Current gate |
| --- | --- | --- |
| `pi install git:github.com/dljsjr/sandpiper-ai` | repository root cloned by Pi | root/package workspace manifests avoid `catalog:` and `workspace:*`; `npm install --ignore-scripts --package-lock=false --dry-run` passes |
| `pi install npm:sandpiper-ai` | npm package published from `dist/` | `dist/package.json` has no `private`, declares npm-compatible runtime deps, references local support packages with `file:`, and uses a `files` whitelist to keep nested generated artifacts out of `npm pack` |
| neutral Pi package | `dist/neutral-pi-package/` | same npm-compatible dependency/file-target checks as `dist/`, without Sandpiper `piConfig` or `sandpiper` bin |
| Claude Code plugin marketplace/npm install | root `.claude-plugin/marketplace.json` and npm package from `dist/claude-plugin/` | `claude plugin validate .` and `claude plugin validate dist/claude-plugin` pass; plugin `npm pack --dry-run` includes `.claude-plugin/plugin.json` |

Implementation results:

- Added ecosystem package tests under `devtools/ecosystemPackage.test.ts` and included them in `bun run test:distribution`.
- Normalized package manifests away from Bun-only dependency protocols while preserving Bun workspace catalogs as non-published version constants.
- Generated Pi package support `package.json` files and local `file:` dependencies for package-owned runtime code copied into package artifacts.
- Pruned stale nested generated artifacts and development scratch/log/PID files from generated package artifacts.
- Added Claude marketplace metadata and publishable plugin package metadata with author/homepage/repository/license attribution.

Manual certification commands:

```bash
bun run prepare:distribution
npm install --ignore-scripts --package-lock=false --dry-run
npm install --ignore-scripts --package-lock=false --dry-run --prefix dist
npm install --ignore-scripts --package-lock=false --dry-run --prefix dist/neutral-pi-package
bun run build:claude-plugin
claude plugin validate .
claude plugin validate dist/claude-plugin
```

### Phase 7 — Retire legacy root assembly

Task: AGENT-93

AGENT-93 is extraction-first: retire the legacy root assembly only after remaining extension implementation logic has package-owned seams. Treat every extension as a package-ownership candidate, including `system`.

Only after those seams exist:

- remove or stop authoring top-level Pi-package resource directories
- simplify root `package.json`
- update build/dev docs
- update repo structure guidance in `AGENTS.md`
- preserve migration guidance for existing users

#### AGENT-156 system ownership boundary slice

AGENT-156 starts with the neutral background-process part of `extensions/system/` because it is already separated from Sandpiper identity behavior.

Implementation target:

- `packages/core/src/background-process-capability.ts` owns host-neutral start/check/completion operations over `ProcessManager`.
- `extensions/system/background-process-tools.ts` remains the Pi adapter: tool names, descriptions, TypeBox schemas, and Pi result formatting.
- `extensions/system/background-process-hooks.ts` remains the Pi lifecycle adapter: context and shutdown event wiring.

Completion signal:

- Extension code no longer calls `ProcessManager.spawn`, `get`, `getCompletedUnacknowledged`, or `acknowledge` directly; those operations live in package-owned code.
- Existing neutral and Sandpiper extension factory behavior is unchanged.

#### AGENT-157 session continuity boundary slice

AGENT-157 moves Sandpiper session startup state and PID-file lifecycle out of the Pi extension implementation while preserving Sandpiper identity behavior.

Implementation target:

- `packages/core/src/session-continuity.ts` owns `SystemRuntimeState`, startup cold-start classification, `SANDPIPER_SESSION_*` env var updates, and PID file create/remove/switch behavior.
- `extensions/system/runtime.ts` is a compatibility re-export from `sandpiper-ai-core`.
- `extensions/system/startup-hooks.ts` remains the Pi adapter: it reads Pi session manager values and delegates to package-owned operations.

Completion signal:

- Extension code no longer owns PID-file helpers, session-current tracking, or cold-start classification logic.
- Existing startup hook and PID lifecycle tests continue to pass.

#### AGENT-158 startup prompt boundary slice

AGENT-158 moves startup prompt context assembly and standup reading out of the Pi extension implementation.

Implementation target:

- `packages/core/src/startup-prompt.ts` owns startup prompt context collection, one-shot startup/cold-start state consumption, standup CLI/file fallback reading, and delegation to `buildSandpiperSystemPrompt`.
- `extensions/system/startup-hooks.ts` remains the Pi adapter: it reads `before_agent_start` context and returns the host-specific system prompt replacement.

Completion signal:

- Extension code no longer imports startup-context collectors/formatters, filesystem standup readers, or `buildSandpiperSystemPrompt` directly.
- Existing startup hook behavior is covered by package tests plus thin adapter tests.

#### AGENT-159 migration controls boundary slice

AGENT-159 moves migration flag and `/migrate-pi` command behavior decisions out of the Pi extension implementation.

Implementation target:

- `packages/core/src/migration-controls.ts` owns migration startup flag validation/results, shell-integration install result shaping, and `/migrate-pi` command result decisions.
- `extensions/system/migration-controls.ts` remains the Pi adapter: flag/command registration, reading Pi flags, console/process-exit behavior, and UI notification/reload calls.

Completion signal:

- Extension code no longer imports migration parsers, scope resolution, shell integration installation, or migration execution directly.
- Existing migration-control behavior is covered by package tests plus thin adapter tests.

#### AGENT-160 diagnostics boundary slice

AGENT-160 moves startup diagnostics planning out of the Pi extension implementation while leaving TUI rendering in the adapter.

Implementation target:

- `packages/core/src/system-diagnostics.ts` owns preflight collection, unmigrated Pi config diagnostics, unhealthy filtering, and offline update-check gating.
- `extensions/system/diagnostics-hooks.ts` remains the Pi/TUI adapter: hook registration, transient chat-container injection, and update banner component rendering.

Completion signal:

- Extension code no longer imports preflight collectors, Pi-config migration detection, or env resolution directly for diagnostics decisions.
- Existing diagnostics behavior is covered by package tests plus thin adapter tests.

#### AGENT-161 system prompt type boundary slice

AGENT-161 removes the last Pi SDK type dependency from package-owned system prompt assembly.

Implementation target:

- `packages/core/src/system-prompt.ts` defines host-neutral prompt option, context-file, and skill shapes for the data it consumes.
- `packages/core/src/startup-prompt.ts` keeps deriving its input type from the core system prompt builder, not from Pi SDK declarations.

Completion signal:

- `packages/core/src/system-prompt.ts`, its tests, and startup prompt glue contain no Pi SDK imports or Pi type aliases.
- Existing prompt assembly behavior is covered by the unchanged package test suite.

#### AGENT-162 shell-relay runtime host boundary slice

AGENT-162 removes the direct Pi API dependency from the shell-relay runtime state machine.

Implementation target:

- `extensions/shell-relay/src/runtime.ts` accepts a structural `RelayRuntimeHost` for persisted relay-session entries.
- `extensions/shell-relay/src/index.ts` remains the Pi adapter that supplies the Pi extension API object and registers tools, commands, and lifecycle hooks.

Completion signal:

- Shell-relay runtime contains no Pi SDK imports or Pi type aliases.
- Existing shell-relay TypeScript checks and distribution gates still pass; full shell-relay tests remain subject to their existing local harness issues.

#### AGENT-163 shell-relay preflight config boundary slice

AGENT-163 removes the direct Pi config-directory lookup from shell-relay preflight checks.

Implementation target:

- `extensions/shell-relay/src/preflight.ts` resolves the default shell-integration location through `sandpiper-ai-core` rather than importing Pi helpers.
- Shell-relay preflight remains a framework-independent preflight checker that returns structural diagnostics.

Completion signal:

- Shell-relay preflight contains no Pi SDK imports or Pi type aliases.
- Existing preflight tests, TypeScript checks, and distribution gates pass.

## Task Breakdown

Because TCL-111 reports a bug in `sandpiper-tasks` subtask creation, this breakdown intentionally uses related top-level tasks rather than `SUBTASK` files.

| Task | Priority | Depends on | Purpose | Completion signal |
| --- | --- | --- | --- | --- |
| AGENT-84 | HIGH | — | Plan package-first multi-distribution refactor. | Plan doc and task breakdown written. |
| AGENT-85 | HIGH | AGENT-84 | Spike standalone Sandpiper CLI using Pi extension factories. | Minimal entrypoint runs with temp config and bundled extension/resource. |
| AGENT-86 | HIGH | AGENT-84 | Introduce host-context path/config abstraction. | Neutral code paths receive typed host context; path tests use temp dirs. |
| AGENT-87 | HIGH | AGENT-86 | Split Sandpiper identity from neutral capabilities. | Neutral Pi-loadable extension set excludes identity/system prompt behavior. |
| AGENT-88 | HIGH | AGENT-87 | Move neutral capabilities/resources under packages. | Source of truth for selected resources lives under `packages/`; old paths generated or bridged. |
| AGENT-89 | HIGH | AGENT-88 | Add distribution invariant checks and smoke tests. | Automated checks catch hardcoded branding/path regressions and validate generated artifacts. |
| AGENT-90 | MEDIUM | AGENT-88, AGENT-89 | Build neutral Pi package distribution artifact. | Local Pi install/load smoke test passes without Sandpiper identity. |
| AGENT-91 | MEDIUM | AGENT-85, AGENT-88, AGENT-89 | Build standalone Sandpiper Bun binary distribution. | App bundle/binary runs and loads identity + neutral capabilities from temp config. |
| AGENT-92 | MEDIUM | AGENT-88, AGENT-89 | Research and build Claude Code plugin distribution. | Plugin format documented; supported resources and Claude adapters load in Claude Code or a faithful local validator. |
| AGENT-150 | HIGH | AGENT-90, AGENT-92 | Certify ecosystem package installation paths. | npm/Pi/Claude install compatibility gates pass for source root, generated Pi artifacts, and Claude marketplace/plugin manifests. |
| AGENT-93 | MEDIUM | AGENT-90, AGENT-91, AGENT-92, AGENT-150 | Retire legacy Pi-oriented root assembly. | Root no longer acts as canonical Pi package; docs and generated artifacts updated. |

## Verification Gates

Every implementation phase should finish with:

- `bun check`
- relevant package tests
- distribution-specific smoke test if a distribution artifact changed
- search-based invariant checks for the behavior being eliminated
- end-to-end exercise through the public CLI/package/plugin interface

Suggested invariant searches:

```bash
rg -n "\.sandpiper|SANDPIPER_|~/.sandpiper" packages/<neutral-package>
rg -n "\.pi|~/.pi|PI_" packages/<neutral-package>
rg -n "ToolDefinition|ExtensionAPI|McpServer|@modelcontextprotocol" packages/<neutral-capability-package>
rg -n "extensions/|skills/|prompts/|themes/" package.json devtools packages
```

The invariant is not "zero matches everywhere" because Sandpiper identity packages and docs will legitimately mention these names. The invariant is zero matches in neutral capability packages except tests that explicitly assert adapter behavior.

## Open Questions

1. **Project config directory API:** Pi exports `getAgentDir()`, but project-local config dir resolution may not be exposed at the right abstraction level. Verify before designing around it.
2. **Bun compile asset model:** Initial AGENT-85 answer: target an app bundle with sidecar `package.json`, assets, and resources first. A true single-file binary remains a later optimization.
3. **Claude adapter shape:** Determine the Claude Code plugin packaging format, hook lifecycle expectations, MCP server lifecycle expectations, and which capability operations should be exposed as hooks or MCP tools.
4. **Existing data migration:** Existing users have `.sandpiper/tasks`, `.sandpiper/standup.md`, and `~/.sandpiper`. Decide when neutral tools should use host config paths versus preserving Sandpiper-branded storage for product compatibility.
5. **CLI naming:** Confirm whether `sandpiper-tasks` remains the CLI name in neutral Pi/Claude distributions or whether aliases are needed.
6. **Package granularity:** Confirm the final package names after the first spike; avoid creating many tiny packages before the boundaries are proven.

## First Implementation Guardrails

- Start from a clean working copy.
- Keep each phase behavior-preserving unless the task explicitly says otherwise.
- Add characterization tests before moving code with existing behavior.
- Prefer compatibility bridges during migration over flag-day moves.
- Do not delete old root resource directories until generated replacements are verified.
- Commit with task references.
