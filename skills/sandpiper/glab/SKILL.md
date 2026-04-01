---
name: glab
description: >
  Use this skill whenever the user wants to use the GitLab CLI (`glab`) or interact with
  GitLab from the command line. Triggers include: any mention of "glab", "gitlab cli",
  glab commands (glab mr, glab issue, glab repo, glab ci, glab api, glab release,
  glab pipeline, glab job, glab schedule, glab variable, glab snippet, glab incident,
  glab stack, glab runner, glab auth, glab config, glab token, glab cluster, glab duo),
  GitLab API scripting, creating/managing merge requests or issues via CLI, pipeline
  management, schedules, runners, stacked diffs, or GitLab automation. Also trigger for
  glab api as a REST/GraphQL wrapper, CI/CD variables, pipeline TUI, lint, or self-hosted
  GitLab instances. Always consult before running glab commands — covers auth, repos,
  MRs, issues, CI/CD, API wrapper, variables, stacked diffs, and multi-instance setup.
  Do NOT confuse with `gh` (GitHub CLI) or generic git commands.
---

# GitLab CLI (`glab`) — Complete Reference Skill

`glab` is GitLab's official CLI. It brings merge requests, issues, CI/CD pipelines, the
full REST/GraphQL API, stacked diffs, and more into your terminal. It works with
gitlab.com and self-hosted GitLab instances.

**Before running commands, read this file fully.** For the complete API wrapper reference
(REST, GraphQL, pagination, placeholders), read `references/api.md`. For the full
command reference with all subcommands and flags, read `references/commands.md`.

---

## Authentication and setup

### Installing glab

```bash
# macOS
brew install glab

# Debian/Ubuntu (via Homebrew — officially recommended)
brew install glab

# Snap
sudo snap install glab

# Arch
sudo pacman -S glab

# Alpine
apk add glab

# Windows
winget install glab.glab
# or: scoop install glab / choco install glab

# Docker
docker run -it gitlab/glab <command>

# From source
git clone https://gitlab.com/gitlab-org/cli.git && cd cli
make build && make install
```

### Authentication

```bash
glab auth login                        # Interactive: choose host, auth method
glab auth login --token glpat-xxxxx    # Direct token
glab auth login --stdin < token.txt    # Token from stdin (CI/scripts)
glab auth login --hostname gitlab.corp.com  # Self-hosted instance
glab auth login --web                  # Browser OAuth flow
glab auth login --job-token $CI_JOB_TOKEN   # CI pipeline auth
glab auth login --use-keyring          # Store in OS keyring
glab auth login --api-host api.gitlab.corp.com  # Separate API endpoint

glab auth status                       # Check auth status
glab auth logout                       # Log out

# Docker registry auth
glab auth configure-docker             # Configure Docker for GitLab Container Registry
```

### Environment variables

```bash
GITLAB_TOKEN / GLAB_TOKEN              # Auth token (highest precedence)
GITLAB_HOST / GL_HOST                  # Default hostname
GITLAB_REPO                            # Override repo in OWNER/REPO format
GLAB_CONFIG_DIR                        # Config directory
GITLAB_API_HOST                        # Separate API endpoint (rare)
GITLAB_CLIENT_ID                       # Custom OAuth client ID
DEBUG=1                                # Debug output
GLAB_DEBUG_HTTP=1                      # HTTP transport debugging
NO_COLOR=1                             # Disable color output
NO_PROMPT / GLAB_NO_PROMPT=1           # Disable interactive prompts
GLAMOUR_STYLE=dark|light|notty         # Markdown rendering style
FORCE_HYPERLINKS=1                     # Enable hyperlinks in non-TTY
```

### Configuration

