# Trail board adoption specification

This specification covers TCL-157. Sandpiper implements the utility in `devtools/adoptTrailBoard.ts`. Its planning and writing module is `devtools/trailBoardAdoption.ts`.

The tool adopts existing boards in place. It does not move tasks, rewrite their Markdown, or replace their version control workspace.

## Interface

The interface accepts these values:

| Value           | Purpose                                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| `--dir`         | Project root for discovery and output. Defaults to the current directory.                                             |
| `--tasks-dir`   | Required existing task directory. Relative values resolve against the project root. Absolute values remain supported. |
| `--config-file` | Optional override for the legacy configuration source.                                                                |
| `--dry-run`     | Report the planned configuration without changing files or VCS state.                                                 |

VCS means a version control system, such as Git or jj.

The output is `<project-root>/.trail/config.json`. It uses Trail's version-2 schema and points `tasks_dir` at the existing task directory. `.sandpiper/tasks` is the usual legacy location, not an implicit choice by the utility.

The CLI reports JSON with the result, selected source, task directory, configuration path, existing candidates, and complete configuration. An already-adopted result identifies the existing configuration file. Usage and recovery cover operator commands.

## Legacy discovery

Without an override, discover the legacy sources in their existing precedence:

1. `.sandpiper-tasks.json` at the project root.
2. The `tasks` value in `.sandpiper/settings.json`.
3. Effective legacy defaults when neither source supplies task configuration.

An existing higher-priority source wins. The tool carries forward the effective configuration rather than treating a partial file as a complete schema.

An explicit override can contain a standalone `version_control` object or a settings wrapper with `tasks`. Ambiguous overrides cause an error. Malformed selected sources and unsupported shapes cause an error rather than the old reader's silent fallback. Valid partial values still use legacy defaults.

## Configuration preservation

The emitted file must contain `version`, `tasks_dir`, and a complete `version_control` object. Its values must preserve the effective legacy behavior.

When version control is enabled, preserve the branch, optional repository, automatic commit value, and automatic push value. Supply missing legacy values according to the legacy reader's rules, not fresh standalone initialization defaults.

When version control is disabled, emit exactly `{ "enabled": false }` inside `version_control`. In particular, `herdr` must remain disabled.

The task directory must pass Trail's path and separate-checkout safety rules. Separate storage requires an existing checkout and a matching Git or jj backend at the project root. A marked independent checkout cannot silently become inline storage through default filling.

## File and workspace preservation

Adoption preserves:

- Task and project Markdown bytes, including descriptions and activity logs.
- Task keys, allocated numbers, moved-task records, and archived tasks.
- History diffs and the existing task directory.
- Live workspace registrations, branches, and effective automatic-operation values.

An existing index does not need rewriting merely because the configuration changes. If implementation requires a rewrite, make sure that each consumer can read the resulting format first. Do not assume that adoption needs an index-format migration.

## Existing configuration and repeat runs

The tool inspects all three Trail candidates: `.trail.json`, `trail.json`, and `.trail/config.json`. Every existing candidate must be valid and equivalent to the requested task location and effective VCS values. Conflicting or malformed candidates cause refusal, even when a higher-priority candidate shadows them.

A repeat against equivalent configuration makes no changes. Path comparison uses physical directory locations, so equivalent relative and absolute paths do not require a rewrite.

Apply rechecks configuration bytes and directory identities before writing and before installation. It stages complete JSON and uses an exclusive hard-link installation instead of an overwriting rename. The destination filesystem must support hard links. Failed installation does not replace existing configuration.

Dry runs do not create directories, reserve keys, repair indexes, or change VCS state. The utility runs no VCS commands.

## Survey constraints

The 2026-08-12 survey found twelve boards. Eleven had a legacy storage configuration. Five had partial values, so conversion needs the effective legacy configuration rather than a direct file copy.

`herdr` stored its disabled configuration in `.sandpiper/settings.json`, not `.sandpiper-tasks.json`.

Seven task directories were live jj workspaces: `navigator`, `pi-claude-code-cli-provider`, `reinforced-guidance`, `sandpiper-ai`, `task-storage-spike`, `waymark`, and `yaams`. `reinforced-guidance` and `waymark` enabled automatic commits.

These facts are a migration inventory, not permission to change live stores.

## Verification requirements

Use copies of configured boards before any live adoption. Make sure that:

- The emitted file parses with Trail's strict version-2 parser.
- Task, project, history, and retained index bytes remain unchanged.
- Workspace registration, branch, and effective VCS configuration remain intact.
- Task-list counts stay unchanged, including a repeat run.
- Dry runs and conflicting destinations leave no changes.

Preserved on-disk and VCS state is the evidence. Successful exit codes or output alone are not enough.

## Cutover boundary

The migration tool must be available before or with consumer cutover. Consumer packaging remains deferred. Physical TCL board relocation is separate and must preserve the complete board history and inbound references.

The [extraction record](trail-extraction-design.md) explains the ownership and ordering decisions.
