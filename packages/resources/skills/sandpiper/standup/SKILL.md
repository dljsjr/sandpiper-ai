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

Treat the bundled CLI at `scripts/sandpiper-standup` as the canonical interface for this file. **Resolve this path against the skill directory to get the absolute path before running commands.** Do not parse or rewrite the markdown structure manually.

## CLI Workflow

### Read

Use:

```bash
scripts/sandpiper-standup read
```

This command:
- returns standup context grouped as **Active Sessions** (current `SANDPIPER_SESSION_ID`, plus any other session whose owning process is confirmed alive) and **Inactive Sessions** (every other section — "inactive" means "not currently running," not "abandoned")
- **is non-destructive.** `read` never deletes anything from disk, no matter how many dead sections it shows you. A section can sit there for months — a thread you got ADHD-distracted away from and haven't come back to yet is not distinguishable, from the file's perspective, from one that's genuinely done. Only an explicit `cleanup` call (see below) removes a section, because only a human or an agent acting on the user's explicit judgment can tell those two cases apart.
- preserves legacy standup content

Prefer the CLI over a direct read of `.sandpiper/standup.md` — the file's raw `## <id>` headers don't tell you which section is actually yours, or which sessions are still running; that's the Active/Inactive classification the CLI computes for you. A raw peek forces you to reimplement that judgment by hand and can misattribute another session's notes as your own.

### Write

Use:

```bash
scripts/sandpiper-standup write <<'EOF'
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

`SANDPIPER_SESSION_ID` and `SANDPIPER_SESSION_FILE` are injected by the extension and used automatically. Avoid manually passing `--id`/`--file` unless needed for explicit tooling. `write` only ever upserts your own section (matched by id) — like `read`, it never touches anyone else's section, dead or alive.

`--file`/`SANDPIPER_SESSION_FILE` is optional — omit it if there's no meaningful session-transcript path to record. `--id`/`SANDPIPER_SESSION_ID` is the only thing `write` actually requires: any stable string that identifies "this session" across successive `write` calls works — it doesn't have to be a UUID, and it doesn't have to come from sandpiper's own session machinery. A **persistent agent identity** (e.g. `Piper`) works too, and is a deliberate use case, not a workaround: pass the same identity across different actual sessions and `write` keeps upserting the same section, so "Piper's standup" becomes one continuously-refreshed thread rather than siloed per-session notes. Whoever writes as that identity next is responsible for reading the prior content and folding forward anything still relevant, same as any other reused id.

### Working from a non-sandpiper harness (e.g. Claude Code)

The standup file and CLI aren't sandpiper-exclusive. A different harness can read and write sections in the same file as long as it picks a stable id and passes it explicitly:

```bash
scripts/sandpiper-standup write -i <your-id> <<'EOF'
### Accomplished
- ...
EOF
```

By default, a section written this way has no way to be confirmed "alive" — there's no sandpiper pidfile for a non-sandpiper id, so it always displays under Inactive Sessions (still fine: nothing gets deleted). To get accurate Active/Inactive display, pass `--pid <n>` with any long-lived process ID your harness controls (its own host process, for instance) — the CLI checks that PID directly with the OS (`process.kill(pid, 0)`) and never needs to know anything about sandpiper's own pidfile registry or directory layout:

```bash
scripts/sandpiper-standup write -i <your-id> -p $$ <<'EOF'
### Accomplished
- ...
EOF
```

### Cleanup (manual / maintenance)

Use:

```bash
scripts/sandpiper-standup cleanup
```

This is the **only** command that removes anything — it prunes sections whose owning process is confirmed dead, and cleans up orphaned PID files. Call it deliberately, not reflexively:

- The user explicitly says a thread is done and its notes are no longer needed ("clean up standup," "we don't need that old note anymore").
- You (the agent) are confident a specific Inactive section's content has been fully superseded — e.g. its work is now tracked as a COMPLETE task in the task tracker, so the standup note is pure duplication, not the only remaining record.
- The Inactive Sessions list has grown long enough that skimming it is real overhead, *and* you've checked with the user (or the sections are unambiguously done) before pruning — `cleanup` is irreversible, unlike `read`.

Don't call `cleanup` reflexively after every `read` just because Inactive Sessions is non-empty — a dormant thread the user hasn't circled back to yet looks identical, from the file's perspective, to a genuinely finished one. When in doubt, leave it; the cost of an unpruned section sitting in the file is small, the cost of deleting someone's still-needed continuity notes is not.

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
scripts/sandpiper-standup read
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

Session matching / update-vs-create behavior is handled by `scripts/sandpiper-standup` using `SANDPIPER_SESSION_ID`. Do not implement your own same-session detection logic in prompts or ad-hoc scripts.

## Writing Guidelines

- **Be specific, not vague.** "Fixed fish escaping to use quote-break pattern instead of backslash" not "Fixed escaping bug."
- **Include file paths.** The next session may not have context on what was touched.
- **Capture decisions and rationale.** "Chose `fish_preexec` over Enter keybind because it avoids commandline manipulation" — the next session needs to know WHY, not just WHAT.
- **Note anything fragile or surprising.** "The generated package materializes Pi runtime assets under `dist/dist/` because Pi resolves built-in assets below `<PI_PACKAGE_DIR>/dist/`."
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
