---
title: "Improve background_process tool descriptions, snippets, and failure prevention"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-04-21T18:46:18.411Z
updated_at: 2026-04-21T18:52:01.320Z
---

# Improve background_process tool descriptions, snippets, and failure prevention

## Problem

Agents frequently misuse the background_process tools:
- Use 'nohup' + '&' or manually background shell jobs instead of start_background_process
- Try to run shell built-ins or compound commands (cd, &&, |, >) as the 'command' param, causing spawn errors
- The most common case: prefixing commands with 'cd ...' instead of using the cwd parameter
- After spawning, immediately polling with sleeps instead of working independently
- background_process tools had no promptSnippet or promptGuidelines, so they didn't appear in the Available Tools list or Guidelines section

## Fixes

1. Add promptSnippet and promptGuidelines to both start_background_process and check_background_process so they appear in system prompt reinforcement
2. Clarify descriptions: 'command' is an executable file, not a shell — do NOT pass cd, &&, |, >, etc. Use cwd param for directory changes
3. Strengthen descriptions to explicitly prefer this tool over manual backgrounding with &, nohup, bash
4. Update parameter descriptions to guide away from common mistakes

## Acceptance Criteria

- [x] start_background_process has promptSnippet and promptGuidelines
- [x] check_background_process has promptSnippet and promptGuidelines
- [x] start_background_process description clarifies 'executable' vs 'shell command'
- [x] cwd parameter description warns against 'cd ...' prefixing
- [ ] Shell wrapping fix (optional / punted)

---

# Activity Log

## 2026-04-21T18:46:24.714Z

- **description**: added (23 lines)

## 2026-04-21T18:46:32.251Z

- **description**: updated

## 2026-04-21T18:46:37.441Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-04-21T18:52:01.321Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: DONE
