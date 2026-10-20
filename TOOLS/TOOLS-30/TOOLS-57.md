---
title: "Review and resolve the remaining bundled skills"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-10-28T14:17:40.280Z

depends_on:
  - TOOLS-60
  - TOOLS-64
updated_at: 2026-10-28T22:08:09.135Z
---

# Review and resolve the remaining bundled skills

## Six-skill review accepted and complete — 2026-10-28

User explicitly requested closing all skill-resource review/extraction tickets. This closes the six-skill inclusion/extraction review only: projects, code-review, refactoring, TDD, mutation-testing and jj. It does not close prompt/theme reviews, deferred SOP redesigns, standalone Trail integration, WIP jj replacement AGENT-67, or updater lifecycle bug TOOLS-87.

All six outcomes are implemented and accepted. Sandpiper now bundles zero skills; five complete skills are preserved unchanged in the incubator, while projects was retired in favor of the preserved Markdown routing index. Custom/project/optional-package skill support remains. Final closeout verification: mutable fixture-array copy resolves TS4104; bun check is clean, full Vitest gate passes 87 files/642 tests with no unhandled errors, and bun run pack:cli passes. Actual tarball has zero built-in skills and no archive/replacement/test-fixture entries. Independent preservation/routing review passed; final artifact/preservation checks are recorded in ~/.sandpiper/agent/backups/jj-unbundle-20261028-3NFgBZ/preservation-after.json.

TOOLS-79–86 are COMPLETE/DONE. TOOLS-58 (six prompts) and TOOLS-59 (README-only themes scaffold) remain NOT STARTED, so TOOLS-30 stays IN PROGRESS and TOOLS-33 remains NEEDS REVIEW. No prompt/theme inclusion decisions were assumed.

## Earlier decision and progress history

## Current jj decision — 2026-10-28

User explicitly chose jj extraction and asked to check the believed incubator copy. No incubator jj exists; preserve the bundled 16-file/188,007-byte version there before removal under TOOLS-83–86. The separate replacement at ~/git/jujutsu-vcs-skill remains WIP (AGENT-67); do not install, edit or adopt it. All six inclusion decisions are now made, but jj implementation is in progress and mutation TOOLS-79–82 still awaits acceptance. Prompts/themes remain unreviewed; TOOLS-57/30 stay open.

## Previous status records

## Current implementation status — 2026-10-28

Approved mutation-testing extraction is implemented and verified under TOOLS-79–82, ready for user review but not yet accepted. Five inclusion decisions have been made; the first four implementations were already accepted. jj is the only undecided skill. TOOLS-57/30 remain IN PROGRESS. Prompt/theme review is separate; no jj or rewrite decision is implied.

## Earlier status records

## Current approved mutation-testing decision — 2026-10-28

User agreed to preserve the seven-file mutation-testing skill unchanged in the incubator and unbundle it. Retain the core survivor-interpretation rule in developer testing guidance; do not import score or CI policies. Implementation is TOOLS-79–82 and is not yet accepted. Existing unrelated testing/greenfield policies and independent installed copies remain unchanged. No new framework installation, archive auto-loading or separate SOP rewrite is authorized. jj remains undecided; this task and TOOLS-30 stay open.

## Earlier status records

## Current acceptance and discussion — 2026-10-28

User accepted the TDD implementation and related identity-routing repair ("Nice, next?"). TOOLS-74–78 are COMPLETE/DONE. Four of the original six skill outcomes are now accepted: projects, code-review, refactoring and test-driven-development. TDD remains autonomous; no routine human approval gate was introduced.

The requested next one-by-one discussion is mutation-testing (5 of 6), followed by jj. No inclusion, extraction or rewrite decision for mutation-testing or jj is approved. TOOLS-57 and TOOLS-30 remain IN PROGRESS; prompt/theme reviews remain separate.

## Previous status records

## Current implementation status — 2026-10-28

