# Agent Guidance Evolution

Status: prompt-first planning active; deterministic hook design deferred
Related tasks: AGENT-34, AGENT-35
Updated: 2026-03-30

## Purpose

Capture the current direction for the next revision of repository guidance.
This work has two related but distinct axes:

1. **Prompt architecture / progressive disclosure** — what guidance lives in root `AGENTS.md` versus focused docs versus module-local docs, and how to keep the always-loaded prompt small and high-signal.
2. **Deterministic harness behavior** — future extension-hook work that can block or redirect incorrect tool use and provide targeted feedback.

The current decision is to **prioritize the prompt architecture first** and defer the hook design to a later phase. This document records both the near-term plan and the findings that should be preserved for that later design pass.

Sandpiper now also injects a compact startup context that can include:
- active task summary
- meaningful dirty-working-copy summary
- cold-start-specific guidance when the session appears to begin without restored conversation history

## Decisions Already Made

- There are **two axes** to the problem: prompt-side progressive disclosure and harness-side deterministic enforcement.
- The repository should pursue the **prompt-side revision first**.
- Root `AGENTS.md` should be **small, routing-oriented, and invariant-focused**, but not aggressively minimized at the expense of clarity.
- The optimization target is **clear routing + tiny high-signal leaf docs + minimal duplication**, not an arbitrary token ceiling.
- Startup continuity should include **compact live context**, not just narrative context: active tasks and meaningful dirty-working-copy state are worth surfacing.
- Inactive / archived projects should be filtered from startup project-routing injection to keep the prompt denser and more relevant.
- Deterministic enforcement is promising, but the repo should **not** jump straight into hook implementation before the prompt-side taxonomy is crisp.

---

## Axis 1 — Prompt-Side Progressive Disclosure Plan

### Goal

Make guidance easier to follow in cold-start sessions by tightening the role of each instruction layer and reducing duplication between them.

### Target Guidance Layers

| Layer | Role | Should Contain | Should Avoid |
| --- | --- | --- | --- |
| Root `AGENTS.md` | Global hot memory | Non-negotiable repo invariants, short workflow rules, routing table, brief enforcement summary | Deep domain detail, long explanations, repeated local architecture |
| `.sandpiper/docs/*.md` | Topic-specific leaf docs | Compact high-signal rules, pitfalls, canonical example paths, longer reference below | Repeating global invariants or module-local ownership info |
| Subdirectory `AGENTS.md` / `README.md` | Local architecture and module conventions | Current source-of-truth docs, architecture notes, local testing/building guidance | Repo-wide rules already covered by root `AGENTS.md` |
| Tasks / standup | Work continuity | Decision history, next steps, blockers, work-specific context | Standing architectural guidance |
| Skills | Cross-project procedural expertise | How to use task system, jj, standup process, etc. | Repo-specific architecture detail |

### Root `AGENTS.md` Revision Goal

The next revision of root `AGENTS.md` should bias even more toward:

1. **Invariants**
   - use `jj`, not `git`
   - use the tasks CLI, not direct task file edits
   - edit source, not generated/dist artifacts
   - build/test/lint expectations
2. **Routing**
   - when touching build/distribution paths, read the build/extension-loading docs
   - when touching env/config migration paths, read env-var guidance
   - when touching CLI code, read CLI guidance
   - when touching Pi integration/system extension code, read Pi API pitfalls
3. **Escalation / source-of-truth cues**
   - current docs beat historical docs
   - active docs live in `.sandpiper/docs/`
   - historical material lives in `.sandpiper/archive/`

### Leaf Doc Shape

The next revision should standardize focused docs around a compact, injectable top section plus deeper reference material below.

A suggested pattern:

```md
# Topic Name

Read when: <specific triggers / paths / kinds of change>
Last verified: YYYY-MM-DD

## Key Rules
- 3-8 compact, high-signal bullets
- Prefer positive phrasing where possible
- Include only details that are easy to forget or hard to infer

## Canonical Examples
- `path/to/file.ts`
- `path/to/other-file.ts`

## Reference
Longer explanation, rationale, caveats, and examples.
```

The exact heading names do not matter as much as the shape:
- short top section
- explicit trigger for when to read it
- canonical example paths
- full detail below

### Best Candidates for This Pass