```bash
glab config set editor vim             # Set global config
glab config set token xxx --host gitlab.corp.com  # Per-host config
glab config get editor                 # Read config value
glab config edit                       # Open config in editor

# Config file locations (in priority order):
# 1. $GLAB_CONFIG_DIR/config.yml
# 2. ~/.config/glab-cli/config.yml (legacy)
# 3. XDG platform-specific paths

# Local per-repo config: .git/glab-cli/config.yml

# Special config keys for self-hosted instances:
glab config set skip_tls_verify true --host gitlab.corp.com   # Self-signed certs
glab config set ca_cert /path/to/ca.pem --host gitlab.corp.com
glab config set client_cert /path/to/cert.pem --host gitlab.corp.com
glab config set client_key /path/to/key.pem --host gitlab.corp.com
```

---

## Repository operations

```bash
# Cloning
glab repo clone owner/repo             # Clone a repo
glab repo clone owner/repo mydir       # Clone into specific directory
glab repo clone -g mygroup --paginate  # Clone ALL repos in a group (!)

# Creating
glab repo create myrepo                # Interactive creation
glab repo create myrepo --public       # Public repo
glab repo create myrepo --private --description "My project"
glab repo create myrepo --group mygroup  # Create in a group/namespace

# Forking
glab repo fork owner/repo              # Fork to your namespace
glab repo fork owner/repo --clone      # Fork and clone
glab repo fork --name my-fork          # Custom fork name

# Viewing
glab repo view                         # View current repo info + README
glab repo view owner/repo              # View any repo
glab repo view --web                   # Open in browser
glab repo view -F json                 # JSON output

# Listing
glab repo list                         # Your repos
glab repo list --mine                  # Only your own repos
glab repo list --member                # Repos you're a member of
glab repo list --starred               # Starred repos
glab repo list -o name                 # Output names only
glab repo list --per-page 100          # Control page size

# Managing
glab repo archive owner/repo           # Archive
glab repo archive -f tar.gz            # Archive with format
glab repo delete owner/repo            # Delete repo
glab repo transfer                     # Transfer ownership

# Exploring
glab repo search "query"               # Search for repos
glab repo search --sort stars          # Sort by stars
glab repo contributors                 # List contributors
glab repo members                      # List project members
glab repo mirror                       # Mirror a repo
```

---

## Merge requests — full lifecycle

### Creating MRs

```bash
glab mr create                         # Interactive creation
glab mr create --title "Fix bug" --description "Details"
glab mr create --fill                  # Auto-fill from commits
glab mr create --fill-commit-body      # Include commit bodies
glab mr create --draft                 # Create as draft (or --wip)
glab mr create --source-branch feat --target-branch main
glab mr create --reviewer user1,user2  # Assign reviewers
glab mr create --assignee user1        # Assign
glab mr create --label bug,urgent      # Add labels
glab mr create --milestone "v2.0"      # Set milestone
glab mr create --related-issue 42      # Link to issue
glab mr create --squash-before-merge   # Squash on merge
glab mr create --remove-source-branch  # Delete branch on merge
glab mr create --allow-collaboration   # Allow upstream edits
glab mr create --auto-merge            # Auto-merge when pipeline passes
glab mr create --copy-issue-labels     # Copy labels from linked issue
glab mr create --create-source-branch  # Create source branch if missing
glab mr create --signoff               # Add Signed-off-by
glab mr create --web                   # Open in browser
```

### Listing and viewing

```bash
glab mr list                           # Open MRs
glab mr list --state all               # All states
glab mr list --author @me              # Your MRs
glab mr list --reviewer @me            # MRs you need to review
glab mr list --assignee user1          # Assigned MRs
glab mr list --label "needs review"    # Filter by label
glab mr list --target-branch main      # Filter by target
glab mr list --draft                   # Draft MRs only
glab mr list --group mygroup           # Cross-project in group
glab mr list --per-page 50             # Page size
glab mr list -F json                   # JSON output
glab mr list --output-format ids       # IDs only

glab mr view 55                        # View MR details
glab mr view --web                     # Open in browser
glab mr view -F json                   # JSON output
glab mr view --comments                # Include comments
```

### Reviewing — GitLab's approval model

