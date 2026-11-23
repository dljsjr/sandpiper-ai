---
title: "Retire the projects skill and replace its registry with a Markdown project index"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-10-28T16:53:38.686Z
updated_at: 2026-11-23T22:02:38.711Z
related:
  - TOOLS-57
  - TOOLS-30
---

# Retire the projects skill and replace its registry with a Markdown project index

User approved the projects decision during the one-by-one skills review: remove the bundled projects skill, convert the existing global projects.toon registry to a regular Markdown routing table in the user's global agent setup, and update active global/project guidance to refer to the index directly. Preserve every project entry and field; back up original user state before conversion. Inventory canonical source ownership and dirty states before edits; preserve unrelated work, historical notes, archives and closed tasks. Update discovery/packaging expectations and verify the built/packed catalogue without projects. No new CLI, automatic discovery, registry engine, or decisions about the other five skills. Verification and integration acceptance belong to this parent; leave completion for user review.

## Implementation ready for user review — 2026-10-28

All three scoped changes are implemented and independently reviewed with no remaining active-consumer or preservation blocker. Sandpiper source qyrnsszt/a447db7e, canonical global guidance pnyrnurl/dff81b69, dotfiles lnltrmkv/717ff7a3; all three checkouts are clean. Unversioned state: new global project index, retired old TOON and Claude link, one-row deployed Claude update, one-filename Roux standing-rule update, and scoped offline notice.

Verification: three relevant tests failed first on the retained projects skill; final bun check zero errors/warnings, bun run test 87files/640tests, bun run pack:cli, five-entrypoint tarball/absence inspection, Prettier check, 14-record exact field/order/mode checks, exact unrelated-content preservation for deployed guidance/memory, and independent active-guidance scan. All preserved history/closed records remain historical rather than rewritten for keyword-zero.

TOOLS-60 and children are NEEDS REVIEW, not final-completed. TOOLS-57 remains IN PROGRESS for the other five skill discussions; TOOLS-30 and TOOLS-33 are not closed by this work. No prompt/theme or other skill decisions, new CLI/registry engine, publishing, or unrelated cleanup occurred.

## User acceptance — 2026-10-28

The user accepted the guidance locations, confirmed the skill was removed from the repository and packed output, and directed the discussion to the next skill. Final-complete only this projects implementation and its three children. The other five skill decisions and the broader build work remain open.

---

# Activity Log

## 2026-10-28T16:53:38.765Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-28T17:12:43.566Z

- **description**: 1 line → updated (9 lines)

## 2026-10-28T17:12:43.626Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-28T17:32:56.324Z

- **description**: 9 lines → updated (13 lines)

## 2026-10-28T17:32:56.571Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:02:38.711Z

- **description**: updated
