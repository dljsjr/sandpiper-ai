---
title: "Crawl the jj docs site into compact notes"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-10-17T18:23:21.562Z
updated_at: 2026-10-19T17:30:02.986Z
---

# Crawl the jj docs site into compact notes

Done 2026-10-17. Notes: .sandpiper/docs/specs/agent-67-jj-0.46-docs-notes.md (1,083 lines, 97 KB, about 19% of the ~510 KB of source pages read). Method: sparse git clone of jj-vcs/jj at tag v0.46.0 (docs/ plus mkdocs.yml) into /tmp/jjdocs-src-m7LC, matching the live latest site (sitemap dated 2026-10-07 = 0.46.0 release); verified one page's rendered headings with lightpanda fetch --dump markdown; three macro-generated pages handled separately (cli-reference = markdown-help, changelog, git-command-table via its yml). Read in full: every nav page except contributing, code of conduct, style guide, design-docs index/blueprint, releasing, governance, testimonials, paid contributors; including all 9 design docs and the roadmap. Notes avoid repeating the CLI notes and end with a synthesis: 10 skill-stale findings (2 confirmed by grepping the skill, one verified empirically in a scratch repo: revset string patterns default to glob, not substring), agent primitives, and a 5-item verify list.

---

# Activity Log

## 2026-10-17T18:42:25.400Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-17T18:51:34.608Z

- **description**: added (1 line)

## 2026-10-17T18:51:34.704Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-19T17:30:02.987Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