```bash
# Approve/revoke (GitLab's approval system)
glab mr approve 55                     # Approve MR
glab mr approve --sha abc123           # Approve with HEAD verification
glab mr revoke 55                      # Revoke approval
glab mr approvers 55                   # List approval chain

# Comments
glab mr note 55 --message "Looks good"   # Add comment
glab mr note 55 --message "Fixed" --resolve 12345  # Resolve discussion thread
glab mr note 55 --unresolve 12345      # Unresolve discussion thread

# Diff
glab mr diff 55                        # View diff
glab mr diff --color always            # Force color
```

### Merging and state management

```bash
glab mr merge 55                       # Merge MR
glab mr merge --squash                 # Squash merge
glab mr merge --rebase                 # Rebase merge
glab mr merge --remove-source-branch   # Delete source branch
glab mr merge --auto-merge             # Auto-merge when pipeline passes
glab mr merge --sha abc123             # Verify HEAD before merging
glab mr merge --when-pipeline-succeeds # Alias for --auto-merge
glab mr merge --squash-message "msg"   # Custom squash commit message

glab mr rebase 55                      # Rebase MR branch (server-side)

glab mr update 55 --ready              # Mark draft as ready
glab mr update 55 --draft              # Convert back to draft
glab mr update 55 --title "New title"  # Update title
glab mr update 55 --add-label urgent   # Add labels
glab mr update 55 --remove-reviewer u1 # Remove reviewer
glab mr update 55 --lock-discussion    # Lock discussion
glab mr update 55 --unlock-discussion  # Unlock discussion

glab mr close 55                       # Close without merging
glab mr reopen 55                      # Reopen closed MR

glab mr checkout 55                    # Check out MR branch locally

glab mr todo 55                        # Add to your GitLab todo list
glab mr subscribe 55                   # Subscribe to notifications
glab mr unsubscribe 55                 # Unsubscribe
glab mr issues 55                      # List issues this MR will close
```

---

## Issues — full lifecycle

```bash
# Creating
glab issue create                      # Interactive
glab issue create --title "Bug" --description "Details"
glab issue create --label bug --assignee @me
glab issue create --milestone "v2.0"
glab issue create --confidential       # Confidential issue
glab issue create --due-date 2025-03-31  # Due date (YYYY-MM-DD)
glab issue create --epic 5             # Link to epic
glab issue create --weight 3           # Set weight
glab issue create --linked-issues 10,11  # Link related issues
glab issue create --linked-mr 55       # Link related MR
glab issue create --time-estimate 4h   # Time estimate
glab issue create --time-spent 2h      # Log time spent
glab issue create --web                # Open in browser

# Listing
glab issue list                        # Open issues
glab issue list --state all --per-page 100
glab issue list --assignee @me
glab issue list --author @me
glab issue list --label "help wanted"
glab issue list --milestone "v3.0"
glab issue list --confidential         # Confidential only
glab issue list --epic 5               # Issues in epic
glab issue list --iteration "Sprint 1" # Issues in iteration
glab issue list --issue-type incident  # Filter by type (issue/incident/test_case)
glab issue list --group mygroup        # Cross-project in group
glab issue list --not-label wontfix    # Exclude labels
glab issue list --not-assignee user1   # Exclude assignees
glab issue list --output-format details  # Detailed output (or: ids, urls)
glab issue list -F json                # JSON output

# Viewing
glab issue view 42                     # View issue
glab issue view 42 --web               # Open in browser
glab issue view 42 --comments          # Include comments
glab issue view 42 -F json             # JSON output

# Managing
glab issue close 42                    # Close
glab issue reopen 42                   # Reopen
glab issue update 42 --title "New title"
glab issue update 42 --add-label critical
glab issue update 42 --confidential    # Make confidential
glab issue update 42 --due-date 2025-06-01
glab issue update 42 --lock-discussion # Lock discussion

glab issue note 42 --message "Investigating"

glab issue subscribe 42                # Subscribe to notifications
glab issue unsubscribe 42              # Unsubscribe

# Interactive board view
glab issue board view                  # TUI board view
glab issue board view --assignee @me   # Filtered board
```