These docs are the strongest candidates for a tighter leaf-doc pass because they map directly to recent confusion or frequent repo-specific mistakes:

1. `.sandpiper/docs/build-system.md`
2. `.sandpiper/docs/extension-loading.md`
3. `.sandpiper/docs/pi-api-pitfalls.md`
4. `.sandpiper/docs/env-vars.md`
5. `.sandpiper/docs/cli-development.md`

Suggested emphasis for each:

- **build-system.md**
  - extensions load from source via jiti
  - `dist/package.json` is not a dependency manager
  - when to run `devtools/postinstall.sh`
  - when package builds are required
- **extension-loading.md**
  - source-loaded extension model
  - jiti expectations and limitations
  - what `/reload` does and does not refresh
- **pi-api-pitfalls.md**
  - extension event semantics
  - lifecycle gotchas
  - cases where implementation behavior should be verified against source/examples
- **env-vars.md**
  - PI_/SANDPIPER_ mirroring
  - `resolveEnvVar()` conventions
  - avoid inventing ad hoc path knobs
- **cli-development.md**
  - Commander patterns
  - Bun-first commands
  - packaging/build expectations for binaries

### Module-Local Doc Cleanup Goal

Module-local `AGENTS.md` and `README.md` files should also be normalized so they:

- clearly identify the **current source of truth**
- state when they should be read
- avoid restating repo-wide rules
- focus on local architecture, not history

### Lightweight Execution Plan

1. **Audit root `AGENTS.md`**
   - classify each section as keep / move / shorten / delete
2. **Refactor the five highest-value focused docs**
   - add consistent trigger + compact top section + canonical examples
3. **Sweep local docs in the most active modules**
   - especially `extensions/system.ts`-related guidance and `extensions/shell-relay/`
4. **Align prompt templates with the layered guidance model**
   - especially templates that steer implementation, refactoring, status review, and self-reflection
5. **Do a duplication pass**
   - remove repeated explanations that now have a single source of truth
6. **Cold-start evaluation pass**
   - test whether a fresh agent can route itself correctly for known tricky scenarios

### Suggested Cold-Start Scenarios

Use these as reality checks for the prompt-only revision before building hooks:

1. **Build/dist/source-loading confusion**
   - Can a cold-start agent correctly reason about extension source loading, postinstall, and when builds are required?
2. **Shell-relay architecture routing**
   - Can it identify the correct current docs and avoid historical artifacts?
3. **Env/config migration work**
   - Can it route itself to env-var guidance instead of inventing new path knobs?
4. **CLI/package changes**
   - Can it determine when package build steps are required versus when postinstall alone is enough?
5. **General source-of-truth questions**
   - Can it find the active doc instead of reading archived/historical material?

### Implemented Prompt-Side Additions

The prompt-side revision now also includes several low-cost continuity aids:

- active / archived project filtering for `<available_projects>` injection
- compact active-task context injection
- compact dirty-working-copy context injection (with noisy task-history churn filtered out)
- a `/cold-start-check` prompt template for manual re-orientation
- cold-start guidance appended on the first agent turn when the session appears to start without restored conversation history
- startup prompt assembly ordered for prefix caching: static sections first, then dynamic sections by volatility, with one-shot cold-start guidance last to maximize shared prefix between resumed and cold-start first turns

### Success Criteria

The prompt-side revision is successful if, in cold-start situations:

- the agent more reliably reads the right focused docs without being reminded
- repo-specific mistakes become less common even without harness enforcement
- root `AGENTS.md` is easier to scan and less repetitive
- focused docs become more obviously actionable
- prompt templates reinforce the routing/source-of-truth model instead of bypassing it
- historical/reference material is easier to distinguish from active guidance

### Non-Goals for This Pass

- No deterministic tool blocking yet
- No large new framework extension for tool interception yet
- No regex-heavy convention police system yet
- No attempt to minimize root `AGENTS.md` to an arbitrary token budget at the expense of useful invariants

---

## Axis 2 — Deferred Deterministic Guidance / Enforcement Memo

This section captures findings from the initial review of the hook/enforcement angle so the repo does not need to rediscover them later.

### High-Level Conclusion

The article's overall strategy is compelling, but Sandpiper/Pi does **not** appear to expose the exact same hook model as Claude Code's "PreToolUse inject additionalContext before the tool runs" flow.