TDD unbundling and autonomous developer-role guidance are implemented and verified under TOOLS-74–77; TOOLS-78 fixes the overlooked identity-overlay callers. All are ready for user review, not final acceptance. Four shipping decisions have been made; projects/code-review/refactoring implementations were already accepted. Mutation-testing and jj remain undecided. This task and TOOLS-30 stay IN PROGRESS. Historical human-confirmation wording below is superseded by the explicit autonomous-TDD correction; it is not policy.

## Current TDD clarification — 2026-10-28

User wants autonomous one-test RED/GREEN/REFACTOR cycles, not human approval between phases. The earlier human-gate interpretation below was the assistant's mistake. TDD unbundling is approved under TOOLS-74 with the core loop retained in developer-role guidance. Mutation-testing and jj remain undecided.

## Earlier review history

Continue the interrupted resources review for the six retained skills: projects, code-review, refactoring, test-driven-development, mutation-testing and jj. Review their purpose, ownership and suitability as Sandpiper built-ins. Record the user's keep/remove/extract decisions; make no assumed selections. Apply any approved changes, update affected discovery/staging/docs/tests, and verify them before requesting acceptance. Inventory alone or green tests alone do not complete this subtask.

## Ownership and shipping review — 2026-10-28

Confirmed six skill directories and 47 files: Markdown instructions/references plus the jj trigger-evaluation JSON. No skill supplies executable helpers, dependency installs, or a separate build. Each source SKILL.md matches its staged built copy.

projects is Sandpiper-specific: it owns instructions for ~/.sandpiper/agent/projects.toon and refers to optional external Journal. code-review, refactoring, test-driven-development and mutation-testing are generic coding-workflow guidance that can function as opinionated Sandpiper defaults. jj is generic VCS guidance with an existing separately owned rewrite under AGENT-67/AGENT-317 in ~/git/jujutsu-vcs-skill; do not duplicate that work here.

Recommendation, NOT yet approved: retain all six as current bundled defaults; handle any jj replacement through the existing rewrite. Extracting Markdown alone does not remove Trail/standup-style executable build complexity. This review concerns inclusion and ownership, not a rewrite or full technical validation of every skill reference. No skill contents, discovery behavior, or package wiring changed. Await the user's shipping/ownership decision before marking this subtask complete.

User response: declined the keep-all-six confirmation and chose to discuss changes. No keep/remove/extract decisions are approved yet. This task remains IN PROGRESS; do not treat the recommendation above as acceptance.

Approved projects decision: remove the bundled projects skill, convert the global registry into a Markdown routing index, and rewire active guidance directly to it. Implementation is tracked by TOOLS-60. The user requested one-by-one discussion; no decisions about the other five skills are approved.

Projects implementation is now ready for review under TOOLS-60 and children TOOLS-61/62/63. One of six shipping decisions is resolved: remove projects skill and use the direct Markdown project index. The other five skill discussions remain open. This subtask and the broader build task remain IN PROGRESS.

User accepted projects implementation; TOOLS-60 and its three children are COMPLETE/DONE. Continuing the requested one-by-one discussion with code-review (second of the original six skills). No keep/remove/extract or content-rewrite decision is approved for code-review or the other four remaining skills.

Code-review discussion: the user identifies it as an early custom skill with likely extraneous material, wants a drastic rework, values codified review SOPs, and questions both the current SOP quality and harness bundling. No keep/remove/extract decision or rewrite scope is approved yet. Do not treat moving the existing text unchanged as satisfying the requested rethink.

Approved code-review decision: unbundle it, preserve its complete current contents under ~/git/skills-incubator/skills/code-review, and handle a drastic SOP redesign separately. Unbundling is TOOLS-64; deferred SOP design is TOOLS-68. No auto-loading of the archive or decisions about the other four remaining skills are approved.

Code-review unbundling/archival is implemented and awaits user review in TOOLS-64. Two original shipping decisions are made (projects and code-review); the other four skills remain undecided. Independent SOP redesign is deferred under TOOLS-68 and does not gate packaging cleanup.