---

## CI/CD — deep pipeline management

This is where glab significantly outshines gh. GitLab's built-in CI/CD means glab offers
**substantially more CI control** than gh does for GitHub Actions.

### Pipeline management

```bash
# List pipelines
glab ci list                           # Recent pipelines
glab ci list --status failed           # Filter by status
glab ci list --source push             # Filter by source (push/trigger/schedule/merge_request_event)
glab ci list --ref main                # Filter by branch
glab ci list --author user1            # Filter by user
glab ci list --after 2025-01-01        # Date range
glab ci list --yaml-errors             # Only pipelines with YAML errors

# Interactive TUI viewer (!)
glab ci view                           # Launch pipeline TUI
glab ci view 12345                     # View specific pipeline
# TUI keybindings: j/k navigate, Enter view logs, r retry, p play, c cancel, q quit

# Pipeline status
glab ci status                         # Current branch pipeline status
glab ci status --live                  # Real-time updates
glab ci status --compact               # Compact output

# Trigger pipelines
glab ci run                            # Run pipeline on current branch
glab ci run --branch main              # Run on specific branch
glab ci run --variables KEY1:val1,KEY2:val2  # With variables
glab ci run --variables-env MY_VAR     # Variable from environment
glab ci run --variables-file vars.env  # Variables from file
glab ci run --variables-from vars.json # Variables from JSON
glab ci run --input key=value          # Typed pipeline inputs
glab ci run --mr 55                    # Merge request pipeline

# View logs
glab ci trace                          # Tail job logs in real time
glab ci trace 12345                    # Specific job logs (pipeable!)

# Get pipeline details
glab ci get                            # Current pipeline JSON
glab ci get --with-job-details         # Include job details
glab ci get --with-variables           # Include variables

# Retry/cancel/delete
glab ci retry 12345                    # Retry failed pipeline
glab ci cancel 12345                   # Cancel pipeline
glab ci cancel --dry-run               # Preview what would be cancelled
glab ci delete 12345                   # Delete pipeline
glab ci delete --status failed --older-than 24h  # Bulk delete

# Lint CI config
glab ci lint                           # Validate .gitlab-ci.yml
glab ci lint --dry-run                 # Simulate pipeline
glab ci lint --include-jobs            # Show expanded jobs
glab ci lint path/to/.gitlab-ci.yml    # Lint specific file
```

### Job management

```bash
glab job list                          # List jobs in latest pipeline
glab job list --pipeline 12345         # Jobs in specific pipeline
glab job artifact 12345                # Download job artifacts
glab job artifact 12345 --path out/    # Download to specific path
glab job play 12345                    # Trigger manual job
glab job retry 12345                   # Retry specific job
```

### Pipeline schedules

```bash
glab schedule create                   # Interactive schedule creation
glab schedule create --cron "0 * * * *" --ref main --description "Hourly build"
glab schedule create --variable KEY=VALUE  # Schedule with variables
glab schedule list                     # List all schedules
glab schedule run 42                   # Trigger schedule now
glab schedule update 42 --cron "0 0 * * *"  # Update schedule
glab schedule delete 42                # Delete schedule
```

---

## Releases

```bash
glab release create v1.0.0             # Create release
glab release create v1.0.0 --notes "Changelog"
glab release create v1.0.0 --notes-file CHANGELOG.md
glab release create v1.0.0 ./dist/*.tar.gz  # Upload assets
glab release create v1.0.0 --milestone "v1.0"  # Auto-close milestone
glab release create v1.0.0 --assets-links '[{"name":"docs","url":"https://..."}]'
glab release create v1.0.0 --ref main  # Specific ref
glab release create v1.0.0 --use-package-registry  # Package registry

glab release list                      # List releases
glab release view v1.0.0               # View release
glab release download v1.0.0           # Download assets
glab release upload v1.0.0 ./new.zip   # Upload additional assets
glab release delete v1.0.0             # Delete release
```

---

