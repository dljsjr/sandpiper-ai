---
title: "Skills section names the skill or read tool without checking the model can use it"
status: COMPLETE
resolution: DONE
kind: BUG
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-11-17T20:06:35.474Z
updated_at: 2026-11-18T18:34:57.320Z
---

# Skills section names the skill or read tool without checking the model can use it

Sandpiper renders its own `<skills>` section and picks the load instruction from the full selected-tool list: "Use the `skill` tool…" when `skill` is selected, otherwise "Use the `read` tool…". Pi checks what the model can actually call (declared tools, not hidden ones). Confirmed with the diagnostic: `--tools bash` tells the model to use `read`, which it does not have; `--no-tools` renders a skills section naming `read`, where Pi renders none; in codemode `only` mode `skill` is hidden but Sandpiper still names it.

## Decision (Doug)

- Do not copy Pi's reader-choice branches. When the `skill` tool is not reachable, leave `systemPromptOptions.skills` intact so Pi renders its own `<skills>` section (read, bash, no-tool wording, or omitted). Pi's format applies in that case.
- Sandpiper renders its section only when `skill` is reachable: declared (selected and not hidden), or `deferred` exposure with `tool_search` declared. In the deferred case the instruction says to load it with `tool_search` first.
- Hidden behind codemode counts as not reachable.

---

# Activity Log

## 2026-11-17T20:07:03.554Z

- **description**: added (7 lines)

## 2026-11-17T20:07:03.655Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-17T20:17:57.553Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-18T18:34:57.320Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
