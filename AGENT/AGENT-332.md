---
title: "Archive the completed Pi migration spec and Pi 1.5 audit, moving live content out first"
status: COMPLETE
resolution: DONE
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: USER
created_at: 2026-11-17T20:58:49.510Z
updated_at: 2026-11-18T18:56:58.274Z
---

# Archive the completed Pi migration spec and Pi 1.5 audit, moving live content out first

## Outcome (lzmnmnns)

Both documents moved to `.sandpiper/archive/` with a pointer line; still-live content (request invariants, request shape, the prompt-change canary, provider neutrality) moved into `sandpiper-system-prompt.md`; one AutoTOON sentence into `docs/features/autotoon-architecture.md`; inbound links fixed. Defects found in the audit filed as AGENT-333 and AGENT-334.

## Follow-up sweep (utxlrtlo, ktyptnsy)

Doug ruled the open questions from the first pass a manufactured decision: outdated docs get updated or archived without asking. Done:

- The six unauthorized adoption candidates now live in `.sandpiper/docs/specs/pi-adoption-candidates.md`, each with its checked state and trigger; the documentation playbook names `.sandpiper/docs/` as the home for idea lists.
- `pi-1-0-prompt-sections.md` renamed to `pi-prompt-sections.md` and brought to Pi 1.5.2.
- Seven finished specs and three TOOLS-30 handoff notes archived after moving live content into the web-fetch, web-search and integration READMEs and `docs/dev/build-system.md`.
- Background process sketch archived; `.sandpiper/docs/specs/background-processes.md` written from the code; AGENT-335 filed.
- Broken archive links fixed, including the AGENT-301 build-system link.

No open questions remain.

---

# Activity Log

## 2026-11-17T21:08:57.302Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-11-17T21:09:11.905Z

- **description**: added (7 lines)

## 2026-11-18T18:34:57.322Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-18T18:56:58.280Z

- **description**: 7 lines → updated (15 lines)
