---
title: "Design PKM system with Zettelkasten semantics"
status: NOT STARTED
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-25T03:13:59.736Z
updated_at: 2026-03-29T00:37:46.885Z
---

# Design PKM system with Zettelkasten semantics

Design a Personal Knowledge Management system for capturing small, atomic notes with Zettelkasten-style linking. Key motivations:

- AGENTS.md is a blunt tool — it loads entirely into the context window, so unbounded growth is counterproductive
- A PKM would enable progressive disclosure: the agent loads only what's relevant, not everything
- The task management CLI architecture (markdown + YAML frontmatter + index + CLI) generalizes naturally to notes
- A well-written skill could guide when to capture (new learnings, conventions, gotchas) and when to recall (related work, prior decisions)

Possible MVP: pure skill (no CLI) that uses markdown files in a known directory with a tagging/linking convention. The skill teaches the agent to search/create/link notes. CLI can come later for index, search, and integrity.

Design questions: note format, linking syntax, tag taxonomy, search strategy (ripgrep? index?), when to auto-recall vs explicit lookup.

---

# Activity Log

## 2026-03-25T03:14:13.428Z

- **description**: added (10 lines)
