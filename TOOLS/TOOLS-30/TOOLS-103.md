---
title: "Replace better-sqlite3 with the built-in node:sqlite module"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: "prompt-trim"
reporter: USER
created_at: 2026-11-09T21:51:36.370Z
updated_at: 2026-11-10T15:48:33.020Z
related:
  - TOOLS-92
  - TAT-70
---

# Replace better-sqlite3 with the built-in node:sqlite module

## History squashed (2026-11-10)

Doug asked for one commit per atomic unit of work. The commit ids listed under "Delivered" below are superseded. Current commits, by jj change id (stable across rewrites) with the commit id at the time of writing:

- rvqwortq (69e32384) refactor: Replace better-sqlite3 with node:sqlite; 84 files / 733 tests

Source and tests at the new tip are identical to the tree that was gated before the squash. Each commit was then gated on its own in an isolated workspace: bun check clean and bun run test passing with the counts shown.

## Delivered, awaiting review (2026-11-09)

Agent prompt-trim (Sonnet 5.5, high) delivered three commits from an isolated jj workspace. After the coordinator combined the lines they are:

- 2b7709ab refactor: Record skill activations with node:sqlite
- c3aa2a2d refactor: Open the Tattler room log with node:sqlite
- 7d9d1ab2 build: Remove better-sqlite3 from the product

The main bookmark is unchanged. Root dist and root node_modules were not rebuilt or reinstalled.

Evidence:
- Proof under Bun: the wave1 skill integration test starts a real sandpiper process under Bun and now asserts that skill_metrics.sqlite3 holds the expected row.
- Two new migration atomicity tests for the room log. They passed on the old driver before the port, and failed when the transaction was removed as a mutation check.
- The coordinator checked that DatabaseSync.isTransaction behaves the same under Bun 1.4.4 and Node 26, because the rollback path depends on it.
- Packed tarball on the combined tip, measured by the coordinator: 27,644,552 bytes packed and 132.62 MB unpacked, against 39,048,010 bytes for the previous build. The archive has no node_modules/better-sqlite3 entries. Built dist has no better-sqlite3 reference.
- bun.lock lost better-sqlite3, @types/better-sqlite3 and node-addon-api.

For review:
- Two results in tattler-room-log.ts are cast with "as unknown as RoomMessageRecord[]", because the node:sqlite row type does not overlap the record type.
- Seen but not changed: openRoomLog assigns its module-level handle before migrations run, so a failed migration leaves a half-initialised handle until closeRoomLog. This predates the port.

## Decision

Doug decided on 2026-11-09, during the TOOLS-92 review, to replace better-sqlite3 with the built-in node:sqlite module if Bun supports it. Bun 1.4.4 does. Not started. Inventory row: K-6b in .sandpiper/docs/specs/retained-surface-inventory.md.

## Why

better-sqlite3 is the largest item in the packed product: 26.1 MB of 153.7 MB unpacked. It is a native addon with prebuilt binaries, a root dependency, a bundled dependency and a build external. Its only live use is the skill activation counter in extensions/system/skill-loading-tool.ts. Its other user, extensions/tattler/tattler-room-log.ts, has no runtime importer yet (TAT-70).

TAT-71 chose better-sqlite3 over bun:sqlite so the code runs under both Node and Bun. node:sqlite keeps that property.

## Evidence (probe scripts, not product code)

- Bun 1.4.4 and Node 26.13.0 both export DatabaseSync from node:sqlite, with SQLite 3.54.0.
- Under both runtimes: exec, prepare().run/get/all, positional and bare named parameters, PRAGMA journal_mode = WAL, and BEGIN/COMMIT transactions work on a file database.
- A file that imports node:sqlite builds with bun build --target=bun --minify and the output runs.
- Vitest 5 imports node:sqlite under Node.
- @types/node 26.5.0 ships sqlite.d.ts.

## Known difference

Under Bun 1.4.4, opening a WAL-mode database with readOnly: true fails with "unable to open database file". Node opens it. A rollback-journal database opens read-only under both. No current call site opens a WAL database read-only.

## Scope

- extensions/system/skill-loading-tool.ts: Database to DatabaseSync. The API it uses maps one to one.
- extensions/system/skill-loading-tool.test.ts:392: the read-only handle option is readOnly, not readonly.
- extensions/tattler/tattler-room-log.ts: three better-sqlite3-only calls need replacing: pragma(), pluck(), transaction().
- Remove better-sqlite3 from root dependencies and bundledDependencies, the --external flag, and @types/better-sqlite3.
- Update the dependency pins in devtools/rootProductMetadata.test.ts and devtools/packedCli.test.ts, and the documents that list the bundled dependencies.
- Verify with bun check, bun run test, and the packed-install test. Building rewrites root dist under the live harness, so choose the build window deliberately.

Existing skill_metrics.sqlite3 files are plain SQLite files and need no migration.

---

# Activity Log

## 2026-11-09T23:37:49.210Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → prompt-trim

## 2026-11-09T23:49:40.544Z

- **description**: 32 lines → updated (53 lines)

## 2026-11-09T23:49:40.607Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-10T15:20:25.436Z

- **description**: 53 lines → updated (61 lines)

## 2026-11-10T15:20:59.384Z

- **description**: updated

## 2026-11-10T15:48:33.021Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
