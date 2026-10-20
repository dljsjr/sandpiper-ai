# Task documentation ownership

Trail owns the task file format, commands, configuration, consistency rules, and storage design. Its standalone repository contains the current product documentation under `docs/`.

Sandpiper owns its tasks skill, local legacy Trail package, helper executable copy, and adoption of existing Sandpiper boards. Sandpiper's public task pages describe these integration boundaries instead of maintaining a second Trail product manual.

## Local skill helper

The tasks skill runs `packages/resources/skills/sandpiper/tasks/scripts/trail`. This executable is a generated local copy of `packages/trail/dist/trail`.

Run `bun run build` after Trail changes. The build compiles Trail first, then refreshes the skill helper copy. Both the package docs and skill references must describe the bundled legacy runtime.

## Legacy bundle

The bundled executable still uses Sandpiper's old storage layout and configuration reader. Its package documentation and skill references remain local legacy copies. Standalone Trail initialization instructions do not apply to this executable.

The [bundled storage reference](storage-guide.md) covers the integration differences. The extraction record and migration specification remain in Sandpiper because they describe Sandpiper's transition, not Trail's runtime.
