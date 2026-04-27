---
title: "Wire classifier into aux-guidance-hooks"
status: COMPLETE
resolution: WONTFIX
kind: SUBTASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-04-09T01:39:55.154Z
updated_at: 2026-05-14T14:04:08.246Z
---

# Wire classifier into aux-guidance-hooks

Wire classifier into aux-guidance-hooks.ts, removing regex/scoring logic.

## Work Items

- [ ] Replace `detectPromptIntent()` with classifier call in `before_agent_start`
- [ ] Remove `PromptIntent` interface
- [ ] Delete `scoreGuidanceDecision()` and all scoring weights
- [ ] Delete `WRITE_INTENT_RE`, `COMPLETION_INTENT_RE`, `REVIEW_INTENT_RE` regexes
- [ ] Delete `VERIFICATION_RE` and `detectBashIsVerification()`
- [ ] Remove `writesSinceVerify` and `readsSinceGuidance` from state
- [ ] Remove tool_call/tool_result handlers
- [ ] Simplify `AuxGuidanceState` to just `{ turnsSinceLastInjection }`

## Removed Components

- detectPromptIntent()
- scoreGuidanceDecision()
- PromptIntent interface
- All scoring constants
- writesSinceVerify, readsSinceGuidance tracking
- Tool call tracking handlers

---

# Activity Log

## 2026-04-09T01:40:17.416Z

- **description**: added (21 lines)

## 2026-05-14T14:04:08.247Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: WONTFIX
