# Trail storage

Trail stores task files under `.sandpiper/tasks/`. By default, those files live on the same branch as your code. For busy projects, Trail can also keep the task store on a dedicated branch or in an external repository.

## Choose a storage mode

| Mode            | Use when                                      | Configuration                                     |
| --------------- | --------------------------------------------- | ------------------------------------------------- |
| Inline          | You want the simplest setup                   | `branch: "@"` or no storage config              |
| Separate branch | You want tasks out of normal code diffs       | `mode.branch` set to a branch name                |
| External repo   | You want task history outside the code remote | `mode.repo` set to a repository URL or local path |

## Configure storage

Trail reads task storage configuration from either:

1. `.sandpiper-tasks.json` at the project root
2. `.sandpiper/settings.json` under the `tasks` key

`.sandpiper-tasks.json` wins when both files exist. The filename is retained for compatibility with existing Sandpiper task stores.

A complete `.sandpiper-tasks.json` looks like this:

```json
{
  "version_control": {
    "enabled": true,
    "mode": {
      "branch": "trail-tasks"
    },
    "auto_commit": false,
    "auto_push": false
  }
}
```

## Use inline mode

Inline mode is the default:

```json
{
  "version_control": {
    "mode": { "branch": "@" }
  }
}
```

In inline mode, task file changes appear in your normal VCS status and are committed with code. Create `.sandpiper/tasks/` before using task or project commands in a new repository:

```bash
mkdir -p .sandpiper/tasks
```

## Use a separate branch

Separate-branch mode keeps `.sandpiper/tasks/` checked out as a nested workspace or worktree.

Configure a branch name:

```json
{
  "version_control": {
    "mode": { "branch": "trail-tasks" },
    "auto_commit": false,
    "auto_push": false
  }
}
```

Initialize the task workspace:

```bash
trail storage init
```

If you already have inline task files, migrate them:

```bash
trail storage migrate
```

Sync with the remote after remote tracking is configured:

```bash
trail storage sync
trail storage pull
trail storage push
```

### Establish remote tracking

For a jj-backed repository, enter the task workspace and push the bookmark:

```bash
cd .sandpiper/tasks
jj git push --bookmark trail-tasks
```

For a Git worktree, push the branch:

```bash
cd .sandpiper/tasks
git push --set-upstream origin trail-tasks
```

## Use an external repository

External-repo mode stores `.sandpiper/tasks/` as a clone of another repository:

```json
{
  "version_control": {
    "mode": {
      "branch": "main",
      "repo": "git@github.com:example/project-tasks.git"
    },
    "auto_commit": false,
    "auto_push": false
  }
}
```

Initialize or migrate as usual:

```bash
trail storage init
trail storage migrate
```

Then sync with:

```bash
trail storage sync
```

## Auto-commit and auto-push

`auto_commit` commits task changes after every mutation when tasks are stored on a separate branch or in an external repository:

```json
{
  "version_control": {
    "mode": { "branch": "trail-tasks" },
    "auto_commit": true,
    "auto_push": false
  }
}
```

`auto_push` pushes after each auto-commit:

```json
{
  "version_control": {
    "mode": { "branch": "trail-tasks" },
    "auto_commit": true,
    "auto_push": true
  }
}
```

Only enable auto-push when the task remote is reliable and shared pushes are expected.

## Repair stale indexes

The task index is derived from files on disk. Rebuild it after manual edits, merges, or storage repair:

```bash
trail index update
```

## Commit both sides after migration

After `storage init` or `storage migrate`, commit both the main workspace and the task workspace when applicable:

- main workspace: configuration changes, `.gitignore` updates, and removed inline task files
- task workspace: imported task files

This keeps the code branch and task branch consistent for the next checkout.
