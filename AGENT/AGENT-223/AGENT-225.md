---
title: "Replace chorus.ts idle-poll loop with agent_settled hook"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-07-10T15:48:36.663Z
depends_on:
  - AGENT-224
updated_at: 2026-07-10T18:22:07.723Z
---

# Replace chorus.ts idle-poll loop with agent_settled hook

Investigation found sendChorusSelfMessageToChatWhenIdle was dead code (exported and unit-tested, but never called from chorus.ts's actual extension registration — the live self-echo path already goes through sendChorusMessageToChatOrQueue directly). Confirmed via Muninn (Tattler/Chorus refactor context: superseded by TAT-62/63's idle/batched message unification). Resolved by deleting the function and its test rather than replacing it with agent_settled — there was no live poll loop to replace. See AGENT-229 for the full knip.jsonc scope-gap investigation and the complete list of dead code removed alongside this.

---

# Activity Log

## 2026-07-10T15:48:40.991Z

- **depends_on**: (none) → AGENT-224

## 2026-07-10T16:49:45.739Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-07-10T18:22:07.310Z

- **description**: updated

## 2026-07-10T18:22:07.544Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-07-10T18:22:07.724Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