User accepted code-review unbundling/archival; TOOLS-64 and its children are COMPLETE/DONE. Continue one-by-one with refactoring (3 of the original 6). No shipping, extraction or rewrite decision is approved for refactoring or the other three remaining skills.

Approved refactoring decision: preserve unchanged under ~/git/skills-incubator/skills/refactoring, remove the bundled copy, and rethink its SOP separately. Unbundling is TOOLS-69; deferred rethink is TOOLS-73. Only dependency-routing maintenance in retained guidance is approved. No decision about the other three remaining skills is made.

Refactoring unbundling/archival is implemented and awaits user review in TOOLS-69; its SOP rethink is deferred as TOOLS-73. Three original shipping decisions are made (projects, code-review, refactoring). Remaining undecided skills are jj, mutation-testing and test-driven-development. TDD received only an optional-dependency sentence, not a shipping/content-review decision.

User accepted refactoring implementation; TOOLS-69 and children are COMPLETE/DONE. Continue one-by-one with test-driven-development (4 of the original 6), followed by the still-undecided mutation-testing and jj. No TDD shipping or rewrite decision is approved yet.

Approved TDD decision: move the full skill to the incubator and rely on developer-role guidance. Preserve the user-confirmed RED checkpoint and one-behavior red-green-refactor loop; the earlier criticism of that checkpoint as unnecessary overhead was incorrect. Implementation is TOOLS-74. First pause at one demonstrated RED test for user confirmation before production changes. No TDD rewrite is authorized; mutation-testing and jj remain undecided.

---

# Activity Log

## 2026-10-28T15:22:43.739Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-28T15:26:05.387Z

- **description**: 1 line → updated (9 lines)

## 2026-10-28T16:05:09.412Z

- **description**: 9 lines → updated (11 lines)

## 2026-10-28T16:53:39.093Z

- **description**: 11 lines → updated (13 lines)
- **depends_on**: (none) → TOOLS-60

## 2026-10-28T17:12:43.733Z

- **description**: 13 lines → updated (15 lines)

## 2026-10-28T17:32:56.683Z

- **description**: 15 lines → updated (17 lines)

## 2026-10-28T17:50:25.518Z

- **description**: 17 lines → updated (19 lines)

## 2026-10-28T17:55:43.992Z

- **description**: 19 lines → updated (21 lines)
- **depends_on**: TOOLS-60 → TOOLS-60, TOOLS-64

## 2026-10-28T18:13:33.971Z

- **description**: 21 lines → updated (23 lines)

## 2026-10-28T18:22:55.570Z

- **description**: 23 lines → updated (25 lines)

## 2026-10-28T18:29:07.850Z

- **description**: 25 lines → updated (27 lines)

## 2026-10-28T18:38:20.057Z

- **description**: 27 lines → updated (29 lines)

## 2026-10-28T18:49:23.980Z

- **description**: 29 lines → updated (31 lines)

## 2026-10-28T18:57:43.838Z

- **description**: 31 lines → updated (33 lines)

## 2026-10-28T19:31:43.799Z

- **description**: 33 lines → updated (39 lines)

## 2026-10-28T20:11:31.947Z

- **description**: 39 lines → updated (43 lines)

## 2026-10-28T20:35:43.470Z

- **description**: 43 lines → updated (51 lines)

## 2026-10-28T20:46:21.173Z

- **description**: 51 lines → updated (57 lines)

## 2026-10-28T20:59:21.825Z

- **description**: 57 lines → updated (63 lines)

## 2026-10-28T21:17:58.727Z

- **description**: 63 lines → updated (69 lines)

## 2026-10-28T22:06:43.076Z

- **description**: 69 lines → updated (79 lines)

## 2026-10-28T22:07:28.416Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-28T22:07:28.520Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-10-28T22:08:09.136Z

- **description**: updated
