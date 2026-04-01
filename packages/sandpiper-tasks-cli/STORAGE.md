# Task Storage Modes

By default, `sandpiper-tasks` stores task files inline on the current branch alongside
your code. This guide explains how to move tasks to a dedicated branch (or a separate
repository) to eliminate the VCS churn that task lifecycle operations produce.

See also: `.sandpiper/docs/task-storage-strategy.md` for the full design rationale.

---

## Configuration

Task storage is configured in one of two places:

| File | Location | Notes |
|------|----------|-------|
| `.sandpiper-tasks.json` | Project root | Wins over settings.json |
| `.sandpiper/settings.json` | `.sandpiper/` dir | Under the `tasks` key |

The standalone file format (`.sandpiper-tasks.json`):

```json
{
  "version_control": {
    "enabled": true,
    "mode": {
      "branch": "sandpiper-tasks"
    },
    "auto_commit": false,
    "auto_push": false
  }
}
```

### Configuration reference

| Field | Default | Description |
|-------|---------|-------------|
| `version_control.enabled` | `true` | VCS-track tasks at all |
| `version_control.mode.branch` | `"@"` | `"@"` = inline; any other value = separate branch name |
| `version_control.mode.repo` | _(omit)_ | External repo URL; omit to use current repo |
| `version_control.auto_commit` | `false` | Auto-commit to task branch after every mutation |
| `version_control.auto_push` | `false` | Auto-push after every auto-commit (requires `auto_commit: true`) |

---

## Storage modes

### Inline mode (default)

```json
{ "version_control": { "mode": { "branch": "@" } } }
```

Tasks are committed inline on whatever branch you are currently on — identical to the
original behaviour. No initialisation required.

---

### Separate-branch mode (current repo)

Tasks live on a dedicated branch (`sandpiper-tasks` in the example below) inside the
same repository. The branch is checked out in a nested workspace/worktree at
`.sandpiper/tasks/`, so it never mingles with your code history.

#### 1. Configure

```json
{
  "version_control": {
    "mode": { "branch": "sandpiper-tasks" }
  }
}
```

#### 2. Initialise

```bash
sandpiper-tasks --dir /path/to/project storage init
```

This creates the workspace/worktree and adds `.sandpiper/tasks/` to the main
branch's `.gitignore`.

**Backend rules:**
- `.jj/` present → `jj workspace add .sandpiper/tasks --revision 'root()'`
- `.git/` only → `git worktree add --orphan -b sandpiper-tasks .sandpiper/tasks`

`storage init` is **idempotent** — safe to run again if partially completed.

#### 3. Migrate existing inline tasks

If you already have tasks on the inline branch, move them to the new workspace:

```bash
sandpiper-tasks --dir /path/to/project storage migrate
```

This snapshots existing task files, bootstraps the workspace, and restores them.

#### 4. Push/pull

```bash
sandpiper-tasks --dir /path/to/project storage sync   # pull then push
sandpiper-tasks --dir /path/to/project storage push   # push only
sandpiper-tasks --dir /path/to/project storage pull   # pull only
```

Remote tracking must be established manually after the first push:

**jj backend**
```bash
cd .sandpiper/tasks
jj git push --bookmark sandpiper-tasks
# future pushes via `storage push` use the same bookmark
```

**git backend**
```bash
cd .sandpiper/tasks
git push --set-upstream origin sandpiper-tasks
```

---

### External-repo mode

Tasks live in a separate repository entirely.

```json
{
  "version_control": {
    "mode": {
      "branch": "main",
      "repo": "git@github.com:your-org/project-tasks.git"
    }
  }
}
```

```bash
sandpiper-tasks --dir /path/to/project storage init
```

This clones the repo into `.sandpiper/tasks/` using the appropriate VCS:
- jj project → `jj git clone --colocate <url> .sandpiper/tasks`
- git project → `git clone <url> .sandpiper/tasks`

---

## Repair guidance

### Workspace deleted / missing

**jj backend — recreate from remote:**

```bash
# In the main repo workspace
jj git fetch --remote origin
jj workspace add .sandpiper/tasks --name tasks --revision 'sandpiper-tasks@origin'
```

**git backend — recreate from remote:**

```bash
git fetch origin
git worktree add .sandpiper/tasks sandpiper-tasks
```

### External clone pointing at wrong remote

Delete the clone and re-initialise:

```bash
rm -rf .sandpiper/tasks
sandpiper-tasks --dir /path/to/project storage init
```

### Diverged task history (push rejected)

Pull first, resolve conflicts, then push:

```bash
sandpiper-tasks --dir /path/to/project storage pull
# resolve any conflicts manually
sandpiper-tasks --dir /path/to/project storage push
```

For jj: `jj rebase -d 'sandpiper-tasks@origin'` in the task workspace to rebase
your local commits on top of the remote, then `storage push`.

---

## `auto_commit` and `auto_push`

When `auto_commit: true`:
- Every `task create`, `task update`, `task pickup`, `task complete`, etc. automatically
  commits the changed files to the task branch with a descriptive message.
- The main repo's working copy is never touched by task operations.

When `auto_push: true` (requires `auto_commit: true`):
- After every auto-commit, changes are pushed to the remote immediately.
- This is opt-in because it requires a working remote connection. Default is `false`.
