---
title: "Pi 0.80.6 version upgrade"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-07-10T15:48:22.918Z
updated_at: 2026-08-06T20:42:47.986Z
---

# Pi 0.80.6 version upgrade

Bump the pinned @earendil-works/pi-coding-agent version from 0.80.3 to 0.80.6 and adopt the new capabilities that replace existing Sandpiper workarounds, per the 0.80.4/0.80.5/0.80.6 changelog review.

Changelog highlights relevant to Sandpiper: agent_settled lifecycle hook, entry renderers (pi.appendEntry/pi.registerEntryRenderer), named InlineExtension factories, bash tool timeout validation fix, plus ambient fixes (Anthropic empty-thinking-block handling for Claude Sonnet 5, compaction budgeting of context-visible custom messages, custom-entry streaming order).

CLOSE-OUT NOTE (2026-08-06): the bump itself (AGENT-224) and the completed subtasks shipped earlier; the pin subsequently advanced to 0.80.7. Remaining un-implemented subtasks AGENT-226 (entry renderers for the modelVisible hack) and AGENT-227 (shell_relay timeout validation) were folded into AGENT-235 (Pi 0.84.0 upgrade and capability adoption).

---

# Activity Log

## 2026-08-06T20:42:40.432Z

- **description**: 3 lines → updated (5 lines)

## 2026-08-06T20:42:47.916Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-08-06T20:42:47.987Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
