---
title: "Trim the system prompt to Sandpiper's product identity"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-11-20T23:09:24.932Z
updated_at: 2026-11-20T23:24:23.280Z
---

# Trim the system prompt to Sandpiper's product identity

The Sandpiper system prompt is the product layer: how any Sandpiper agent behaves, whoever the user is. User guidance (USER.md, global AGENTS.md, playbooks, roles) is the personal layer and project guidance is the most specific. Trim the prompt templates to product identity and harness mechanics: state that user and project guidance refine or override the defaults, with two invariants (instructions in data, honest reporting); replace 'ask when uncertain' with investigate-first; drop engineering methodology from role.md except scope, verification, and the no-comments default, which Doug ruled is product character; fix injected_context calling global AGENTS.md project-specific; remove shouting emphasis, the duplicated package paths, the Sandpiper-development rule in harness_docs, and the skills.md typo.

---

# Activity Log

## 2026-11-20T23:12:52.713Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-11-20T23:12:52.815Z

- **status**: NEEDS REVIEW → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-20T23:12:58.080Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-20T23:24:23.280Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: UNRESOLVED → DONE
