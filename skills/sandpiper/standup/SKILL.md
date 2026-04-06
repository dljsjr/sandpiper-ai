---
name: standup
description: >-
  Create and review session stand-up notes for continuity across agent session
  boundaries. Use at the END of a session to capture what was accomplished, what's
  next, and any context the next session needs. Use at the START of a session to
  review the previous stand-up and orient. Use MID-SESSION after completing a major
  work package, fixing a significant bug, or making an important decision — checkpoint
  progress so it survives if the context window fills up. Also use when the user asks
  "what were we working on?", "where did we leave off?", "what's next?", or "do a
  stand-up".
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

Treat `sandpiper-standup` as the canonical interface for this file. Do not parse or rewrite the markdown structure manually.

## CLI Workflow

### Read

Use:

```bash
sandpiper-standup read
```

This command:
- returns standup context grouped as **Active Sessions** and **Inactive Sessions**
- performs passive cleanup of dead sessions
- preserves legacy standup content during read migration

### Write

Use:

```bash
sandpiper-standup write <<'EOF'
### Accomplished
- ...

### In Progress
- ...

### Next Session
- ...

### Blockers
- ...

### Context
- ...
EOF
```

`SANDPIPER_SESSION_ID` and `SANDPIPER_SESSION_FILE` are injected by the extension and used automatically. Avoid manually passing `--uuid`/`--file` unless needed for explicit tooling.

### Cleanup (manual / maintenance)

Use:

```bash
sandpiper-standup cleanup
```

This removes dead sections and orphaned PID files.

## When to Write

### End of Session (Required)

Write a stand-up when the session is ending:
- The user says "let's wrap up", "call it", "EOD", "end session", etc.
- The user starts a new session (`/new`)
- You sense the session is winding down

### Mid-Session Updates (Encouraged)

Update after significant milestones:
- Major task completion
- Important decisions
- Blocker discovered/resolved
- Long session checkpointing

### Before Context-Heavy Operations

If you're about to consume lots of context (large reads, long outputs), checkpoint first so the next session can recover.

## When to Read

### Start of Session (Required)

At the start of every session:

```bash
sandpiper-standup read
```

Use output to:
1. Summarize recent work
2. Check blockers
3. Propose next steps
4. Verify context still applies

### After `/resume` and on request

Also read after `/resume`, or when asked:
- "Where did we leave off?"
- "What's next?"
- "Do a stand-up"

## Session Matching

Session matching / update-vs-create behavior is handled by `sandpiper-standup` using `SANDPIPER_SESSION_ID`. Do not implement your own same-session detection logic in prompts or ad-hoc scripts.

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
