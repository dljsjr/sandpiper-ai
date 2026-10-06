# AGENT-301 build and distribution topology on Pi 1.0

- **Diátaxis mode**: Explanation / proposal
- **Status**: Proposed; D and E done, A and B await Doug's decisions
- **Task**: AGENT-301 (subtask of AGENT-290)
- **Related**: [migration spec](agent-290-pi-1-0-migration-spec.md), [build system reference](../../../docs/dev/build-system.md)

## Current topology

| Artifact                     | Role                                                                                  | Pi dependency shape                                          |
| ---------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Repository root              | Workspace, and a Pi package (`pi` manifest) that stock Pi can load from a path or git | Exact `peerDependencies` (`1.0.4`)                           |
| `plugins/pi/extensions`      | The neutral extension set the root `pi` manifest points at                            | Exact `peerDependencies`                                     |
| `dist/` (`sandpiper-ai`)     | Both the npm CLI (`bin`: `sandpiper` and helpers) and a Pi package (`pi` manifest)    | `pi-ai` and `pi-coding-agent` in `dependencies`, exact peers |
| `dist/standalone-sandpiper/` | Compiled app                                                                          | Bundled                                                      |
| `dist/claude-plugin/`        | Claude Code plugin                                                                    | None                                                         |

Doug runs the uncompiled standalone from the repository, which loads the repository's `node_modules`.

## Problems on Pi 1.0

1. **`dist/` plays two roles that Pi 1.0 treats differently.** As a CLI it needs Pi in `dependencies`. As a Pi package, Pi 1.0 warns when host packages (`pi-ai`, `pi-coding-agent`, `pi-tui`, `pi-agent-core`, `typebox`) appear in `dependencies`, because an installed copy can bypass the extension loader and create duplicate runtime modules (`collectExtensionPackageWarnings` in Pi's `resource-loader.ts`).
2. **Exact peer pins block other host versions.** Pi asks Pi packages to declare host packages as `peerDependencies` with a `"*"` range. With an exact `1.0.4` peer, npm refuses to install Sandpiper as a package into a host Pi of any other version. The repository's dependency policy (`bun run check:deps`) requires exact versions everywhere.
3. **The local Pi patch reaches only some artifacts.** `patchedDependencies` applies when this repository installs its own dependencies. The patch is in effect for the repository standalone, which is Doug's daily driver, and for the compiled app, which bundles the patched files. It is not in effect for an npm-installed `sandpiper-ai`, whose consumers install unpatched Pi. Sandpiper loaded as a package into stock Pi uses the host's Pi by design.
4. **The Pi asset copy is larger than needed.** Distribution copies all of Pi's `dist/modes` and `dist/core` (8.6 MB) into `dist/dist/` so that Pi finds its assets under `PI_PACKAGE_DIR`. Pi resolves only three directories there: `dist/modes/interactive/theme`, `dist/modes/interactive/assets`, and `dist/core/export-html`, about 1.2 MB together (`getThemesDir`, `getInteractiveAssetsDir`, and `getExportTemplateDir` in Pi's `config.ts`).
5. **`devtools/clean.ts` misses build state.** It does not remove `.turbo`, and it stops recursing four levels deep.

## Proposal

| Change                                                                                                                                                               | Needs a decision |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| A. Make `dist/` a CLI-only package: keep Pi in `dependencies` and drop the `pi` manifest. Stock Pi keeps loading Sandpiper from the repository root.                 | Yes (decision 1) |
| B. Declare host packages as `"*"` peers in the Pi-package manifests (repository root and `plugins/pi/extensions`), as a named exception to the exact-version policy. | Yes (decision 2) |
| C. Record that the local Pi patch applies to repository runs and the compiled app only. Revisit if npm distribution ever becomes a goal.                             | No               |
| D. Copy only the three Pi asset directories Pi resolves under `PI_PACKAGE_DIR`, and fail the distribution gate if Pi starts looking elsewhere.                       | No               |
| E. Make `clean.ts` remove `.turbo` and recurse without a depth limit (it already skips `node_modules` and hidden directories).                                       | No               |

### Decision 1: does `dist/` stay a Pi package?

Recommended: no. As far as the repository and Doug's settings show, nothing installs `sandpiper-ai` from npm into stock Pi. The repository root already serves that role, without the dependency warning. Keeping both roles in one manifest means Pi in `dependencies` for the CLI and a warning for the package; splitting them would add a fourth artifact to build and test.

### Decision 2: `"*"` peers for Pi-package manifests?

Recommended: yes, for the repository root and `plugins/pi/extensions` only, enforced by a Syncpack rule that names them. Exact pins in those two manifests do not control which Pi version runs: the host provides it. They only make installs into other Pi versions fail. Every other manifest keeps exact versions.

## Status

- D and E are done (2026-10-06). The distribution gate passes, `dist/dist/` is down to 1.2 MB, and the built `dist/sandpiper` starts its TUI and exports a session to HTML from the narrowed assets.
- A and B wait on the two decisions; each lands as its own change.
- C is one line in `docs/dev/build-system.md`, written with A.
