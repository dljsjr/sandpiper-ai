---
title: "pi-yaams: emit memory bootstrap as a prompt contributor instead of mutating systemPrompt"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: "Muninn"
reporter: "Roux"
created_at: 2026-06-09T22:45:05.715Z
updated_at: 2026-06-10T04:27:55.476Z
---

# pi-yaams: emit memory bootstrap as a prompt contributor instead of mutating systemPrompt

Owner: Muninn. First pass verified-local (63/63, tsc clean) but DIVERGED from the canonical contract (AGENT-214). Required ripple changes to match Huginn's exported contract:
1. Channel rename: 'sandpiper:prompt-contributor' -> 'sandpiper:prompt-contribution' (canonical).
2. phase: drop 'memory' (invalid against 'prepend'|'append' type-guard — would be rejected by collector). Use 'append' or omit (memory block goes after base prompt).
3. Drop 'source' from the emitted payload (not in canonical contract; collector ignores it). Keep id ('pi-yaams.memory-bootstrap').
4. Keep acknowledge?() — canonical contract is adding it back (AGENT-214). Collector will call it on accept; pi-yaams skips direct-append fallback when acked, retains fallback for plain Pi / old Sandpiper.
5. Contract is structural across the event bus — pi-yaams mirrors the shape, no cross-repo import. Canonical definition lives in sandpiper-ai extensions/system/prompt-contributions.ts; published in docs (AGENT-216).
HELD: do not push/merge until AGENT-214 re-adds acknowledge() and both sides agree the final shape.

---

# Activity Log

## 2026-06-09T22:45:10.968Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Muninn

## 2026-06-09T22:48:39.909Z

- **description**: 8 lines → updated (14 lines)

## 2026-06-09T22:53:02.224Z

- **description**: 14 lines → updated (7 lines)

## 2026-06-09T22:57:03.200Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-06-10T04:27:55.477Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