The likely Sandpiper-native shape is:

1. detect incorrect or risky tool use
2. block / redirect / annotate deterministically
3. inject targeted guidance on the **next** model turn
4. let the agent retry with better locality

That is still useful, but it is not a 1:1 copy of the article's same-turn injection mechanism.

### Relevant Pi/Sandpiper Capabilities Observed

From the current extension API and docs/examples review:

- `before_agent_start`
  - can modify the system prompt before the session begins
  - good for startup/global context
  - not a per-tool-use locality mechanism
- `context`
  - can inject messages before later model turns
  - good for queued follow-up guidance or reminders
- `tool_call`
  - runs before tool execution
  - can **block** tool calls
  - likely the main enforcement preflight hook
- `tool_result`
  - runs after tool execution
  - can modify result payloads / mark errors
  - useful for post-edit validation or rewriting tool feedback
- Tool overrides
  - built-in tools can be overridden by registering a tool with the same name
  - useful if a later design needs tighter control than generic hooks provide

### Important Behavioral Nuance

Pi docs indicate that in default parallel tool execution mode:

- sibling tool calls from the same assistant message are **preflighted sequentially**
- then they may **execute concurrently**
- `tool_call` is not guaranteed to see sibling tool results from that same assistant message

That matters for any design that queues or deduplicates guidance.

### Cold-Start Detection (Updated for Pi 0.65.0)

As of Pi 0.65.0, `session_start` fires for all session lifecycle transitions with `event.reason: "startup" | "reload" | "new" | "resume" | "fork"`. The removed events (`session_switch`, `session_fork`, `session_directory`) are replaced by reason-based dispatch.

Cold-start determination is now straightforward:

- `reason === 'new'` → always a cold start
- `reason === 'reload' | 'resume' | 'fork'` → never a cold start
- `reason === 'startup'` → ambiguous (Pi may auto-resume last session), so we still use `shouldTreatInitialLoadAsColdStart(sessionFile, entries)` to check session contents

The `shouldTreatInitialLoadAsColdStart` heuristic is only needed for the `startup` case and can be removed if Pi ever distinguishes "fresh start" from "auto-resumed last session" at the event level.

### Likely First Enforcement Candidates

When AGENT-35 is picked up, the first enforcement rules should be the highest-confidence repo invariants with low false-positive risk.

Strong candidates:

1. **Block `git` usage and redirect to `jj`**
   - applies to `bash` and likely `shell_relay`
2. **Block direct edits to `.sandpiper/tasks/**`**
   - redirect to `sandpiper-tasks`
3. **Block edits to `dist/**`**
   - redirect to source files
4. **Block edits to `.sandpiper/archive/**` by default**
   - unless the task explicitly calls for archival/historical work
5. **Block obvious bash-as-file-reader misuse**
   - redirect single-file content reads to `read`
6. **Block writing agent-operational docs into `docs/` instead of `.sandpiper/docs/`**
   - reinforce the docs split already established in the repo

These are workflow/path invariants, not deep content linting, and are likely the best first wave.

### Recommended Design Bias for Later

When the deterministic work begins, bias toward:

- **workflow invariants** over deep code-style enforcement
- **clear block-and-redirect messages** over vague warnings
- **small targeted follow-up guidance** over giant injected context blocks
- **teaching through locality** rather than relying on the startup prompt alone

### Open Questions for the Later Design Pass

1. What is the best user-visible / model-visible feedback path after a blocked tool call?
2. Should blocked tool guidance be injected via `context`, or is the block reason itself enough in some cases?
3. Should targeted guidance be deduplicated within a turn/session, and if so, how without breaking subagents or parallel tool flows?
4. Which rules should be hard-blocking versus warning-only?
5. For post-edit validation, is `tool_result` sufficient, or would specific tool overrides be cleaner for some cases?
6. How should the later design interact with existing standup/project/task context injection so the total context cost stays reasonable?

### Future Work Under AGENT-35

When this is revisited, AGENT-35 should produce:

- a detailed Sandpiper-native hook design
- a small first batch of deterministic rules
- a testing/dogfooding plan
- a rollout plan that starts with the safest highest-signal enforcement rules

The intent is **not** to immediately build a large enforcement system. The intent is to design a narrow, practical first version after the prompt-side progressive-disclosure revision proves out.
