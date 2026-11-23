---
title: "Reorganize Birdup so system prompt sections are easy to edit, without behavior change"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-11-12T20:41:38.244Z
updated_at: 2026-11-23T22:02:41.434Z
---

# Reorganize Birdup so system prompt sections are easy to edit, without behavior change

Refactor the separate birdup repository so the code is clean and organized and system prompt sections are easy to add, remove, reorder, and edit, with no behavior change.

## Constraints

- Launch argv and the `--identity` / `--append-system-prompt` payloads stay byte-identical for the same inputs. Prompt text is not edited (Doug is midway through slimming it).
- Out of scope because they change behavior: the probable missing "not" in birdup's identity intro prompt, the registry writer emitting invalid TOML for non-BMP characters, `interaction-style.md` drift from Sandpiper's block, `pi-ext/system-notification.ts` drift from Sandpiper's core module.
- The prompt editor stays decoupled from the section order: it renders in Sandpiper order and keeps locked Sandpiper sections. It only needs to know which Birdup files are editable candidates.

## Plan

1. Characterization tests pinning exact argv and payloads (IDENTITY only; with SELF frontmatter; with BOOTSTRAP.md; with PERSONA_LATCH=1) and `--init` scaffold output; plus a before/after argv diff for the real identities.
2. One ordered declaration of Birdup's prompt sections in `birdup/system_prompt.py`; the editor discovers editable candidates from `resources/prompts/*.md`.
3. Split `cli.py` by responsibility (registry, scaffold, prompt assembly, CLI/launch); identities become a typed dataclass.
4. `pi-ext/` under tsc and biome; unused imports/exports removed; exact-pinned `@earendil-works/pi-coding-agent` devDependency replaces the hard-coded `sandpiper-ai/node_modules` path.
5. Dead code, stale comments, and duplicated path joining in `content.py`.

## Outcome

Five commits in the separate birdup repository on top of `rwtwmrtz`: `xnmqqoxo` (tests), `uxmnmtzu` (section list), `mnktrqxy` (module split), `ltlplkwx` (pi-ext gates), `wmlvkoyv` (cleanup). `cli.py`'s dead `_MEMORY_ROW` went in the split.

Verification at the tip: 50 Python tests, 12 Bun tests, `tsc`, biome, ruff clean. Launch argv, `--identity` and `--append-system-prompt` payloads byte-identical to the pre-refactor baseline for the 4 real identities and 16 synthetic cases; the editor maps the same 10 regions for Huginn; both extensions return the same messages; a `PERSONA_LATCH=1` render loads both and gives the same 67,172-character prompt.

Found and left alone (behavior): extra CLI args are placed before `--identity`, so `birdup <name> -- text` puts `--identity …` after `--`. The pi-ext devDependency means a future runtime (non-type) import of Pi from pi-ext would resolve to Birdup's copy, not the host's.

---

# Activity Log

## 2026-11-12T20:41:43.483Z

- **description**: added (15 lines)

## 2026-11-12T20:41:43.620Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-12T20:53:46.329Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-12T20:54:00.078Z

- **description**: 15 lines → updated (23 lines)

## 2026-11-18T18:34:57.318Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:02:41.434Z

- **description**: updated
