---
name: gh
description: >
  Use this skill whenever the user wants to use the GitHub CLI (`gh`) or interact with GitHub
  from the command line. Triggers include: any mention of "gh", "github cli", gh commands
  (gh pr, gh issue, gh repo, gh run, gh api, gh search, gh browse, gh release, gh gist,
  gh codespace, gh project, gh workflow, gh extension, gh secret, gh variable, gh auth),
  GitHub API scripting, creating/managing PRs or issues via CLI, GitHub Actions management,
  exploring repos without cloning, code search from terminal, or GitHub automation. Also
  trigger for gh api as a REST/GraphQL wrapper, gh extensions, JSON/JQ/template formatting,
  secrets/variables, or GitHub Enterprise. Always consult before running gh commands — covers
  auth, repos, PRs, issues, CI/CD, API wrapper, search, extensions, and multi-account setup.
  Do NOT confuse with generic git commands.
---

# GitHub CLI (`gh`) — Complete Reference Skill

`gh` is GitHub's official CLI. It brings pull requests, issues, Actions, code search, the
full REST/GraphQL API, and more into your terminal. It works with github.com and GitHub
Enterprise Server/Cloud.

**Before running commands, read this file fully.** For the complete API wrapper reference
(REST, GraphQL, pagination, JQ, templates), read `references/api.md`. For the full
command reference with all subcommands and flags, read `references/commands.md`.

---

## Authentication and setup

### Installing gh

```bash
# macOS
brew install gh

# Debian/Ubuntu
(type -p wget >/dev/null || sudo apt install wget) && \
sudo mkdir -p -m 755 /etc/apt/keyrings && \
wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null && \
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null && \
sudo apt update && sudo apt install gh

# Fedora/RHEL
sudo dnf install gh

# Windows
winget install --id GitHub.cli
# or: scoop install gh / choco install gh

# Arch
sudo pacman -S github-cli
```

### Authentication

```bash
gh auth login                          # Interactive: choose host, protocol, auth method
gh auth login --web                    # Browser OAuth flow
gh auth login --with-token < token.txt # Token from stdin (for CI/scripts)
gh auth login --hostname ghes.corp.com # GitHub Enterprise Server
gh auth login --scopes read:project    # Request additional OAuth scopes
gh auth login --git-protocol ssh       # Configure git to use SSH

gh auth status                         # Check auth status for all hosts
gh auth token                          # Print current token
gh auth token --hostname ghes.corp.com # Token for specific host
gh auth refresh --scopes admin:org     # Add scopes to existing auth
gh auth switch                         # Switch between accounts on same/different hosts
gh auth setup-git                      # Configure git credential helper
gh auth logout                         # Log out
```

### Environment variables (precedence: env vars override stored credentials)

```bash
GH_TOKEN / GITHUB_TOKEN               # Auth token for github.com (highest precedence)
GH_ENTERPRISE_TOKEN / GITHUB_ENTERPRISE_TOKEN  # Token for Enterprise Server hosts
GH_HOST                               # Default hostname when not in a repo
GH_REPO                               # Override repo in [HOST/]OWNER/REPO format
GH_CONFIG_DIR                         # Config directory (default: ~/.config/gh)
GH_EDITOR                             # Editor for prompts
GH_BROWSER                            # Browser for web commands
GH_PAGER                              # Pager (default: system pager)
GH_DEBUG=1                            # Enable debug output (GH_DEBUG=api for HTTP logs)
GH_FORCE_TTY=120                      # Force TTY output in pipes (value = column width)
NO_COLOR=1                            # Disable color output
GH_PROMPT_DISABLED=1                  # Disable interactive prompts
GH_NO_UPDATE_NOTIFIER=1               # Suppress update notifications
```

### Configuration

```bash
gh config set editor vim               # Set global config
gh config set git_protocol ssh -h ghes.corp.com  # Per-host config
gh config get pager                    # Read config value
gh config list                         # List all config
gh config clear-cache                  # Clear API caches

# Config file: ~/.config/gh/config.yml (global), hosts.yml (per-host credentials)
```

---

## Repository operations

