---
title: "Replace application mcporter dependency declarations and bundled runtime closure"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-11-03T01:50:55.947Z
updated_at: 2026-11-23T22:05:38.003Z
related:
  - TOOLS-99
  - TOOLS-92
---

# Replace application mcporter dependency declarations and bundled runtime closure

## Declaration handoff and parent verification

Exact pi-mcp1.3.0 directly declared in web-search and root runtime/bundled deps; only application mcporter removed. Root product/build/bin/file/patch/mise contracts unchanged. Existing runtime-closure case proved expected RED then GREEN; all9metadata tests pass, parent reran9 and check:deps successfully. Scoped Biome clean. One authorized offline lockfile-only regeneration removed29 obsolete package records (373to344), added0 and changed0 retained records/versions/integrities. Agent snapshot shows shared node_modules unchanged by lock update. Worker closed. Parent shared install/build and actual package verification remain under102; no DONE inference.

## Approved scope

Adoption is approved in current simplification scope. Declare exact pi-mcp1.3.0 directly in web-search and root external runtime/bundled dependencies, remove web-search mcporter dependency, update root metadata regression, and regenerate lock through Bun without unrelated registry upgrades or patch changes. Preserve one root product/Bun build/direct packing and stable bins. Keep mise developer mcporter CLI unchanged. Lead serializes installs/build/output windows; no new wrappers, config, hooks or compatibility packages.

---

# Activity Log

## 2026-11-03T01:51:48.387Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-03T02:26:13.325Z

- **description**: 1 line → updated (7 lines)

## 2026-11-03T02:26:13.385Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-09T19:42:59.304Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:05:38.003Z

- **description**: updated
