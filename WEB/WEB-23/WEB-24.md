---
title: "Explain the llms.txt block with an instructions element"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-11-11T23:14:34.409Z
updated_at: 2026-11-12T16:29:12.658Z
---

# Explain the llms.txt block with an instructions element

Doug's convention (2026-11-11): explain supplemental tool content with an instructions element, as system notifications do.

## Implemented (2026-11-11)

Change ouuuvxym / 41b98c02. The additional_content block now holds an instructions element before the llms_txt element. The text says what the index is, to fetch it instead of guessing URLs, and that a markdown_section filter reads one part of it. The block is the same on every fetch (no per-session state), and is left out when the fetched page is the llms.txt file itself. Failing tests first; covered by the full gate recorded in WEB-23.

---

# Activity Log

## 2026-11-11T23:22:40.473Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-11T23:22:41.103Z

- **description**: added (5 lines)

## 2026-11-11T23:22:42.280Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-12T16:29:12.659Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