```bash
# Cloning
gh repo clone owner/repo              # Clone a repo
gh repo clone owner/repo -- --depth 1 # Pass flags to git clone

# Creating
gh repo create myrepo --public         # Create new empty repo
gh repo create myrepo --private --clone # Create and clone locally
gh repo create --source=. --push       # Push existing local project to new repo
gh repo create --template owner/tmpl   # Create from template repo
gh repo create --add-readme --license mit --gitignore Go

# Forking
gh repo fork owner/repo               # Fork to your account
gh repo fork owner/repo --clone       # Fork and clone
gh repo fork --org myorg              # Fork into an organization

# Viewing
gh repo view                           # View current repo README
gh repo view owner/repo                # View any repo
gh repo view --json name,description,stargazerCount  # JSON output
gh repo view --web                     # Open in browser

# Listing
gh repo list                           # Your repos
gh repo list owner --limit 50          # Someone else's repos
gh repo list --language rust --visibility public --source  # Filter repos
gh repo list --json name,isPrivate --jq '.[].name'  # Scripted output

# Managing
gh repo edit --enable-auto-merge --enable-squash-merge  # Edit settings
gh repo edit --visibility private      # Change visibility
gh repo rename new-name                # Rename
gh repo archive                        # Archive
gh repo unarchive                      # Unarchive
gh repo delete --yes                   # Delete (requires confirmation)
gh repo sync                           # Sync fork with upstream
gh repo set-default owner/repo         # Set default repo for ambiguous remotes

# Other repo commands
gh repo deploy-key add key.pub --title "CI key"
gh repo deploy-key list
```

---

## Pull requests — full lifecycle

### Creating PRs

```bash
gh pr create                           # Interactive creation
gh pr create --title "Fix bug" --body "Details here"
gh pr create --fill                    # Auto-fill title/body from commits
gh pr create --fill-first              # Fill from first commit only
gh pr create --draft                   # Create as draft
gh pr create --base main --head feature # Explicit branches
gh pr create --reviewer user1,team:reviewers  # Assign reviewers
gh pr create --assignee @me            # Self-assign
gh pr create --label bug,priority      # Add labels
gh pr create --milestone v2.0          # Set milestone
gh pr create --project "Sprint 5"      # Add to project
gh pr create --template bug_report     # Use PR template
gh pr create --body-file CHANGES.md    # Body from file
gh pr create --web                     # Open creation form in browser
gh pr create --dry-run                 # Preview without creating
```

### Listing and viewing

```bash
gh pr list                             # Open PRs in current repo
gh pr list --state all --limit 50      # All states
gh pr list --author @me                # Your PRs
gh pr list --reviewer @me              # PRs you need to review
gh pr list --assignee user1            # Assigned PRs
gh pr list --label "needs review"      # Filter by label
gh pr list --base main                 # PRs targeting main
gh pr list --draft                     # Draft PRs only
gh pr list --search "is:open review:required"  # GitHub search syntax
gh pr list --json number,title,author,reviewDecision  # JSON output

gh pr view 123                         # View PR details
gh pr view --web                       # Open in browser
gh pr view --json additions,deletions,files  # Specific fields
gh pr view --comments                  # Include comments
```

### Reviewing

```bash
gh pr review --approve                 # Approve
gh pr review --approve --body "LGTM!"  # Approve with comment
gh pr review --comment --body "Needs work on error handling"
gh pr review --request-changes --body "Please fix X"

gh pr diff 123                         # View diff
gh pr diff --patch                     # Patch format
gh pr diff --name-only                 # File names only

gh pr checks 123                       # Show CI status
gh pr checks --watch                   # Watch CI in real time
gh pr checks --required                # Only required checks
gh pr checks --watch --fail-fast       # Stop watching on first failure
```

### Merging and state management

```bash
gh pr merge 123                        # Interactive merge
gh pr merge --squash                   # Squash merge
gh pr merge --rebase                   # Rebase merge
gh pr merge --merge                    # Standard merge commit
gh pr merge --auto                     # Auto-merge when requirements met
gh pr merge --delete-branch            # Delete branch after merge
gh pr merge --admin                    # Override branch protection
gh pr merge --match-head-commit abc123 # Safety check on HEAD

gh pr ready                            # Mark draft as ready
gh pr ready --undo                     # Convert back to draft
gh pr close 123                        # Close without merging
gh pr reopen 123                       # Reopen closed PR

gh pr checkout 123                     # Check out PR branch locally
gh pr checkout 123 --detach            # Detached HEAD
gh pr checkout 123 --force             # Overwrite local branch

gh pr update-branch                    # Update PR branch from base
gh pr update-branch --rebase           # Rebase instead of merge

gh pr revert 123                       # Create a revert PR
gh pr lock 123 --reason resolved       # Lock conversation
gh pr unlock 123                       # Unlock conversation
```

---

## Issues — full lifecycle

