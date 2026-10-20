# Why Trail is separate from Sandpiper

This record explains the Trail extraction and the Sandpiper work that remains. Doug settled the original decisions on 2026-08-12 and ratified paths and initialization flags on 2026-10-06.

Trail's implemented runtime contract now lives in its own documentation. This record is not a second configuration or command reference.

## Original coupling

The extraction survey found no code imports between Trail and the rest of Sandpiper. Trail's five dependencies were third-party packages: `commander`, `@commander-js/extra-typings`, `@toon-format/toon`, `diff`, and `yaml`.

The original coupling came from sixteen path literals for `.sandpiper/tasks`, legacy configuration filenames, build filters, the former release packaging, and documentation. Extracting Trail required a project-root configuration boundary rather than library dependency changes.

The executable was already a portable Node.js bundle. Sandpiper now builds it from `packages/trail/` and copies it directly into the local tasks skill.

Earlier TCL-69 work renamed the public interface but retained the old layout internally. The later standalone work introduced Trail's configuration candidates, exact version matching, configurable task paths, and initialization flags.

## Runtime documentation ownership

The standalone Trail repository owns these documents:

| Trail document                                  | Subject                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `docs/configuration.md`                         | Configuration discovery, version-2 fields, path resolution, and initialization guarantees. |
| `docs/commands.md`                              | Initialization flags and the command surface.                                              |
| `docs/task-format.md` and `docs/consistency.md` | Task files, history, numbering, relationships, and mutation guards.                        |
| `docs/architecture.md`                          | Reasons for complete configuration, one-file precedence, and separate checkouts.           |

These are repository-and-path locators, not dependencies on a local checkout. Trail's docs do not link back to Sandpiper's extraction record.

The configuration candidates, configurable task location, and folded initialization command are implemented. The old example that suggested `trail migrate-config` did not name a real command and is not part of the runtime contract.

## Sandpiper adoption

Sandpiper owns the [board adoption specification](trail-board-adoption.md). The planned tool converts effective legacy configuration into a complete Trail configuration. It keeps task files in their existing directory.

This separates adoption from physical relocation. It also keeps knowledge of Sandpiper's legacy formats outside Trail. The tool must preserve disabled version control, complete effective values, and live task workspaces.

The migration tool must be available before or with consumer cutover. Updating the consumer first leaves existing boards inaccessible to the new configuration reader.

## Local skill helper

Sandpiper retains the legacy Trail package for its workspace runtime. `bun run build` builds `packages/trail/dist/trail`, then copies it to `packages/resources/skills/sandpiper/tasks/scripts/trail`.

The skill's local references describe that legacy executable. They are not the source for new standalone Trail behavior.

## Future consumer changes

The current delivery topology does not publish, vendor, or install Trail from its standalone repository. A future consumer cutover requires a separate design and task. It must change the executable and matching task-skill documentation together.

## Board relocation

Doug approved moving the entire TCL board to Trail, including closed tickets and history. Task keys must remain unchanged. Relocation must account for inbound references.

Relocation waits for consumer and migration prerequisites. In-place adoption does not authorize moving task directories or replacing live jj workspaces.

## Remaining extraction work

TCL-159 covers documentation consolidation. TCL-157 covers Sandpiper's adoption tool. TCL-160 covers the full TCL board relocation. TCL-146 remains the overall extraction and cutover work item.

The migration and consumer work still use this record. It stays active in Sandpiper until the extraction finishes. Archiving it now removes guidance that those work items still need.
