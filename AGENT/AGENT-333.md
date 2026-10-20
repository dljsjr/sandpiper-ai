---
title: "sandpiper-system-prompt ignores a saved 'do not trust' for the project (Pi 1.3.0 trust rule)"
status: COMPLETE
resolution: DONE
kind: BUG
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-11-17T21:04:26.974Z
updated_at: 2026-11-19T16:00:59.329Z
---

# sandpiper-system-prompt ignores a saved 'do not trust' for the project (Pi 1.3.0 trust rule)

packages/cli/system_prompt_diagnostic.ts resolveProjectTrust() (around lines 57-61) still follows Pi 1.3.0: it trusts a project unless it has trust-requiring resources and no saved decision. Pi 1.5's resolveProjectTrusted honours a saved 'do not trust'. Found in the Pi 1.5 update audit (archived under AGENT-332); not tracked elsewhere.

## Outcome (nxtypkxm)

`resolveProjectTrust()` now follows Pi 1.5's `resolveProjectTrusted()` for a session that cannot prompt: override, then saved decision, then `true` for a project without trust-requiring resources or `defaultProjectTrust === 'always'` for one with them. No `project_trust` extension handlers run, since the diagnostic decides trust before loading anything.

Second difference fixed in the same function, found while reading Pi's code: the diagnostic ignored `defaultProjectTrust: "always"` for projects with trust-requiring resources and no saved decision.

Impact correction: diagnostic-only. It affected the prompt `sandpiper-system-prompt` shows and the trust state its extensions see, not the agent runtime, and no project code ran because of it.

Tests: five cases in `system_prompt_diagnostic.test.ts` run the real CLI in an isolated agent dir with a probe extension rendering `ctx.isProjectTrusted()`; the two fixed cases failed before. bun check clean, 92 files/861 tests, dist rebuilt. Spec updated (`sandpiper-system-prompt.md`, diagnostic paragraph).

---

# Activity Log

## 2026-11-19T04:04:35.202Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-19T04:08:00.986Z

- **description**: 1 line → updated (11 lines)

## 2026-11-19T04:08:01.144Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-19T16:00:59.330Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