```bash
# Creating
gh issue create                        # Interactive
gh issue create --title "Bug" --body "Steps to reproduce..."
gh issue create --label bug,urgent --assignee @me
gh issue create --milestone v2.0 --project "Backlog"
gh issue create --template bug_report  # Use issue template
gh issue create --body-file report.md  # Body from file
gh issue create --editor               # Open editor for body

# Listing and viewing
gh issue list                          # Open issues
gh issue list --state all --limit 100
gh issue list --assignee @me
gh issue list --author @me
gh issue list --label "help wanted"
gh issue list --milestone "v3.0"
gh issue list --search "memory leak in:title"
gh issue list --json number,title,labels  # JSON output

gh issue view 42                       # View issue
gh issue view 42 --web                 # Open in browser
gh issue view 42 --json body,comments  # JSON output with comments

# Managing
gh issue close 42                      # Close
gh issue close 42 --reason "not planned"  # Close with reason
gh issue reopen 42                     # Reopen
gh issue edit 42 --title "New title"   # Edit
gh issue edit 42 --add-label critical  # Add label
gh issue edit 42 --remove-assignee user1

gh issue comment 42 --body "Investigating"
gh issue comment 42 --body-file notes.md
gh issue comment 42 --edit-last        # Edit your last comment

gh issue pin 42                        # Pin to repo
gh issue unpin 42
gh issue transfer 42 owner/other-repo  # Move to another repo
gh issue develop 42 --checkout         # Create linked branch and check out
gh issue lock 42 --reason spam
gh issue unlock 42
```

---

## Exploring repos and code — browsing and search

### gh browse — open anything in the browser

```bash
gh browse                              # Repo homepage
gh browse --settings                   # Repo settings
gh browse --wiki                       # Wiki
gh browse --projects                   # Projects
gh browse --releases                   # Releases page
gh browse --actions                    # Actions tab
gh browse src/main.go                  # Specific file
gh browse src/main.go:42               # File at line number
gh browse --blame src/main.go          # Blame view
gh browse 77507cd                      # Specific commit
gh browse --no-browser                 # Print URL instead of opening
gh browse --repo owner/repo            # Different repo
```

### gh search — cross-GitHub search from the terminal

```bash
# Search repos
gh search repos "machine learning" --language python --stars ">1000"
gh search repos --owner google --visibility public --topic kubernetes
gh search repos --sort stars --order desc --limit 20

# Search code
gh search code "func main" --language go --repo owner/repo
gh search code "TODO" --filename "*.py" --match file
gh search code "import torch" --extension py --repo pytorch/pytorch

# Search issues and PRs
gh search issues "memory leak" --state open --language rust
gh search issues --assignee @me --repo owner/repo
gh search prs "breaking change" --review approved --merged-at ">2024-01-01"
gh search prs --author @me --state merged --sort created

# Search commits
gh search commits "fix crash" --author user --repo owner/repo
gh search commits --committer-date ">2024-06-01"

# All search commands support --json, --jq, --template, --limit, --sort, --order, --web
```

### Viewing repo contents without cloning

Use `gh api` to browse files, trees, and content remotely:

```bash
# List directory contents
gh api repos/owner/repo/contents/src

# Read a file (base64 decode)
gh api repos/owner/repo/contents/README.md --jq '.content' | base64 -d

# Full repo tree
gh api repos/owner/repo/git/trees/main?recursive=1 --jq '.tree[].path'

# Recent commits
gh api repos/owner/repo/commits --jq '.[].commit.message' -L 10

# Contributors
gh api repos/owner/repo/contributors --jq '.[] | "\(.login): \(.contributions)"'

# Languages breakdown
gh api repos/owner/repo/languages
```

---

## CI/CD — GitHub Actions management

### Workflow runs

```bash
gh run list                            # Recent runs
gh run list --workflow build.yml       # Filter by workflow
gh run list --branch main --status failure  # Filter by branch/status
gh run list --user @me --limit 20
gh run list --json conclusion,name,databaseId  # JSON output

gh run view 12345                      # View run details
gh run view 12345 --log                # Full logs
gh run view 12345 --log-failed         # Only failed step logs
gh run view 12345 --verbose            # Verbose step details
gh run view --exit-status              # Exit 1 if run failed
gh run view --web                      # Open in browser

gh run watch 12345                     # Watch run in real time
gh run watch --exit-status             # Exit with run's exit code (CI gating)

gh run rerun 12345                     # Rerun entire run
gh run rerun 12345 --failed            # Rerun only failed jobs
gh run rerun 12345 --debug             # Rerun with debug logging

gh run cancel 12345                    # Cancel a run
gh run delete 12345                    # Delete a run

gh run download 12345                  # Download all artifacts
gh run download 12345 --name "binaries"  # Specific artifact
gh run download --pattern "coverage-*"   # Glob pattern
```

### Workflows

