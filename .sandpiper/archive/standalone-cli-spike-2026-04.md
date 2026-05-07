# Standalone Sandpiper CLI Spike

Status: In progress  
Owner task: AGENT-85  
Initial inventory subtask: AGENT-94

## Purpose

This spike validates whether Sandpiper can become a standalone app entrypoint built on Pi 0.70.x instead of relying on the repository root being a Pi package.

The spike should answer:

1. Can a Sandpiper entrypoint call Pi `main(args, { extensionFactories })` directly?
2. Can Sandpiper identity/config branding be active without the root package acting as a Pi package?
3. Can bundled extensions/resources load without root `pi.extensions` / `pi.skills` manifest entries?
4. What does `bun compile` require for package metadata and assets?

## Pi API Inventory

### `main(args, options)`

Pi exports:

```ts
interface MainOptions {
  extensionFactories?: ExtensionFactory[];
}

function main(args: string[], options?: MainOptions): Promise<void>;
```

Important behavior from Pi 0.70.2 implementation:

- `main()` parses CLI args and owns interactive/print/RPC mode selection.
- `options.extensionFactories` is forwarded into `createAgentSessionServices()` through `resourceLoaderOptions.extensionFactories`.
- Inline extension factories are loaded by `DefaultResourceLoader.loadExtensionFactories()` as pseudo-paths like `<inline:1>`.
- `main()` does **not** accept additional skills/prompts/themes as direct options.
- Resource paths can still be supplied by prepending CLI args:
  - `--skill <path>`
  - `--prompt-template <path>`
  - `--theme <path>`
  - `--extension` / `-e <path>`
- Help (`--help`) creates the runtime/resource loader before printing so extension-registered flags can appear in help output.

### Resource loading seams

`DefaultResourceLoaderOptions` supports:

- `additionalExtensionPaths`
- `additionalSkillPaths`
- `additionalPromptTemplatePaths`
- `additionalThemePaths`
- `extensionFactories`
- override callbacks for extensions, skills, prompts, themes, agents files, system prompt, and appended system prompt

Since `main()` exposes only `extensionFactories`, a standalone app has two viable root-manifest-free resource strategies:

1. **Prepend CLI resource flags** before calling `main()`.
   - Simple.
   - Uses existing Pi CLI semantics.
   - Treats bundled resources as temporary CLI resources.
   - Works for skills/prompts/themes/extensions.

2. **Use an inline extension factory that handles `resources_discover`.**
   - The extension returns `skillPaths`, `promptPaths`, and `themePaths` after `session_start`.
   - Pi calls `resourceLoader.extendResources()` and rebuilds the system prompt.
   - This proves resource injection without root `pi.skills` / `pi.prompts` / `pi.themes`.
   - Resource metadata source for inline extensions is a pseudo-path such as `<inline:1>`, so source labels may be less user-friendly unless Pi gains richer inline metadata.

A third option is to bypass `main()` and build the runtime with SDK APIs plus `DefaultResourceLoader`, but that would require reimplementing more CLI behavior. It is out of scope for the first spike unless `main()` proves insufficient.

### Branding and config directory behavior

Pi's branding/config constants are computed in `dist/config.js` at module import time:

- `APP_NAME` = `packageJson.piConfig.name` or `"pi"`
- `APP_TITLE` = app name or `"π"`
- `CONFIG_DIR_NAME` = `packageJson.piConfig.configDir` or `.pi`
- `ENV_AGENT_DIR` = `${APP_NAME.toUpperCase()}_CODING_AGENT_DIR`
- `getAgentDir()` returns `process.env[ENV_AGENT_DIR]` or `join(homedir(), CONFIG_DIR_NAME, "agent")`

`getPackageDir()` determines which `package.json` is read:

- `PI_PACKAGE_DIR` override if set
- Bun binary: `dirname(process.execPath)`
- Node/source runtime: walks up from Pi's `dist/` directory to the Pi package root

Implication: **for development/source entrypoints, `PI_PACKAGE_DIR` must be set before importing `@mariozechner/pi-coding-agent`** if we want Pi's constants to read Sandpiper's package metadata. A static ESM import of `main` happens before the wrapper body runs, so setting `PI_PACKAGE_DIR` after a static import is too late for `APP_NAME` / `CONFIG_DIR_NAME`.

Potential entrypoint patterns:

