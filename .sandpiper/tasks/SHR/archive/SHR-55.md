---
title: "OSC terminal query sequences leak as visible text in enhanced mode"
status: COMPLETE
resolution: DONE
kind: BUG
priority: LOW
assignee: AGENT
reporter: USER
created_at: 2026-03-23T06:10:06.068Z
updated_at: 2026-03-23T15:39:59.146Z
---

# OSC terminal query sequences leak as visible text in enhanced mode

Programs like jj emit OSC escape sequences (^[]10;... ^[]11;... ^[[?62;4c) to query the terminal for its foreground/background colors and device attributes. In enhanced mode, unbuffer-relay creates a PTY that cannot respond to these queries, so the raw sequences pass through and appear as visible text in the pane and in captured stdout. This is cosmetic — commands execute correctly. Possible fixes: configure the PTY's TERM to something that doesn't trigger these queries, or filter known OSC query sequences from the output.

---

# Activity Log

## 2026-03-23T06:10:12.747Z

- **description**: added (1 line)

## 2026-03-23T15:34:19.341Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-23T15:39:59.146Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: DONE
