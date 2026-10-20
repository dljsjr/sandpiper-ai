---
title: "Rewrite jj skill: research spike + restructure into SKILL.md + per-workflow reference docs"
status: COMPLETE
resolution: WONTFIX
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-04-21T15:53:05.818Z
updated_at: 2026-11-19T18:58:29.576Z
---

# Rewrite jj skill: research spike + restructure into SKILL.md + per-workflow reference docs

Revise the bundled jj skill (packages/resources/skills/sandpiper/jj: SKILL.md + 14 references + evals/triggers.json, ~5,050 lines) for jj 0.46.0. The skill's newest version references are 0.40.0; Doug runs 0.46.0.

Discovery (2026-10-17):
- Sources of truth: the 0.46 binary (`jj util markdown-help` = full CLI reference, 125 commands; `jj help -k bookmarks|config|filesets|glossary|revsets|templates|tutorial`), and the changelog 0.41.0-0.46.0 (docs.jj-vcs.dev/latest/changelog).
- Missing from the skill entirely: `jj converge` (0.45), `jj workspace remove` (0.46), colocated workspaces via Git worktrees (`workspace add --[no-]colocate`, `git.colocate`, `jj git colocation` on child workspaces; `workspace forget` now removes the worktree) (0.46), `jj run` (0.43/0.44), `jj file edit`/`file delete` (0.46), `merge_point()`/`forks()` revsets, `try()`/`replace()`/`json()` map templates, `templates.workspace_list` + roots in `workspace list` (0.44), tag tracking (`jj tag track`, `fetch-tags`, `--tag=`) (0.44), `--no-integrate-operation` (0.41), `builtin_log()` (0.44), `revsets.git-push` and multi-remote push (0.46).
- Breaking changes that can make current guidance wrong: `jj undo`/`redo` refuse cross-workspace ops without `--allow-cross-workspace` (0.46; affects op-log recovery and parallel-agents); `jj split` single editor session (0.46); Git-like symbols such as refs/heads/main no longer resolve, git_head()/git_refs() removed (0.43); `jj git push --all` pushes tags (0.44); List.get/first/last return Option and WorkspaceRef.root() returns Option<FsPath> (0.44/0.46); `jj file search` defaults to regex (0.41); removed deprecated flags (commit/describe --author/--reset-author, describe --no-edit/--edit, git push --allow-new) (0.42); `jj config set --user` targets the first user file (0.45).
- Already covered but older than assumed: `jj simplify-parents` (0.23) and `jj rebase --simplify-parents` (0.39).
- Note: the skill bans interactive flags (`-i`); 0.44 added `jj absorb -i`, which stays banned for agents.

## Closed in backlog triage (2026-11-19)

The jj skill is no longer bundled with Sandpiper; the jj 0.46 rewrite continues in ~/git/jujutsu-vcs-skill. Its two research notes moved to .sandpiper/archive/.

---

# Activity Log

## 2026-10-17T18:10:32.323Z

- **description**: added (8 lines)

## 2026-10-17T18:23:21.423Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-19T18:58:28.506Z

- **description**: 8 lines → updated (12 lines)

## 2026-11-19T18:58:29.576Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: UNRESOLVED → WONTFIX
