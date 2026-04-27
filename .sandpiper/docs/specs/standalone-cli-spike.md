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
