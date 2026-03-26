---
description: Persist learnings from the current session into skills, docs, and guidelines
---
Do a structured self-reflection pass to persist anything learned during this session. Work through each phase in order — do not skip phases, and explicitly note "Nothing to do" for a phase if it genuinely doesn't apply.

## Phase 1: Skills Audit

This is the highest-value phase. Skills are the primary mechanism for persisting learned behavior across sessions. Treat this phase seriously.

### Review every existing skill touched or relevant to this session

For each skill that was loaded, consulted, or relevant to the work done this session:

1. **Was the skill accurate?** Did you follow its guidance successfully, or did you hit cases where it was wrong, incomplete, or misleading? If so, fix it.
2. **Did the skill trigger when it should have?** Were there moments where you should have consulted a skill but didn't think to? If the description didn't surface it, improve the description's trigger phrases.
3. **Is the skill's structure effective?** Use the **skill-review** skill to assess against best practices: description quality, progressive disclosure, tone, workflow examples, troubleshooting coverage.
4. **Are there new patterns or gotchas discovered this session** that belong in an existing skill? Add them.

List the skills you reviewed and what you found (or "no changes needed") for each.

### Consider whether new skills should be authored

Think about the work done this session. Were there any:
- Repeated workflows or patterns that you had to figure out from scratch?
- External tools or APIs where you had to look up usage that could be codified?
- Decision-making heuristics that would help in future sessions?
- Multi-step processes that a future session would need to rediscover?

If any of these apply, create a new skill using the **skill-creator** skill for guidance on structure and description writing. If none apply, explicitly state: "No new skills identified this session" with a brief explanation of why.

## Phase 2: Documentation and Guidelines

- Update relevant **AGENTS.md** files if new conventions or guidelines were established (project-specific in the repo, general in `~/.sandpiper/agent/AGENTS.md`)
- Create or update **doc files** (`.sandpiper/docs/`, READMEs) for design decisions, investigations, or architectural context that doesn't belong in skills or AGENTS.md
- Take a **content hygiene pass** on docs/skills touched this session: check for duplicated information, stale references, and terminology drift

## Phase 3: Loose Ends

Review work done this session for anything not yet captured:
- **Unfiled tasks**: edge cases noticed, TODO comments left in code, design questions deferred, follow-up work identified — file tickets for these
- **Incomplete work**: anything started but not finished — ensure it's tracked with accurate status in the task system
- **Bugs discovered**: any bugs found during implementation that weren't filed — create BUG tickets

## Phase 4: Standup

If a session standup hasn't been written yet, write one now per the **standup** skill. If one was already written earlier in the session, update it to reflect any changes from this self-reflection pass.

---

You can do all of the above using your own judgement without confirmation. Work through the phases sequentially and report what you did for each.
