---
title: "Remove bundled code-review and update discovery/package expectations"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-10-28T17:55:43.724Z
updated_at: 2026-10-28T18:22:55.322Z
---

# Remove bundled code-review and update discovery/package expectations

Use focused failing tests before removal. Remove the Sandpiper source skill, update the catalogue README and source/built/packed tests, retain generic staging-fixture coverage, and verify the package has the other four built-in skills without code-review. No generated-file edits.

## Implementation and verification — 2026-10-28

Implemented in Sandpiper lqwxrkwp/83679fb9. Removed all 11 code-review source files and its catalogue README entry; updated README and source/system-prompt/packed-install expectations to four remaining built-ins. Four relevant tests failed first because code-review was still present. Final bun check zero errors/warnings; bun run test 87 files/640 tests; bun run pack:cli; actual tarball exactly jj, mutation-testing, refactoring, test-driven-development, with no code-review directory. Offline, script-disabled, read-only packed install outside checkout passes. Generic staging fixture data and the retained code-review prompt name are intentionally preserved.

---

# Activity Log

## 2026-10-28T17:57:01.462Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-28T18:08:11.665Z

- **description**: 1 line → updated (5 lines)

## 2026-10-28T18:08:11.727Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-28T18:22:55.323Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