## Variables — CI/CD configuration

```bash
# Set variables
glab variable set API_KEY "value"      # Project variable
glab variable set API_KEY "value" --scope production  # Environment-scoped
glab variable set API_KEY "value" -g mygroup  # Group-level
glab variable set DB_CERT @cert.pem --type file  # File variable
glab variable set SECRET "val" --masked --protected  # Masked & protected

# Read variables
glab variable get API_KEY              # Get value
glab variable list                     # List all variables
glab variable list --per-page 100      # Paginated list

# Export variables (powerful!)
glab variable export                   # Export as env format
glab variable export -F json           # Export as JSON
glab variable export -F export         # Export as shell export statements
# Usage: eval "$(glab variable export -F export)"  — load CI vars locally!

# Delete variables
glab variable delete API_KEY
glab variable delete API_KEY --scope staging
```

---

## Stacked diffs — native stacked MR workflow

```bash
glab stack create "feature-part-1"     # Start a new stack
glab stack sync                        # Sync all MRs in the stack
glab stack next                        # Move to next MR in stack
glab stack prev                        # Move to previous MR in stack
glab stack list                        # List stack MRs
glab stack amend                       # Amend current stack entry
glab stack move                        # Reorder stack entries
glab stack save                        # Save stack state
glab stack first                       # Jump to first in stack
glab stack last                        # Jump to last in stack
```

---

## Exploring repos and content

Unlike gh, glab lacks dedicated `browse` and `search code` commands. Use these approaches:

### Via built-in commands

```bash
glab repo view                         # View project info + README
glab repo view --web                   # Open in browser
glab repo search "query"               # Search for projects
glab repo search --sort stars          # Sort results
glab repo contributors                 # List contributors
glab repo members                      # List members
```

### Via the API (for file contents, tree, blame, commits)

```bash
# List directory contents
glab api projects/:fullpath/repository/tree

# Read a file
glab api projects/:fullpath/repository/files/README.md/raw

# Full repo tree
glab api projects/:fullpath/repository/tree?recursive=true --paginate \
  | jq '.[].path'

# Recent commits
glab api projects/:fullpath/repository/commits | jq '.[].title'

# Blame
glab api projects/:fullpath/repository/files/main.go/blame?ref=main

# Compare branches
glab api projects/:fullpath/repository/compare?from=main&to=feature

# Search code in project
glab api projects/:fullpath/search?scope=blobs&search=TODO
```

---

## Output formatting

glab uses `-F`/`--output` flags with `text` (default) and `json` values. **glab does not
have built-in JQ filtering** — pipe to external `jq` instead.

```bash
# JSON output
glab mr list -F json
glab issue view 42 -F json

# Specialized output formats (command-specific)
glab issue list --output-format ids     # Issue IDs only
glab issue list --output-format urls    # URLs only
glab issue list --output-format details # Detailed output

# Variable export formats
glab variable export -F json           # JSON
glab variable export -F env            # .env format
glab variable export -F export         # shell export

# API output
glab api projects/:fullpath -F json    # Force JSON
glab api projects/:fullpath --output ndjson  # NDJSON streaming

# Pipe to jq for filtering (required — no built-in JQ)
glab mr list -F json | jq '.[].title'
glab api projects/:fullpath/merge_requests | jq '.[] | {id: .iid, title: .title}'
```

**TTY behavior:** Default output is colored when connected to a terminal. `NO_COLOR=1`
disables color. `GLAMOUR_STYLE=notty` formats markdown for plain text.

---

## Aliases — custom commands

```bash
glab alias set mrs 'mr list --reviewer=@me'  # Simple alias
glab alias set --shell igrep 'glab issue list --label "$1" | grep "$2"'  # Shell alias
glab alias list                        # List all aliases
glab alias delete mrs                  # Remove alias
```

---

## Additional features

### Snippets (GitLab's equivalent of Gists)

