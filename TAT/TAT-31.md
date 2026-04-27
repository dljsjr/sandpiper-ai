---
title: "Fix Chorus multiline room message rendering"
status: COMPLETE
resolution: DONE
kind: BUG
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-05-24T17:57:19.038Z
updated_at: 2026-07-11T16:53:29.575Z
---

# Fix Chorus multiline room message rendering

Bug from Chorus dogfood: room message bodies containing newlines can break/mangle the broker-owned room chat widget rendering. Fix in the room widget renderer, not the wire protocol: treat message bodies as multiline content, split/sanitize lines, indent continuation lines under the sender tag, and cap/truncate so one long multiline message cannot blow up the widget.

---

# Activity Log

## 2026-05-24T17:57:29.358Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Librarian

## 2026-05-24T17:57:51.591Z

- **description**: added (1 line)

## 2026-05-25T13:59:17.280Z

- **status**: IN PROGRESS → NEEDS REVIEW
- **assignee**: Librarian → AGENT

## 2026-07-11T16:53:29.575Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
