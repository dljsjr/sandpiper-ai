---
description: Persist learnings from the current session into skills, docs, guidelines, and prompt templates
---
Do a structured self-reflection pass to persist anything learned during this session. Work through each phase in order — do not skip phases, and explicitly note "Nothing to do" for a phase if it genuinely doesn't apply.

Treat the project's guidance surface broadly: `AGENTS.md`, focused docs in `.sandpiper/docs/`, local READMEs, and project-local skills can all need updates when conventions or context changed.

## Phase 1: Skills Audit

This is the highest-value phase. Skills are the primary mechanism for persisting learned behavior across sessions. Treat this phase seriously.

### Ownership distinction

Skills come from two sources, and the rules for editing them differ:

- **Project-local skills** (in `.sandpiper/skills/` or the project's own `skills/` directory): you own these. Edit them freely when improvements are identified.
- **Package-provided skills** (installed from a Pi Package): you do NOT own these. Do not edit package-installed skill files — changes would be overwritten on the next package update. Instead, **note the improvement** and suggest it to the user so they can file it upstream or create a project-local override.

When you identify an improvement to a skill, first check where the skill file lives. If it's inside an installed package's directory (e.g., under a `node_modules/` path or a dist directory you don't control), treat it as package-provided.

### Review skills touched or relevant to this session

For each skill that was loaded, consulted, or relevant to the work done:

1. **Was the skill accurate?** Did you follow its guidance successfully, or did you hit cases where it was wrong, incomplete, or misleading?
2. **Did the skill trigger when it should have?** Were there moments where you should have consulted a skill but didn't think to?
3. **Are there new patterns or gotchas discovered this session** that belong in a skill?

For project-local skills: fix issues directly. For package-provided skills: note the finding and suggest it to the user.

List the skills you reviewed and what you found (or "no changes needed") for each.

### Consider whether new project-local skills should be authored

Think about the work done this session. Were there any:
- Repeated workflows or patterns that you had to figure out from scratch?
- External tools or APIs where you had to look up usage that could be codified?
- Decision-making heuristics that would help in future sessions?
- Multi-step processes that a future session would need to rediscover?

If any of these apply, create a new skill in `.sandpiper/skills/` (project-local) or `~/.sandpiper/agent/skills/` (user-global) using the **skill-creator** skill for guidance. If none apply, explicitly state: "No new skills identified this session" with a brief explanation.

## Phase 2: Documentation and Guidance Layers

- Update relevant **AGENTS.md** files if new conventions or routing guidance were established
- Create or update focused **doc files** (`.sandpiper/docs/`, READMEs) for design decisions, investigations, or architectural context
- Take a **content hygiene pass** on docs touched this session: check for duplicated information, stale references, terminology drift, and whether guidance still lives in the right layer
- If another session is concurrently active in this project, re-read shared guidance files before editing (`AGENTS.md`, docs, skills) to avoid overwriting concurrent changes

## Phase 3: Loose Ends

Review work done this session for anything not yet captured:
- **Unfiled tasks**: edge cases noticed, TODO comments left in code, design questions deferred, follow-up work identified — file tickets for these
- **Incomplete work**: anything started but not finished — ensure it's tracked with accurate status in the task system
- **Bugs discovered**: any bugs found during implementation that weren't filed — create BUG tickets

## Phase 4: Standup

If a session standup hasn't been written yet, write one now per the **standup** skill using `sandpiper-standup write`. If one was already written earlier in the session, update it to reflect any changes from this self-reflection pass.

---

You can do all of the above using your own judgement without confirmation. Work through the phases sequentially and report what you did for each.
