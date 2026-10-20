---
title: "Remove the product-owned resources slot and its placeholder package"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: "prompt-trim"
reporter: USER
created_at: 2026-11-09T23:33:26.863Z
updated_at: 2026-11-10T15:48:33.414Z
related:
  - TOOLS-92
  - TOOLS-43
---

# Remove the product-owned resources slot and its placeholder package

## History squashed (2026-11-10)

Doug asked for one commit per atomic unit of work. The commit ids listed under "Delivered" below are superseded. Current commits, by jj change id (stable across rewrites) with the commit id at the time of writing:

- tmttskxm (880b1002) refactor: Remove the product-owned resources location; 84 files / 726 tests

Source and tests at the new tip are identical to the tree that was gated before the squash. Each commit was then gated on its own in an isolated workspace: bun check clean and bun run test passing with the counts shown.

## Delivered, awaiting review (2026-11-09)

Agent prompt-trim delivered three commits from an isolated jj workspace. After the coordinator combined the lines they are:

- 80ab1bc8 refactor: Remove the product-owned resources location from startup
- 74abc648 chore: Delete the placeholder resources package
- 55a6a743 docs: Remove the product-owned resources location from the docs

Result: the resource root, the SANDPIPER_STANDALONE_RESOURCE_ROOT override and resolveSandpiperResourcePaths are gone. The resources_discover handler returns only the temporary Trail skill path. SANDPIPER_STANDALONE_PACKAGE_DIR and package-root resolution are untouched. The three placeholder files, the bun.lock workspace entry and the .gitignore line are removed. Nine documents were corrected, including the AGENTS.md repository map and the root README directory tree.

Tests: eight tests whose subject is gone were removed and one handler test was added. The packed-install assertions that the tarball and the installed copy contain no packages/resources still pass unchanged.

## Decision

Doug decided on 2026-11-09, during the TOOLS-92 review: remove the product-owned resources slot, because Sandpiper no longer bundles skills, prompt templates or themes. Not started. Inventory rows K-12 and B-4 in .sandpiper/docs/specs/retained-surface-inventory.md.

## What the slot is

At startup Sandpiper resolves <productRoot>/packages/resources, or the directory named by SANDPIPER_STANDALONE_RESOURCE_ROOT, and offers its skills, prompts and themes subdirectories to Pi through a resources_discover hook. Nothing uses it: the default directory holds two READMEs, only tests set the override, and the packed product does not ship the directory.

## Scope

- packages/cli/standalone_bootstrap.ts: remove the resource root resolution and the SANDPIPER_STANDALONE_RESOURCE_ROOT override.
- packages/cli/sandpiper_resources.ts: remove resolveSandpiperResourcePaths. Keep the resources_discover hook for the temporary Trail skill bridge until TOOLS-43.
- Remove the placeholder package: packages/resources/package.json, skills/README.md, themes/README.md, its bun.lock workspace entry, and the .gitignore line for skill eval workspaces.
- Update the tests that build temporary resource roots (four files under packages/cli) and the packed-install assertions that name packages/resources.
- Update the seven documents that describe the location: docs/dev/env-vars.md, docs/dev/build-system.md, docs/dev/build-workflows.md, packages/cli/README.md, AGENTS.md, CONTRIBUTING.md, packages/README.md, and the build playbook.

User, project, settings-configured and package resources are loaded by Pi itself and are not affected.

This reverses the TOOLS-57 to TOOLS-59 choice to keep the location as an optional extension point.

---

# Activity Log

## 2026-11-09T23:37:49.295Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → prompt-trim

## 2026-11-09T23:49:40.734Z

- **description**: 19 lines → updated (31 lines)

## 2026-11-09T23:49:40.800Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-10T15:20:25.559Z

- **description**: 31 lines → updated (39 lines)

## 2026-11-10T15:20:59.504Z

- **description**: updated

## 2026-11-10T15:48:33.415Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
