# Tasks in Sandpiper

Sandpiper bundles Trail and the tasks skill for project work tracking. The bundled CLI currently reads `.sandpiper/tasks/`. Standalone Trail uses its own configuration and can select other task directories.

## Bundled interface

The installed tasks skill includes its executable in `scripts/` and its reference files in `references/`. That directory remains usable without a Sandpiper source checkout.

Sandpiper also includes `sandpiper-tasks` as a compatibility command. The `trail` name is the normal interface.

For command usage and task fields, read the references inside the installed tasks skill. The source copies are [the task specification](../../../packages/resources/skills/tasks/references/SPEC.md) and [storage reference](../../../packages/resources/skills/tasks/references/storage.md).

## Integration reference

[Bundled storage configuration](storage-guide.md) describes the legacy filenames and setup command that the current Sandpiper CLI reads. Do not apply standalone initialization instructions to this bundled version.

[Task documentation ownership](architecture.md) explains the boundary between Trail's product documentation and Sandpiper's installed skill.

Related Sandpiper features include [session standup](../standup.md) and the [project directory layout](../../concepts/directory-layout.md).
