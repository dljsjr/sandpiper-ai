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

Audit both skill effectiveness **and trigger quality**. Do not limit the audit to skills that were actually loaded. Deliberately scan the available skills list and identify skills that should have activated but did not.

For each skill in any of these categories, report findings:

- skills loaded or consulted during the session
- skills the user explicitly told you to use
- skills that should have triggered automatically based on the work performed, even if they never loaded
- skills that triggered late, only after user prompting, or only after you hit an avoidable mistake
- skills whose descriptions may be too vague, too narrow, or too buried in body text to trigger reliably

For each reviewed skill, answer:

1. **Trigger quality:** Did the skill trigger automatically at the right time? If the user explicitly prompted it, would it have triggered without that prompt? Be honest.
2. **Missed or delayed triggers:** Were there earlier points where the skill should have loaded? Were there skills that never loaded but should have?
3. **Trigger failure cause:** If activation was missed/delayed/explicit-only, was the likely cause weak description wording, missing trigger phrases, over-narrow scope, over-broad scope, trigger guidance buried in the body instead of frontmatter, or the agent overestimating its own certainty?
4. **Usage effectiveness:** Once loaded, was the guidance accurate, complete, and actionable? Did you hit cases where it was wrong, incomplete, or misleading?
5. **Persistable learning:** Are there new patterns or gotchas discovered this session that belong in a skill?

Common under-trigger patterns to check explicitly:

- API/library/framework/CLI/config-format uncertainty → look up the relevant documentation rather than guessing
- version control operations, commits, bookmarks, rebases, abandon/drop, operation-log recovery → **jj**
- tasks, backlog, status, tickets, follow-up work → **tasks**
- code review or judging code quality → an applicable review skill, if available
- cleanup, simplification, restructuring → **refactoring**
- tests-first work or bug reproduction → **test-driven-development**
- GitHub/GitLab URLs or CLI work → use the relevant forge CLI when available

For project-local skills: fix issues directly. For package-provided skills: note the finding and suggest it to the user instead of editing installed package files.

List every skill you reviewed and what you found. For each skill, include a trigger-quality classification such as: `automatic_trigger_correct`, `explicit_user_trigger_only`, `missed_trigger`, `delayed_trigger`, `overtriggered`, or `not_relevant_after_review`.

### Consider whether new project-local skills should be authored

Think about the work done this session. Were there any:

- Repeated workflows or patterns that you had to figure out from scratch?
- External tools or APIs where you had to look up usage that could be codified?
- Decision-making heuristics that would help in future sessions?
- Multi-step processes that a future session would need to rediscover?

If any of these apply, create a new skill in `.sandpiper/skills/` (project-local) or `~/.sandpiper/agent/skills/` (user-global). Follow the current skill format and local guidance. If none apply, explicitly state: "No new skills identified this session" with a brief explanation.

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

## Phase 4: Journal

If Journal is installed, load its skill and publish one short entry for any decision, discovery, blocker, or next action that changed during this pass. Run the resolved absolute script, not an assumed PATH binary. For another project, use an explicit absolute `--dir <project>/.sandpiper`. Reference detailed evidence rather than writing a session report. If Journal is unavailable, keep continuation context in existing project records.

---

You can do all of the above using your own judgement without confirmation. Work through the phases sequentially and report what you did for each.
