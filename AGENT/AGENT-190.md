---
title: "Normalize workspace package dependency metadata"
status: COMPLETE
resolution: DONE
kind: BUG
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-05-08T16:44:44.692Z
updated_at: 2026-05-08T18:42:34.535Z
---

# Normalize workspace package dependency metadata

Package metadata drift from the package-first refactor: subdirectory package.json files and generated support package metadata use wildcard dependencies/peerDependencies (notably @mariozechner/pi-coding-agent, @mariozechner/pi-tui, @sinclair/typebox, and @silvia-odwyer/photon-node) instead of pinned versions, and several subpackages redeclare dependency versions instead of referencing the root workspace catalog. The root package.json also has wildcard peerDependencies and duplicated dependency/devDependency declarations. Normalize source package.json files to use workspace catalog references where appropriate, pin generated distribution metadata from catalog/root versions instead of '*', remove root duplication, update dist/package/support metadata generation tests, and verify install/distribution gates remain clean.

---

# Activity Log

## 2026-05-08T16:44:50.153Z

- **description**: added (1 line)

## 2026-05-08T17:01:05.613Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-05-08T17:19:10.984Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-08T17:21:05.930Z

- **status**: NEEDS REVIEW → IN PROGRESS

## 2026-05-08T17:29:21.900Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-08T18:42:34.536Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
