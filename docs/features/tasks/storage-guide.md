# Bundled task storage reference

This reference describes the legacy Trail CLI currently bundled with Sandpiper. It does not describe standalone Trail's version-2 configuration.

The bundled task directory is `<project-root>/.sandpiper/tasks/`. The project root is the current directory or the path supplied through `--dir`.

## Configuration lookup

| Source                                      | Precedence                                            |
| ------------------------------------------- | ----------------------------------------------------- |
| `.sandpiper-tasks.json` at the project root | Wins when the file exists.                            |
| `tasks` inside `.sandpiper/settings.json`   | Used when the first file does not exist.              |
| Built-in defaults                           | Used when neither source supplies task configuration. |

The legacy reader fills missing or wrong-typed values from defaults. It also treats unreadable or invalid JSON as an empty object. This behavior differs from standalone Trail's strict parser.

## Configuration values

The default enabled shape is:

```json
{
  "version_control": {
    "enabled": true,
    "mode": { "branch": "@" },
    "auto_commit": false,
    "auto_push": false
  }
}
```

| Field                         | Default | Meaning                                                                  |
| ----------------------------- | ------- | ------------------------------------------------------------------------ |
| `version_control.enabled`     | `true`  | Enables Trail-managed version control operations.                        |
| `version_control.mode.branch` | `"@"`   | Current branch without `repo`, or the remote default branch with `repo`. |
| `version_control.mode.repo`   | Absent  | An external task repository.                                             |
| `version_control.auto_commit` | `false` | Automatic task commits in a separate checkout.                           |
| `version_control.auto_push`   | `false` | Push after an automatic commit.                                          |

Disabled configuration retains the effective legacy values but skips Trail-managed VCS operations. VCS means a version control system, such as Git or jj. A `tasks` object in `.sandpiper/settings.json` contains the same configuration shape.

## Setup commands

| Command                 | Bundled behavior                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `trail storage init`    | Bootstraps a configured separate branch or external clone. Inline and disabled modes do not require bootstrap. |
| `trail storage migrate` | Moves existing inline tasks into a separate checkout. Do not use it with an external-repository configuration. |
| `trail storage sync`    | Pulls and then pushes task changes.                                                                            |
| `trail storage pull`    | Pulls task changes.                                                                                            |
| `trail storage push`    | Pushes task changes.                                                                                           |

Standalone Trail uses `initialize` instead of `storage init`. Its configuration also requires `version` and `tasks_dir`. These standalone changes are not a Sandpiper consumer cutover.

For the current bundled operator procedures, use the [skill-local storage reference](../../../packages/resources/skills/sandpiper/tasks/references/storage.md).

## Adoption boundary

The planned Sandpiper migration tool emits standalone configuration while keeping task files in their existing directory. It preserves the effective legacy version control values and live workspace registrations.

The tool does not belong in Trail. Its [migration specification](../../../.sandpiper/docs/specs/trail-board-adoption.md) remains in Sandpiper. The consumer installation method and live cutover remain deferred.
