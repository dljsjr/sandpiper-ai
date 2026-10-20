---
title: "Gates and live 1.3.0 check (prompt, Tattler wake, Chorus fullscreen)"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-10-16T17:17:57.601Z
updated_at: 2026-10-19T17:27:18.158Z
---

# Gates and live 1.3.0 check (prompt, Tattler wake, Chorus fullscreen)

Stack landed: main at nvltmwlz (tnlowovz bump, ntxlulrs Tattler test, nvltmwlz dotenv); default workspace @ rebased onto it, no conflicts. Gates in pi13: bun check clean; bun run test 129 files / 1,175 tests; distribution gate EXIT=0 incl. npmPackageInstallSmoke. Prompt dump with Doug's real settings on 1.3.0: Sandpiper prompt, Pi version 1.3.0, tools/rules/cwd, no Pi default preamble, no extension load errors. Live session pi13-probe (openai-codex, Doug's settings): two Tattler wakes on a fresh session with no user prompt both ran; second answered Doug / Pi 1.3.0 / pi13 cwd. Chorus: Doug's room post reached sandpiper-agent, reply came back; Doug confirmed editor and transcript look good in fullscreen TUI mode.

---

# Activity Log

## 2026-10-16T17:27:41.411Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-16T17:27:41.475Z

- **description**: added (1 line)

## 2026-10-16T17:32:56.949Z

- **description**: updated

## 2026-10-16T17:46:00.912Z

- **description**: updated

## 2026-10-16T17:46:00.984Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-19T17:27:18.159Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
