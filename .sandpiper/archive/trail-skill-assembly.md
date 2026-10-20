# Trail skill assembly contract

Doug approved this documentation distribution boundary during TCL-159. Assembly implementation and the CLI installation method remain deferred.

The installed tasks skill must work without a Trail or Sandpiper source checkout. It needs local reference files, not links to documentation elsewhere in those repositories.

## Authored source and distributed copies

Trail's standalone repository owns the authored product docs. Sandpiper owns the task skill's operational instructions and integration behavior.

Assembly includes copies of the required Trail docs inside the skill's `references/` directory. These are generated distribution artifacts. Maintainers edit the authored source, not a second product manual in Sandpiper.

`SKILL.md` can point to these local copies. It must not require another checkout, a machine-specific path, or a hosted product manual to explain its normal task operations.

## Matching executable and documentation

The CLI and documentation must come from the same Trail source revision. Matching only the package version is not enough when several source revisions share that version.

The assembly input must identify that revision. The assembled result must retain enough provenance to make sure that the executable and reference files match.

This contract does not select bundling, an installed executable link, vendoring, or another consumption method. Those choices remain deferred.

## Reference closure

The reference closure is every local document that a copied page links to. Assembly must include the whole closure or adapt those links to included skill-local pages.

Preserving the source layout is one option. For example, a copied Trail `README.md` and its `docs/` directory can stay together below `references/`. Copying only one page without its linked files does not satisfy this contract.

Links inside `SKILL.md` and copied product references must resolve inside the installed skill directory. Generated files must not contain dependencies on the source checkout.

## Verification

Copy the assembled skill directory into a temporary directory without either source repository. Make sure that:

- `SKILL.md` finds each local reference and required script.
- Product-document links and section anchors resolve within the copied directory.
- The documented commands and configuration match the selected executable revision.
- Regeneration produces the same reference content from the same inputs.

The isolated-directory test is required evidence of skill portability. A source-checkout link sweep alone does not prove it.

## Legacy transition

Sandpiper's current executable still uses legacy configuration and storage setup. Its package documentation and skill references remain with that runtime until assembly and consumer cutover change together.

Do not replace those local files with external redirects. Do not copy standalone version-2 initialization advice beside the legacy executable.

The [extraction record](trail-extraction-design.md) tracks the deferred consumer choice. The [adoption specification](trail-board-adoption.md) covers converting existing board configuration without moving tasks.
