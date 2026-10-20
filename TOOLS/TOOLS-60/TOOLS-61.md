---
title: "Convert the project index and route global guidance directly to it"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-10-28T16:53:38.823Z
updated_at: 2026-10-28T17:32:56.385Z
---

# Convert the project index and route global guidance directly to it

Preserve the complete current project directory in a backed-up Markdown routing table. Rewire global startup/workflow/role guidance without a projects skill dependency. Remove the old TOON file only after preservation and active consumers are verified.

## Implementation and verification — 2026-10-28

Implemented. ~/.sandpiper/agent/projects.md is a regular, Prettier-formatted Markdown routing table. All 14 original names, exact descriptions/Unicode, checkout paths, active flags, row order and 0644 permissions are preserved. The old TOON file was removed only after byte-identical backup and no-active-consumer review. Canonical global AGENTS/workflow/skill-loading guidance routes directly to the index without a projects skill or registration prompt. Source: pnyrnurl/dff81b69. Preservation evidence and original: /Users/dstephen/.sandpiper/agent/backups/projects-index-20261028-9qr7FI/conversion.json, verification.json and projects.toon. Independent projects-inventory review PASS.

---

# Activity Log

## 2026-10-28T16:56:15.603Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-28T17:12:43.060Z

- **description**: 1 line → updated (5 lines)

## 2026-10-28T17:12:43.120Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-28T17:32:56.385Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
