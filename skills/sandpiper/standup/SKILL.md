---
name: standup
description: >-
  Create and review session stand-up notes for continuity across agent session
  boundaries. Use at the END of a session to capture what was accomplished, what's
  next, and any context the next session needs. Use at the START of a session to
  review the previous stand-up and orient. Also use when the user asks "what were we
  working on?", "where did we leave off?", "what's next?", or "do a stand-up".
  Mid-session updates after completing significant work are also encouraged.
---

# Session Stand-Up Skill

Maintain continuity across agent session boundaries by writing structured stand-up notes.

## What "Session" Means

A **session** is a single agent context window — from launch to termination. The stand-up exists to bridge the gap when that context is lost.

Key properties of a session:
- A session starts when the agent starts (or resumes into a new context window)
- A session ends when the agent is terminated, the context window is exhausted, or the user starts a new session (`/new`)
- **Multiple sessions can occur in one day** (user restarts the agent, context fills up, switches tasks)
- **A single session can span multiple days** (user leaves the agent running overnight, resumes the next morning)
- A session is NOT a calendar day, NOT a task boundary, NOT a work shift

The stand-up is written for the **next session's agent** — a fresh context window that knows nothing about what just happened. Everything it needs to pick up where we left off must be in this file.

## Where the Stand-Up Lives

```
.sandpiper/standup.md
```

One file, always current. The stand-up is overwritten at the start of each new session's first update. Mid-session updates modify it in place.

The stand-up is NOT a historical record. History lives in version control commits, the task tracker, and session files.

## Format

```markdown
# Session Stand-Up

Updated: {ISO 8601 timestamp}
Session: {session UUID}
Session file: {session file path}

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

### Header Fields

- **Updated** — ISO 8601 timestamp of the most recent write. Updated on every write, including mid-session updates.
- **Session** — UUID that uniquely identifies the current agent session. This is the primary key for "same session" detection.
- **Session file** — Path to the active session's JSONL file. Sessions are stored under `~/.sandpiper/agent/sessions/` in subdirectories keyed by working directory (e.g., `--Users-jane-git-my-project--/`). Filenames are `{timestamp}_{uuid}.jsonl`. This is a reference pointer for the user — do NOT read session files, they are large JSONL and would create enormous context noise.

### How to Access Session Identity

The system extension injects session identity into environment variables at session start:

- `SANDPIPER_SESSION_ID` — the session UUID
- `SANDPIPER_SESSION_FILE` — the full path to the session JSONL file (may be absent in ephemeral/no-session mode)

Use these directly — no filesystem derivation needed.

## When to Write

### End of Session (Required)

Write a stand-up when the session is ending:
- The user says "let's wrap up", "call it", "EOD", "end session", etc.
- The user starts a new session (`/new`)
- You sense the session is winding down

This is the primary use case. The next agent has no context — make it count.

### Mid-Session Updates (Encouraged)

Update the stand-up in place after completing significant milestones:
- A major task is completed
- An important decision is made that future context needs
- A blocker is discovered or resolved
- The session has been running long and context is getting heavy

Mid-session updates are incremental — add to the Accomplished section, update In Progress, revise Next Session as priorities shift. Update the `Updated` timestamp but keep the same `Session` reference.

### Before Context-Heavy Operations

If you're about to do something that will consume a lot of context (large file reads, long tool outputs), consider checkpointing the stand-up first. If the context window fills up, the stand-up will be there for the next session.

## When to Read

### Start of Session (Required)

At the start of every session, read the stand-up and use it to:

1. **Summarize** what was done last session and what's planned
2. **Check** if blockers have been resolved
3. **Propose** a plan for the current session based on "Next Session" items
4. **Verify** context items are still accurate

```bash
cat .sandpiper/standup.md
```

Do NOT read the session file referenced in the `Session` field — it's a large JSONL file and would flood the context window. It exists as a reference for the user if they want to `/resume` or review history.

### After `/resume`

The resumed session may have stale context. Read the stand-up to re-orient.

### When Asked

"Where did we leave off?", "what's next?", "do a stand-up"

## Detecting "Same Session"

To decide whether to overwrite or update in place: if the `Session` UUID in the existing stand-up matches the current session's UUID, you're in the same session — update in place. If it differs (or is absent), this is a new session — overwrite.

If the session UUID isn't available, fall back to judgment: if the stand-up's content clearly describes work you just did in this context window, update in place.

## Writing Guidelines

- **Be specific, not vague.** "Fixed fish escaping to use quote-break pattern instead of backslash" not "Fixed escaping bug."
- **Include file paths.** The next session may not have context on what was touched.
- **Capture decisions and rationale.** "Chose `fish_preexec` over Enter keybind because it avoids commandline manipulation" — the next session needs to know WHY, not just WHAT.
- **Note anything fragile or surprising.** "The `dist/dist` self-symlink is intentional — it resolves pi's double-dist path expectation."
- **Reference tickets.** Every work item should trace back to the task tracker.

## Relationship to Other Artifacts

| Artifact | Purpose | Stand-up's role |
|----------|---------|-----------------|
| Tasks | Track individual work items with status | Reference task keys; don't duplicate task details |
| AGENTS.md | Permanent conventions and rules | Stand-up captures ephemeral session state, not rules |
| Compaction summaries | Internal to a session's context management | Stand-up crosses session boundaries |
| Session files | Full conversation history (JSONL) | Stand-up references the path; don't read the file |
| Self-reflection | Updates docs and skills | Stand-up captures what to do next |

A stand-up is NOT a replacement for any of these — it's the bridge between agent context windows.
