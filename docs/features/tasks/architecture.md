# Task documentation ownership

Trail owns the task file format, commands, configuration, consistency rules, and storage design. Its standalone repository contains the authored product documentation under `docs/`.

Sandpiper owns the tasks skill, compatibility entrypoint, distribution assembly, and adoption of its existing boards. Its public task pages describe those integration boundaries rather than maintaining another Trail manual.

## Self-contained skills

A skill can be installed without its surrounding repository. Its directory includes `SKILL.md`, scripts, and references. A reference to a file elsewhere in the source repository does not survive that installation.

The installed skill therefore needs local documentation copies. Those copies are distribution artifacts, not independent sources that maintainers edit in parallel. Assembly must obtain the executable and its matching documentation from the same Trail revision.

This separates two concerns. Trail authors one product manual. Sandpiper distributes the parts that the skill needs, with links that stay inside the skill directory.

The [assembly contract](../../../.sandpiper/docs/specs/trail-skill-assembly.md) records this boundary. Its implementation and the CLI installation method remain deferred.

## Legacy bundle

The current bundled executable still uses Sandpiper's old storage layout and configuration reader. Its package documentation and skill references remain local legacy copies until the consumer changes. Replacing them with standalone initialization instructions before that change describes the wrong executable.

The [bundled storage reference](storage-guide.md) covers the integration differences. The extraction record and migration specification remain in Sandpiper because they describe Sandpiper's transition, not Trail's runtime.
