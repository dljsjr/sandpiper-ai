---
title: "Remove the Batch A leftovers from the retained-surface inventory"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: "batch-a-code, batch-a-config"
reporter: USER
created_at: 2026-11-10T22:55:16.255Z
updated_at: 2026-11-23T22:02:48.554Z
related:
  - TOOLS-92
---

# Remove the Batch A leftovers from the retained-surface inventory

## Delivered, awaiting review (2026-11-10)

Two GPT-6.1 Terra agents delivered eight commits from isolated jj workspaces. The coordinator read every diff, combined the two lines without conflict and gated each commit on its own in the combined order: bun check clean and bun run test passing at every commit. The main bookmark is unchanged and root dist is not rebuilt.

By jj change id, in order:
- nmsmytsn build: Simplify the TypeScript configuration (A-7, A-8). 70 files / 552 tests.
- snzrsvtq build: Drop three build externals that nothing imports (A-9). 70 / 552. The build output is identical before and after: 511 modules, 425,755 bytes.
- owlluuov chore: Remove config entries, scripts, and files that nothing uses (A-10, A-11, A-13, A-14, A-15). 70 / 552.
- nzttvwzn refactor: Remove the dead system extension entrypoints (A-1). 70 / 552.
- tyumwzkr refactor: Remove unused code in core and the CLI bootstrap (A-2, A-4, A-5, A-18, A-20). 69 / 542.
- ookvvmly refactor: Remove unused exports and options in the extensions (A-6, A-19, A-21). 69 / 533.
- styptpxw test: Remove a test that cannot fail and an unused harness option (A-16, A-17). 69 / 532.
- tstrqtrt chore: Remove per-package test scripts (A-12). 69 / 532.

Coordinator checks beyond the gates: the old and new notification formatters give identical text and messages for eight realistic inputs, including the three real callers' shapes.

Not complete:
- A-21 is partly done. SearchAdapterOptions.timeoutMs and .signal stay in the shared type because the DuckDuckGo adapter still reads them and its files were off limits. The Brave and Parallel adapters no longer honor them. TOOLS-109 removes the adapter and the two options.
- A-11: the two root .gitignore lines still wait for inventory row L-2.

For review:
- The code agent corrected four specs that named removed things: `.sandpiper/archive/background-process-framework-design-2026-04.md`, mailbox-coordination-architecture-notes.md, web-fetch-prd.md and pi-1-5-update-audit.md.
- devtools/rootProductMetadata.test.ts now reads metadata.scripts?.build, because two manifests no longer have a scripts block.

## Decision

Doug approved Batch A of .sandpiper/archive/retained-surface-inventory.md as one unit on 2026-11-10: rows A-1, A-2 and A-4 to A-21. Each row removes or trims something that nothing uses.

## Execution

Two implementation agents on GPT-6.1 Terra, as Doug asked, each in an isolated jj workspace with its own files:

- batch-a-code (xhigh): A-1, A-2, A-4, A-5, A-6, A-12, A-16, A-17, A-18, A-19, A-20, A-21. Source and test files under extensions/, packages/ and devtools/, the manifests under extensions/ and packages/, and knip.jsonc.
- batch-a-config (high): A-7, A-8, A-9, A-10, A-11, A-13, A-14, A-15. Root configuration files, the root package.json, the nested tsconfig files and the stray files.

Eight commits in total, one per coherent unit. The coordinator verifies each delivery, combines the two lines and reruns the gates on the result.

## Limits

- A-9 needs a real build and the packed-install test.
- A-10 keeps the .turbo entries until inventory row L-1 deletes the local cache.
- A-11 is limited to the two nested .gitignore files for now. The root .gitignore lines for /packages/cli/docs/ and *.tsbuildinfo still hide untracked files in the main checkout (inventory row L-2). Removing the lines first would make jj start tracking those files. The lines go when L-2 is done.
- A-21 rests on audit-agent evidence. The implementing agent verifies each item and leaves anything that has a caller.
- A-20 removes ProcessManager.kill, which has no caller today. AGENT-70 (a stop tool for background processes) would add it back.

---

# Activity Log

## 2026-11-10T22:55:16.339Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → batch-a-code, batch-a-config

## 2026-11-10T23:40:07.388Z

- **description**: 20 lines → updated (44 lines)

## 2026-11-10T23:40:07.689Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-11T16:18:41.010Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:02:48.554Z

- **description**: updated
