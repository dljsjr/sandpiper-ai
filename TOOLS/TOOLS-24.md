---
title: "Copy Dash CommonJS sidecar into source skill helper"
status: COMPLETE
resolution: DONE
kind: BUG
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-05-13T14:54:52.091Z
updated_at: 2026-05-13T21:01:53.780Z
---

# Copy Dash CommonJS sidecar into source skill helper

The Dash skill helper fix in TOOLS-14 correctly emits dash.cjs for generated dist artifacts, but the source/dev helper copy step in devtools/assembleDistribution.ts copies only scripts/dash back into packages/resources. The active source skill catalog then runs a wrapper that imports ./dash.cjs, which is missing. Add regression coverage and copy/ignore the sidecar for source-local skill execution.

---

# Activity Log

## 2026-05-13T14:55:00.799Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-05-13T14:57:05.995Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-13T21:01:53.781Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