```bash
gh workflow list                       # List workflows
gh workflow view build.yml             # View workflow details
gh workflow run build.yml              # Trigger workflow
gh workflow run deploy.yml -f env=prod -f version=1.2  # With inputs
gh workflow run build.yml --json       # Inputs from stdin
gh workflow enable build.yml           # Enable disabled workflow
gh workflow disable build.yml          # Disable workflow
```

### Caches

```bash
gh cache list                          # List Actions caches
gh cache list --sort last_accessed     # Sort by access time
gh cache list --key "npm-"             # Filter by key prefix
gh cache delete 12345                  # Delete by ID
gh cache delete --all                  # Delete all caches
```

---

## Releases

```bash
gh release create v1.0.0               # Create release from tag
gh release create v1.0.0 --generate-notes  # Auto-generate notes
gh release create v1.0.0 --notes "Changelog here"
gh release create v1.0.0 --notes-file CHANGELOG.md
gh release create v1.0.0 --draft       # Draft release
gh release create v1.0.0 --prerelease  # Pre-release
gh release create v1.0.0 --latest=false  # Don't mark as latest
gh release create v1.0.0 --target main  # Specific branch
gh release create v1.0.0 ./dist/*.tar.gz  # Upload assets
gh release create v1.0.0 --discussion-category "Releases"

gh release list                        # List releases
gh release view v1.0.0                 # View release
gh release edit v1.0.0 --draft=false   # Publish draft
gh release delete v1.0.0 --yes         # Delete release
gh release download v1.0.0             # Download assets
gh release download v1.0.0 --pattern "*.deb"  # Specific pattern
gh release upload v1.0.0 ./new-file.zip  # Upload additional assets
```

---

## Secrets and variables

```bash
# Secrets (write-only — can set but never read values)
gh secret set API_KEY                  # Interactive (prompted for value)
gh secret set API_KEY --body "value"   # Inline value
gh secret set API_KEY < secret.txt     # From stdin
gh secret set API_KEY --env production # Environment-scoped
gh secret set API_KEY --org myorg --visibility all  # Org-level
gh secret set API_KEY --app dependabot # Dependabot secret
gh secret list                         # List secrets (names only)
gh secret delete API_KEY               # Delete

# Variables (readable)
gh variable set NODE_VERSION --body "20"
gh variable set DEPLOY_ENV --env staging
gh variable get NODE_VERSION           # Read value
gh variable list                       # List all
gh variable delete NODE_VERSION        # Delete

# Bulk import from .env file
gh secret set -f .env                  # Set all secrets from file
gh variable set -f .env               # Set all variables from file
```

---

## Extensions — the plugin ecosystem

```bash
gh extension install owner/gh-extension  # Install extension
gh extension install owner/gh-dash       # Popular: terminal dashboard
gh extension install github/gh-copilot   # GitHub Copilot in terminal

gh extension list                      # List installed
gh extension upgrade gh-dash           # Upgrade specific
gh extension upgrade --all             # Upgrade all
gh extension remove gh-dash            # Uninstall

gh extension search "dashboard"        # Search for extensions
gh extension browse                    # Interactive TUI browser

gh extension create my-ext             # Scaffold new extension
gh extension create my-ext --precompiled=go  # Go-based compiled extension
```

**Popular extensions worth knowing:**
- `gh-dash` — Rich terminal dashboard for PRs, issues across repos
- `gh-copilot` — AI assistance in terminal (deprecated Oct 2025)
- `gh-poi` — Clean up local branches safely
- `gh-markdown-preview` — Preview markdown locally

---

## Output formatting — the `--json` / `--jq` / `--template` trio

Most list and view commands support a consistent three-mode output system. Full details
in `references/api.md`.

```bash
# JSON output — select specific fields
gh pr list --json number,title,author
gh issue view 42 --json body,comments,labels
gh pr list --json ""                   # List ALL available fields

# JQ filtering — built-in, no external jq needed
gh pr list --json author --jq '.[].author.login'
gh pr list --json title,labels --jq '.[] | select(.labels | length > 0) | .title'
gh issue list --json number,title --jq '.[] | "\(.number)\t\(.title)"'

# Go templates
gh pr list --json number,title --template \
  '{{range .}}{{tablerow .number .title}}{{end}}{{tablerender}}'

# Template helper functions: autocolor, color, join, pluck, tablerow,
# tablerender, timeago, timefmt, truncate, hyperlink
```

**TTY behavior:** When stdout is a terminal, output is colored tables. When piped, output
is tab-separated without headers or color. Use `GH_FORCE_TTY` to force terminal output
in non-TTY contexts.

---

## Aliases — custom commands