```bash
glab snippet create file.py            # Create snippet
glab snippet create --title "Helper" --description "Utility code" file.py
glab snippet create --visibility public
glab snippet list                      # List snippets
glab snippet view 12345                # View snippet
glab snippet delete 12345              # Delete snippet
```

### Incidents

```bash
glab incident create --title "Service down" --severity critical
glab incident list
glab incident list --label "production"
glab incident view 42
glab incident close 42
glab incident reopen 42
glab incident note 42 --message "Investigating root cause"
glab incident subscribe 42
glab incident unsubscribe 42
glab incident update 42 --severity medium
```

### Token management

```bash
glab token create --name "ci-token" --scopes api,read_repository
glab token create --name "deploy" --expires-at 2025-12-31 --access-level developer
glab token list                        # List project/group tokens
glab token revoke 42                   # Revoke token
```

### Runners

```bash
glab runner list                       # List available runners
glab runner delete 42                  # Delete runner
glab runner status                     # Runner status
```

### SSH keys

```bash
glab ssh-key add key.pub --title "laptop"
glab ssh-key add key.pub --usage-type signing  # Signing key
glab ssh-key add key.pub --expires-at 2026-01-01  # Expiring key
glab ssh-key list
glab ssh-key get 42
glab ssh-key delete 42
```

### Kubernetes cluster agents

```bash
glab cluster agent bootstrap           # Bootstrap agent
glab cluster agent create              # Create agent
glab cluster agent list                # List agents
```

### GitLab Duo AI

```bash
glab duo ask "How do I optimize this pipeline?"  # AI assistance
```

### Changelog generation

```bash
glab changelog generate                # Generate changelog from MRs
glab changelog generate --version v1.0.0  # For specific version
```

---

## Working with multiple GitLab instances

Host resolution priority:
1. `--repo` / `-R` flag or `--hostname` flag
2. Current git directory's remotes
3. `GITLAB_HOST` / `GL_HOST` environment variable
4. Default: `gitlab.com`

```bash
# Add self-hosted instance
glab auth login --hostname gitlab.corp.com

# Set default host globally
glab config set -g host gitlab.corp.com

# Per-command override
glab mr list -R gitlab.corp.com/org/repo

# CI pipeline auth
glab auth login --job-token $CI_JOB_TOKEN --hostname $CI_SERVER_HOST

# mTLS for corporate environments
glab config set ca_cert /path/to/ca.pem --host gitlab.corp.com
glab config set client_cert /path/to/cert.pem --host gitlab.corp.com
glab config set client_key /path/to/key.pem --host gitlab.corp.com
glab config set skip_tls_verify true --host gitlab.corp.com
```

---

## Common pitfalls

**"glab says I'm not in a repo"** — Use `glab repo view owner/repo` or `cd` into a
git repo with a GitLab remote. Or set `GITLAB_REPO=owner/repo`.

**"How do I see JSON fields?"** — Use `-F json` output flag, then pipe to `jq`.
There's no built-in `--jq` like gh has.

**"Pipeline isn't triggering"** — Check `glab ci lint` first to validate your YAML.
Use `glab ci run --branch <branch>` explicitly.

**"How do I browse files without cloning?"** — Use `glab api projects/:fullpath/repository/tree`
and `glab api projects/:fullpath/repository/files/<path>/raw`.

**"Self-hosted GitLab with self-signed certs"** — Set `skip_tls_verify` or provide
`ca_cert` via `glab config set` for that host.

**"I need to use an API that glab doesn't have a command for"** — Use `glab api`. It
handles auth and pagination. See `references/api.md`.

**"How do I load CI variables locally?"** — `eval "$(glab variable export -F export)"`.

---

## Reference files

For detailed information beyond this overview, read these files in `references/`:

- **`references/api.md`** — Complete `glab api` reference: REST and GraphQL usage,
  pagination, placeholders, NDJSON output, file uploads, and scripting patterns.
  Read when using glab as an API wrapper.
- **`references/commands.md`** — Full command tree with every subcommand and its flags.
  Read when you need exact flag names or encounter an unfamiliar command.
