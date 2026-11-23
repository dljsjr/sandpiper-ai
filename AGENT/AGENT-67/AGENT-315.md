---
title: "Crawl jj 0.46 CLI help depth-first into compact notes"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-10-17T18:23:21.490Z
updated_at: 2026-11-23T22:05:36.823Z
---

# Crawl jj 0.46 CLI help depth-first into compact notes

Done 2026-10-17. Notes: .sandpiper/archive/agent-67-jj-0.46-cli-notes.md (685 lines, 57.5 KB, about 35% of the 162 KB raw help). Method: a throwaway python crawler ran 'jj <path> --help' recursively from 'jj --help' (125 commands, help subcommands skipped); Global Options verified identical on all 124 subcommands (root differs only by a trailing keyword-help line) and recorded once; option entries repeated verbatim across commands deduplicated by a throwaway script; every remaining line read. Coverage check: all 125 commands have an entry. The notes end with cross-cutting findings (editor/interactive hazards and escapes, flag naming, agent primitives, config keys, env vars, template types), help-vs-changelog contradictions, and a 5-item verify list for a scratch repo.

---

# Activity Log

## 2026-10-17T18:23:28.413Z

- **description**: added (1 line)

## 2026-10-17T18:23:28.480Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-17T18:23:28.541Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-19T17:30:02.924Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:02:36.262Z

- **description**: updated

## 2026-11-23T22:05:36.823Z

- **description**: updated
