---
name: standup
description: >-
  Create and review session stand-up notes for continuity across session boundaries.
  Use at the END of a session to capture what was accomplished, what's next, and any
  blockers or context the next session needs. Use at the START of a session to review
  the previous stand-up and orient. Also use when the user asks "what were we working
  on?", "where did we leave off?", "what's next?", or "do a stand-up".
---

# Session Stand-Up Skill

Maintain continuity across session boundaries by writing structured stand-up notes at session end and reviewing them at session start.

## Where the Stand-Up Lives

The stand-up is a single file that gets overwritten each session:

```
.sandpiper/standup.md
```

One file, always current. If you're still in the same session as the last stand-up (check the date at the top), update it in place rather than replacing it. The stand-up is for the NEXT session — not a historical record. History lives in jj commits, the task tracker, and session files.

## End-of-Session Stand-Up

At the end of a session (when the user says "let's wrap up", "call it", "EOD", or you sense the session is ending), produce a stand-up note.

### Format

```markdown
# Session Stand-Up: {date}

## Accomplished
- [Detailed list of what was done this session]
- [Include ticket references (e.g., SHR-60, TOOLS-8)]
- [Note any key decisions made and their rationale]
- [Mention files/modules that were significantly changed]

## In Progress
- [Work that was started but not finished]
- [Current state — what's done, what remains]

## Next Session
- [Ordered list of what should happen next]
- [Include priority/urgency if relevant]

## Blockers
- [Anything preventing progress]
- [External dependencies, open questions, upstream issues]
- [Or "None" if clear]

## Context
- [Important details the next session needs to know]
- [Partial implementations that need careful handling]
- [Gotchas or traps discovered during this session]
- [Links to relevant PRDs, docs, or tickets]
- [State of the working tree — uncommitted changes, dirty branches, etc.]
```

### Writing Guidelines

- **Be specific, not vague.** "Fixed fish escaping to use quote-break pattern instead of backslash" not "Fixed escaping bug."
- **Include file paths.** The next session may not have context on what was touched.
- **Capture decisions and rationale.** "Chose `fish_preexec` over Enter keybind because it avoids commandline manipulation" — the next session needs to know WHY, not just WHAT.
- **Note anything fragile or surprising.** "The `dist/dist` self-symlink is intentional — it resolves pi's double-dist path expectation."
- **Reference tickets.** Every work item should trace back to the task tracker.

## Start-of-Session Review

At the start of a session (or when the user asks to get oriented), read the most recent stand-up and use it to:

1. **Summarize** what was done last time and what's planned
2. **Check** if blockers have been resolved
3. **Propose** a plan for the current session based on "Next Session" items
4. **Verify** context items are still accurate (files haven't changed unexpectedly, etc.)

### How to Read the Stand-Up

```bash
cat .sandpiper/standup.md
```

## When to Write a Stand-Up

- **Always** at the end of a working session
- **Before** a session switch (`/new`) if significant work was done
- **When asked** — "do a stand-up", "wrap up", "checkpoint"

## When to Read a Stand-Up

- **Start of every session** — orient yourself before diving in
- **After `/resume`** — the resumed session may have stale context
- **When asked** — "where did we leave off?", "what's next?"

## Relationship to Other Artifacts

- **Tasks** track individual work items with status. Stand-ups track session-level narrative.
- **AGENTS.md** captures permanent conventions. Stand-ups capture ephemeral session state.
- **Compaction summaries** are internal to the session. Stand-ups cross session boundaries.
- **Self-reflection** (`/self-reflect`) updates docs and skills. Stand-ups capture what to do next.

A stand-up is NOT a replacement for any of these — it's the bridge between sessions.