```bash
gh alias set pv 'pr view'             # Simple alias
gh alias set bugs 'issue list --label bug'
gh alias set --shell igrep 'gh issue list --label "$1" | grep "$2"'  # Shell alias
gh alias set epicsearch 'issue list --label epic --search "$1"'  # Positional args
gh alias list                          # List aliases
gh alias delete pv                     # Remove alias
gh alias import aliases.yml            # Bulk import
```

---

## Additional features

### Gists

```bash
gh gist create file.py                 # Create public gist
gh gist create --public file.py file2.py  # Multiple files
gh gist create --desc "My snippet" -   # From stdin
gh gist list                           # List your gists
gh gist view <id>                      # View gist
gh gist edit <id>                      # Edit gist
gh gist clone <id>                     # Clone gist locally
gh gist delete <id>                    # Delete gist
gh gist rename <id> old.py new.py      # Rename file in gist
```

### Codespaces

```bash
gh codespace create --repo owner/repo  # Create codespace
gh codespace list                      # List codespaces
gh codespace ssh -c <name>             # SSH into codespace
gh codespace code -c <name>            # Open in VS Code
gh codespace ports -c <name>           # List forwarded ports
gh codespace cp local.txt remote:~/    # Copy files
gh codespace stop -c <name>            # Stop codespace
gh codespace delete -c <name>          # Delete codespace
gh codespace logs -c <name>            # View creation logs
gh codespace rebuild -c <name>         # Rebuild container
```

### Projects v2

```bash
gh project list                        # List projects
gh project view 1                      # View project
gh project create --title "Sprint 5"   # Create project
gh project item-add 1 --url <issue-url>  # Add item
gh project item-list 1                 # List items
gh project field-list 1                # List fields
gh project item-edit --id <id> --field-id <fid> --text "value"
gh project close 1                     # Close project
```

### Status dashboard

```bash
gh status                              # Your GitHub dashboard:
                                       # - Assigned issues
                                       # - Review requests
                                       # - Mentions
                                       # - Repo activity
gh status --org myorg                  # Filter to org
gh status --exclude owner/repo         # Exclude repos
```

### SSH and GPG keys

```bash
gh ssh-key add key.pub --title "laptop"
gh ssh-key add --type signing key.pub  # Signing key
gh ssh-key list
gh ssh-key delete <id>

gh gpg-key add key.asc
gh gpg-key list
gh gpg-key delete <id>
```

### Labels

```bash
gh label create "priority:high" --color FF0000 --description "High priority"
gh label list
gh label edit "bug" --color 00FF00
gh label delete "wontfix" --yes
gh label clone --from owner/template-repo  # Copy labels from another repo
```

---

## Working with multiple accounts and GitHub Enterprise

Host resolution priority:
1. `--repo` / `-R` flag or `--hostname` flag
2. `GH_REPO` environment variable
3. Git remote of current repository
4. `GH_HOST` environment variable
5. Default: `github.com`

```bash
# Add Enterprise Server
gh auth login --hostname ghes.corp.com

# Switch between accounts
gh auth switch                         # Interactive
gh auth switch --hostname ghes.corp.com --user admin

# Per-command override
gh pr list -R ghes.corp.com/org/repo
GH_REPO=ghes.corp.com/org/repo gh issue list

# Token split: GH_TOKEN for github.com, GH_ENTERPRISE_TOKEN for GHES
export GH_TOKEN="ghp_personal"
export GH_ENTERPRISE_TOKEN="ghp_enterprise"
```

---

## Common pitfalls

**"gh says I'm not in a repo"** — Run `gh repo set-default owner/repo` or use `-R owner/repo`.

**"I want to see all JSON fields"** — Run `--json ""` (empty string) to list available fields.

**"Pagination stops at 30 results"** — Use `-L 100` or `--limit 100`. For unlimited, use
`gh api` with `--paginate`.

**"gh api gave me a 404"** — Check that your token has the required scopes.
Use `gh auth refresh --scopes <scope>` to add them.

**"I need to use an API that gh doesn't have a command for"** — Use `gh api`. It handles
auth, pagination, and output formatting. See `references/api.md`.

**"My extension isn't working after upgrade"** — Run `gh extension upgrade <name>` or
reinstall with `gh extension install --force`.

---

## Reference files

For detailed information beyond this overview, read these files in `references/`:

- **`references/api.md`** — Complete `gh api` reference: REST and GraphQL usage, pagination,
  JQ filtering, Go templates, caching, placeholders, scripting patterns, and real-world
  examples. Read when using gh as an API wrapper.
- **`references/commands.md`** — Full command tree with every subcommand and its flags.
  Read when you need exact flag names or encounter an unfamiliar command.
