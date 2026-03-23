# Jujutsu Command Cheatsheet

This reference provides a quick lookup for common Jujutsu commands and their Git equivalents.

## Terminology Note
- **Commit** and **Revision** are synonyms in Jujutsu
- **Change** refers to a commit as it evolves over time (tracked by change ID)
- **Bookmark** is Jujutsu's equivalent to Git branches

## Basic Operations

| Action | jj Command | Git Equivalent | Notes |
|--------|------------|----------------|-------|
| Show status | `jj st` | `git status` | |
| Show diff | `jj diff` | `git diff` | |
| Commit changes | `jj commit` | `git commit -a` | No staging needed |
| Show log | `jj log` | `git log` | Graphical by default |
| Undo last operation | `jj undo` | Not available | Powerful operation log |
| Redo operation | `jj redo` | Not available | |
| Show operation log | `jj op log` | Not available | |
| Show operation log with patches | `jj op log -p` | Not available | See changes at each operation |

## Working with Commits

| Action | jj Command | Git Equivalent | Notes |
|--------|------------|----------------|-------|
| Edit commit message | `jj describe` | `git commit --amend` | Works on any commit |
| Abandon commit | `jj abandon` | `git reset --hard` | Safer, can be undone |
| Restore files | `jj restore` | `git restore` | |
| Restore file from operation | `jj restore <file> --at-op <id>` | Complex git reflog + checkout | Restore file to specific operation state |
| Create empty commit | `jj new` | `git commit --allow-empty` | |

## Bookmarks (Branches)

| Action | jj Command | Git Equivalent | Notes |
|--------|------------|----------------|-------|
| List bookmarks | `jj b l` | `git branch` | |
| Create bookmark | `jj b c <name>` | `git branch <name>` | |
| Set bookmark | `jj b s <name>` | `git branch -f <name>` | |
| Delete bookmark | `jj b d <name>` | `git branch -d <name>` | |

## Rebasing

| Action | jj Command | Git Equivalent | Notes |
|--------|------------|----------------|-------|
| Rebase branch | `jj rebase -b <branch> -o <dest>` | `git rebase <dest> <branch>` | |
| Rebase commit & descendants | `jj rebase -s <rev> -o <dest>` | Complex `git rebase` | Simpler syntax |
| Insert commit | `jj rebase -r <rev> --before <dest>` | Interactive rebase | Intuitive |

## Git Interoperability

| Action | jj Command | Git Equivalent | Notes |
|--------|------------|----------------|-------|
| Fetch from remote | `jj git fetch` | `git fetch` | |
| Pull from remote | `jj git fetch && jj rebase --onto $BOOKMARK@$REMOTE` | `git pull` | Equivalent workflow |
| Push to remote | `jj git push` | `git push` | |
| Clone repository | `jj git clone` | `git clone` | |
| Initialize repo | `jj git init` | `git init` | Creates Git-backed repo |

## Advanced Features

| Action | jj Command | Git Equivalent | Notes |
|--------|------------|----------------|-------|
| Multiple workspaces | `jj workspace add` | Not available | Work on multiple things |
| Split commit | `jj split` | Interactive rebase | Much simpler |
| Squash commits | `jj squash` | `git rebase -i` | More intuitive |
| Duplicate commit | `jj duplicate` | Cherry-pick | More flexible |

## References

- [[../SKILL.md]]
- [Official J](https://docs.jj-vcs.dev/latest/)
- [Git Command Table](https://docs.jj-vcs.dev/latest/git-command-table/)