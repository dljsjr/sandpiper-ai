---
title: "Fix search catch-all to distinguish rg exit code 1 (no matches) from real errors"
status: COMPLETE
resolution: DONE
kind: BUG
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-04-01T15:29:58.419Z
updated_at: 2026-05-13T05:09:52.280Z
---

# Fix search catch-all to distinguish rg exit code 1 (no matches) from real errors

Revise task-list full-text search semantics: default -q searches should use BM25-style relevance ranking; add --regex for JavaScript regex search; add --ripgrep to use ripgrep; combine --regex --ripgrep for ripgrep regex search. With -q, default sort is relevance, --limit truncates by search ranking before any explicit --sort, and existing non-search default sorting remains unchanged. Ripgrep mode should distinguish exit code 1 (no matches) from real errors.

---

# Activity Log

## 2026-04-01T15:31:23.313Z

- **description**: added (20 lines)

## 2026-04-01T16:30:37.193Z

- **priority**: LOW → MEDIUM

## 2026-05-12T21:11:38.076Z

- **status**: NOT STARTED → IN PROGRESS

## 2026-05-12T21:27:01.652Z

- **assignee**: UNASSIGNED → AGENT
- **description**: 20 lines → updated (1 line)

## 2026-05-12T21:32:52.665Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-13T05:09:52.281Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