1. **Compiled app bundle path**
   - Place a Sandpiper `package.json` with `piConfig` next to the executable.
   - For Bun binaries, Pi's `getPackageDir()` uses `dirname(process.execPath)`, so this may avoid `PI_PACKAGE_DIR` entirely.

2. **Development/source bootstrap path**
   - Set `PI_PACKAGE_DIR` before loading Pi.
   - This likely requires either a shell/process wrapper or a tiny async bootstrap with dynamic `import()`.
   - Dynamic import should be treated as entrypoint bootstrapping, not a general application-code pattern.

3. **Current static-import wrapper path**
   - Insufficient for full Pi-level rebranding if `PI_PACKAGE_DIR` is assigned after importing Pi.
   - It can still set Pi behavior controls and Sandpiper env mirroring, but Pi branding constants may already be frozen.

### Env var implications

With `piConfig.name = "sandpiper"`, Pi's own agent-dir override env var becomes:

```text
SANDPIPER_CODING_AGENT_DIR
```

This differs from some existing Sandpiper helper conventions around `SANDPIPER_AGENT_DIR`. The host-context refactor should avoid spreading either string through neutral packages and should decide compatibility/mirroring in the Sandpiper identity/CLI adapter.

### Resource discovery lifecycle

Pi calls extension `resources_discover` handlers after `session_start` during `AgentSession.bindExtensions()`:

1. extension factories load during resource-loader reload
2. session binds extensions
3. `session_start` fires
4. `resources_discover` fires with `{ cwd, reason: "startup" | "reload" }`
5. returned resource paths are added to the resource loader
6. Pi rebuilds the system prompt

This means a standalone app can use an inline extension factory to contribute resources even when no package manifest declares them.

## Spike Subtasks

| Subtask | Purpose | Expected output |
| --- | --- | --- |
| AGENT-94 | Inventory Pi standalone entrypoint and resource APIs. | This API inventory. |
| AGENT-95 | Add minimal standalone entrypoint with inline extension factory. | A runnable experimental entrypoint proving `main(args, { extensionFactories })`. |
| AGENT-96 | Prove bundled resource discovery without root Pi manifest. | Inline/resource-flag resource loading test or smoke command. |
| AGENT-97 | Evaluate Bun compile asset and package metadata behavior. | Document whether the first deliverable is single binary or app bundle. |
| AGENT-98 | Document standalone CLI spike findings. | Final recommendation and follow-up tasks. |

## Initial Recommendation

Start the implementation spike with a deliberately small development entrypoint that:

1. resolves the Sandpiper package root
2. sets `PI_PACKAGE_DIR` before loading Pi
3. dynamically imports `main` from `@mariozechner/pi-coding-agent`
4. passes one inline extension factory that registers a harmless flag or command
5. prepends or discovers one bundled skill path without relying on root `pi.skills`

If this works, the standalone distribution can keep using Pi's CLI mode handling while Sandpiper focuses on adapter/resource assembly rather than recreating Pi's runtime.

## AGENT-95 Result: Minimal Inline Extension Entrypoint

Added `packages/cli/standalone_spike.ts` as an experimental entrypoint.

Key properties:

- no static runtime import from `@mariozechner/pi-coding-agent`
- sets `PI_PACKAGE_DIR` before dynamically importing Pi
- calls `main(process.argv.slice(2), { extensionFactories: [...] })`
- registers a harmless `--standalone-spike` flag from an inline extension factory

Smoke command:

```bash
SANDPIPER_CODING_AGENT_DIR="$(mktemp -d)/agent" \
  bun run --bun packages/cli/standalone_spike.ts \
  --help --no-extensions --no-skills --no-prompt-templates --no-themes --no-context-files
```

Observed result: Pi help output includes `--standalone-spike`, proving that the standalone entrypoint can inject an inline extension factory through `main()` without using root `pi.extensions`.

## AGENT-96 Result: Resource Discovery Without Root Pi Manifest

Extended `packages/cli/standalone_spike.ts` so its inline extension also handles `resources_discover` and returns a bundled fixture skill path:

```text
packages/cli/fixtures/standalone-spike-skills/standalone-spike/SKILL.md
```

Added `packages/cli/standalone_resource_probe.ts` as a non-interactive probe that uses Pi SDK APIs with temp agent state:

1. sets `PI_PACKAGE_DIR` before importing Pi
2. creates a `DefaultResourceLoader` with `extensionFactories`
3. disables default extension/skill/prompt/theme/context discovery
4. creates an in-memory session
5. calls `session.bindExtensions({})` to fire `session_start` and `resources_discover`
6. asserts `resourceLoader.getSkills()` contains the fixture skill name `standalone-spike`

Smoke command:

```bash
bun run --bun packages/cli/standalone_resource_probe.ts
```

Observed result:

```text
Loaded skill via resources_discover: standalone-spike
```

This proves bundled resource discovery can work without root `pi.skills` manifest entries. The current proof still uses a repo-root package directory for Pi branding/asset lookup; the later Bun/package-metadata subtask evaluates replacing that with an app-bundle package directory.

## AGENT-97 Result: Bun Compile and Package Metadata

Compiled the spike entrypoint with Bun:

```bash
bun build --compile packages/cli/standalone_spike.ts --outfile .tmp-standalone-spike/sandpiper-spike
```

Observed behavior:

- The compiled binary was about 70 MB in this workspace.
- Without a real filesystem repo/package root override, the current spike cannot discover the repo root because `import.meta.url` resolves inside Bun's virtual filesystem (`/$bunfs/root`).
- Providing `SANDPIPER_SPIKE_REPO_ROOT=$PWD` lets the spike find bundled fixture resources during the experiment.
- Providing `SANDPIPER_SPIKE_PACKAGE_DIR=$PWD/.tmp-standalone-spike` lets the spike point Pi at an app-bundle sidecar `package.json`.
- A sidecar `package.json` containing only `name`, `version`, `type`, and `piConfig` was sufficient for `--help` and `--version` smoke tests.
- `--version` returned the sidecar package version (`0.0.0`), proving Pi read package metadata from the app-bundle package directory rather than the upstream Pi package.
- `--help` included `--standalone-spike`, proving the compiled binary still injected the inline extension factory.

Smoke commands:

```bash
cat > .tmp-standalone-spike/package.json <<'JSON'
{
  "name": "sandpiper-standalone-spike",
  "version": "0.0.0",
  "type": "module",
  "piConfig": {
    "name": "sandpiper",
    "configDir": ".sandpiper"
  }
}
JSON

SANDPIPER_SPIKE_REPO_ROOT="$PWD" \
SANDPIPER_SPIKE_PACKAGE_DIR="$PWD/.tmp-standalone-spike" \
SANDPIPER_CODING_AGENT_DIR="$(mktemp -d)/agent" \
  .tmp-standalone-spike/sandpiper-spike --help \
  --no-extensions --no-skills --no-prompt-templates --no-themes --no-context-files

SANDPIPER_SPIKE_REPO_ROOT="$PWD" \
SANDPIPER_SPIKE_PACKAGE_DIR="$PWD/.tmp-standalone-spike" \
SANDPIPER_CODING_AGENT_DIR="$(mktemp -d)/agent" \
  .tmp-standalone-spike/sandpiper-spike --version
```

Recommendation: treat the first standalone deliverable as an **app bundle**, not a true single-file binary. The bundle should include:

- compiled executable
- sidecar `package.json` with Sandpiper `piConfig`
- Pi assets required by interactive/export flows
- Sandpiper resources/skills/prompts/themes
- any helper binaries or MCP/plugin assets needed by adapters

A true single-file binary would require either embedding resources into the executable and teaching adapters to read from Bun's virtual filesystem, or generating runtime temp files. That is possible but should not be the first target.

## Dogfood Standalone CLI MVP Contract

Owner task: AGENT-99  
MVP contract subtask: AGENT-100

The next vertical slice converts the spike into a dogfoodable standalone CLI target while keeping the existing `sandpiper-dev` wrapper intact.

The MVP is intentionally narrow:

- provide an explicit local development command that cannot be confused with any `sandpiper` shell script on `$PATH`
- set Pi package metadata before importing Pi
- load Sandpiper's current identity/capability extensions through explicit factories, not root `pi.extensions`
- load existing skills/prompts/themes through explicit resource discovery, not root `pi.skills` / `pi.prompts` / `pi.themes`
- run with temp config dirs in smoke tests
- leave package moves and neutral capability extraction for later tasks

Acceptance checks:

1. source dogfood command shows extension-provided CLI help (`--migrate-pi-configs` from the existing system extension)
2. source dogfood command can list/use bundled resources without relying on root Pi manifest entries
3. dogfood command is invoked by explicit path/script, never by bare `sandpiper` from `$PATH`
4. existing `bun run sandpiper-dev -- --version` still works
5. `bun check` passes

Non-goals:

- do not remove or replace `packages/cli/pi_wrapper.ts` yet
- do not implement the final app-bundle build in this slice
- do not move top-level `extensions/`, `skills/`, `prompts/`, or `themes/`
- do not solve Claude/MCP adapter packaging in this slice

## Final AGENT-85 Findings

The AGENT-85 spike validated the core standalone direction.

Confirmed:

- Pi `main(args, { extensionFactories })` is sufficient for a standalone Sandpiper entrypoint to inject Pi extension factories without root `pi.extensions`.
- Inline extensions can contribute bundled resource paths through `resources_discover`, proving resource discovery does not require root `pi.skills` manifest entries.
- Pi package metadata and branding are read from the package directory at module-import time, so a development/source entrypoint must set `PI_PACKAGE_DIR` before importing Pi.
- A compiled Bun executable can run the same entrypoint when supplied an app-bundle package directory containing sidecar `package.json` metadata.
- The first standalone distribution should be an app bundle, not a single-file binary.

Not yet solved:

- replacing repo-root resource lookup with app-bundle-relative resource lookup
- copying/symlinking Pi interactive/export assets into the standalone bundle
- converting this spike entrypoint into production CLI package structure
- deciding compatibility/mirroring between `SANDPIPER_CODING_AGENT_DIR` and existing Sandpiper env conventions
- removing dependency on root `package.json` as the source of Sandpiper `piConfig`

Recommended next implementation sequence:

1. Convert the spike into a production `packages/cli` bootstrap that sets package metadata before loading Pi.
2. Introduce a distribution app-bundle layout with sidecar `package.json`, assets, and resource roots.
3. Move resource discovery from spike fixtures to package-owned Sandpiper resource manifests.
4. Add invariant/smoke tests that run source and compiled entrypoints with temp config directories.
5. Only after that, start moving neutral capabilities/resources under `packages/`.

Follow-up tasks:

- AGENT-86 should consume the env/config findings when introducing host context.
- AGENT-91 should use the app-bundle recommendation as its starting point.
- AGENT-89 should add automated versions of the source help, resource probe, and compiled app-bundle smoke checks.

## AGENT-99 Dogfood CLI MVP Result

The spike was promoted into a dogfoodable vertical slice while keeping the existing `sandpiper-dev` wrapper intact.

Added production-shaped source files:

- `packages/cli/sandpiper_standalone.ts` — dogfood standalone entrypoint
- `packages/cli/standalone_bootstrap.ts` — package-root and Pi environment bootstrap helpers
- `packages/cli/sandpiper_resources.ts` — explicit Sandpiper extension/resource factory adapter

Added scripts:

```bash
bun run sandpiper-standalone-dev -- --help
bun run build:standalone
bun run sandpiper-standalone-built -- --help
bun run test:standalone
```

Testing note: invoke these scripts or explicit file paths. Do not test with bare `sandpiper`, because the user's `$PATH` may resolve to a different shell script or installed binary.

The dogfood entrypoint currently:

- sets Pi package metadata before dynamically importing Pi
- loads existing Sandpiper system, shell-relay, web-fetch, and autotoon extensions via `extensionFactories`
- contributes existing `skills/sandpiper`, `skills/third-party`, `prompts`, and `themes` paths via a resource-discovery extension
- supports temp config dirs through `SANDPIPER_CODING_AGENT_DIR`

The dogfood build target emits a Bun-targeted JS bundle under `packages/cli/dist/standalone/`. This is not the final app-bundle distribution. `css-tree` is externalized for now because the web-fetch/jsdom dependency path hits Bun issue <https://github.com/oven-sh/bun/issues/13076>: `css-tree` loads `../data/patch.json` through `createRequire(import.meta.url)`, and Bun can fail to resolve/bundle that JSON asset even with `--target=bun`.

Verified MVP checks:

- `bun run test:standalone`
- `bun check`
- `bun run sandpiper-standalone-dev -- --help --no-extensions --no-skills --no-prompt-templates --no-themes --no-context-files`
- `bun run build:standalone`
- `bun run sandpiper-standalone-built -- --help --no-extensions --no-skills --no-prompt-templates --no-themes --no-context-files`
