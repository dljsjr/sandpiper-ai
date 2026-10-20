---
title: "Compiled app: autoloadDotenv false"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-10-16T17:17:57.523Z
updated_at: 2026-10-19T17:27:18.091Z
---

# Compiled app: autoloadDotenv false

TOOLS-30 has not dropped the compiled app, so added compile.autoloadDotenv: false (Bun CompileBuildOptions, verified in bun.com/docs/bundler/executables) next to autoloadBunfig in devtools/standaloneSandpiperApp.ts. Red-first test in devtools/standaloneSandpiperAppRuntime.test.ts: a launch-cwd .env with FORCE_COLOR=1 put ANSI into --help output; with the fix it does not.

---

# Activity Log

## 2026-10-16T17:24:46.759Z

- **description**: added (1 line)

## 2026-10-16T17:27:41.345Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-10-19T17:27:18.091Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
