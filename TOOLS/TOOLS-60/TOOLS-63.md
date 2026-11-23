---
title: "Route affected project guidance directly to the Markdown project index"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-10-28T16:53:38.969Z
updated_at: 2026-11-23T22:02:55.598Z
---

# Route affected project guidance directly to the Markdown project index

Inventory active project guidance referring to the projects skill or projects.toon, resolve canonical owners and pre-existing work, update only current guidance, and classify historical/data references rather than rewriting them. Preserve portability and unrelated state.

## Implementation and verification — 2026-10-28

Implemented and independently swept. Dotfiles source lnltrmkv/717ff7a3 updates the Claude project-index row and deletes the retired symlink_projects.tmpl provisioner. The deployed Claude Code global guidance changes by exactly that row; the user's Claude Code projects skill is removed. The existing source/deployed Journal paragraph difference is byte-preserved. Roux's active MEMORY.md differs only by the one projects.toon-to-projects.md filename substitution, with mode/other bytes preserved. Roux had no live peer; a scoped async notice was written before editing and updated with verification. No remaining active old-index/skill consumers found. Residual dated notes, retired memory-analysis output, review records, closed task history, captured prompts and backups remain intentionally unchanged. No unrelated project guidance required edits.

---

# Activity Log

## 2026-10-28T17:02:21.306Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-28T17:12:43.398Z

- **description**: 1 line → updated (5 lines)

## 2026-10-28T17:12:43.458Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-28T17:32:56.509Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:02:55.598Z

- **description**: updated
