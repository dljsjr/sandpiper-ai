---
title: "Reconcile Birdup after removing agency prompt block"
status: NEEDS REVIEW
kind: TASK
priority: HIGH
assignee: "Piper"
reporter: USER
created_at: 2026-08-11T21:26:48.667Z
updated_at: 2026-10-07T14:12:45.049Z
related:
  - AGENT-271
---

# Reconcile Birdup after removing agency prompt block

Complete and verify the user's removal of Birdup's agency prompt block. Remove stale editor provenance, scaffold references, imports, and agency-specific tests without disturbing the user's prompt rewrites; verify the rendered Roux prompt and wheel contain no agency block or resources.

## Leftovers found during AGENT-304 (2026-10-07), not fixed

- `src/birdup/resources/scaffolds/AGENTS.md.tmpl` lines 22-28 document `persona_latch`, `execution_policy`, `tool_discipline`, `output_contract`, `completion_contract`, and `dissent_contract` as harness-injected blocks. Only `persona_latch` still renders (in the committed state); the other five no longer exist.
- `src/birdup/prompt_editor.py` lines 98-99 still list `orientation.md` and `persona-latch.md` in the editable prompt files. The uncommitted work in the default birdup workspace deletes both files; non-file paths are skipped, so this is harmless today.
- The committed `cli.py` still passes `orientation.md` as `--append-system-prompt`. It duplicates the session-start rule in the global AGENTS.md.
- The default birdup workspace also holds uncommitted work that removes the orientation and persona-latch blocks and rewrites the prompt resources. `tests/test_cli.py::test_rebuilds_raw_prompt_flags_from_current_resource_files` fails against it because it still expects the orientation append.

---

# Activity Log

## 2026-08-11T21:26:48.769Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Piper

## 2026-08-11T21:44:32.982Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-07T14:12:36.517Z

- **description**: 1 line → updated (8 lines)

## 2026-10-07T14:12:45.051Z

- **description**: updated
