---
title: "Remove retired TDD skill routing and deployment without losing testing defaults"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-10-28T18:57:43.643Z
updated_at: 2026-11-23T22:02:50.418Z
---

# Remove retired TDD skill routing and deployment without losing testing defaults

## Implementation verified — ready for review

Complete: self-reflect uses project testing guidance/applicable installed skills; source/discovery/diagnostic/packed catalogues expect jj and mutation-testing. Backed up and removed the obsolete Claude symlink and Dotfiles provisioner (vzsmtonk / a721a4f0). Related BUG TOOLS-78 repairs shared-mechanics routes in four identity overlays, preserving their lens-specific content, names and modes. Independent installed copies and historical records were not rewritten.

Verification: bun check clean; 87 Vitest files / 640 tests passed; bun run pack:cli passed, including isolated packed-install checks. Actual tarball contains only jj and mutation-testing skill directories. Independent preservation/routing review passed.

Local revisions: Sandpiper poqzxkxz / 5a0d94c7; canonical global guidance zzuwsomr / 65a3a2ef; Dotfiles vzsmtonk / a721a4f0. All edits are scoped; no remote push or release.

## Earlier scope record

Update active mandatory skill dependencies and catalogue docs without requiring the removed bundle. Preserve test-first defaults in developer guidance. Back up/retire only the obsolete Sandpiper-pointing Claude symlink and its dotfiles provisioner if confirmed. Preserve unrelated independent copies, historical notes, prior archives and global configuration. No archive installation/autoload.

---

# Activity Log

## 2026-10-28T19:35:45.368Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-28T20:11:31.757Z

- **description**: 1 line → updated (11 lines)

## 2026-10-28T20:11:32.306Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-28T20:32:15.131Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:02:50.418Z

- **description**: updated
