# gh — Complete Command Tree Reference

Every `gh` top-level command and subcommand with key flags. Commands are grouped by
category. Most list/view commands support `--json <fields>`, `--jq <expr>`, and
`--template <go-template>` for output formatting.

---

## Authentication and configuration

### gh auth
```
gh auth login       [--hostname HOST] [--web] [--with-token] [--git-protocol ssh|https]
                    [--scopes SCOPES] [--skip-ssh-key] [--clipboard]
gh auth logout      [--hostname HOST] [--user USER]
gh auth status      [--hostname HOST] [--show-token] [--active]
gh auth token       [--hostname HOST] [--user USER]
gh auth refresh     [--hostname HOST] [--scopes SCOPES]
gh auth setup-git   [--hostname HOST] [--force]
gh auth switch      [--hostname HOST] [--user USER]
```

### gh config
```
gh config set KEY VALUE    [-h HOST]
gh config get KEY          [-h HOST]
gh config list             [-h HOST]
gh config clear-cache
```

Config keys: `git_protocol` (ssh|https), `editor`, `prompt` (enabled|disabled),
`pager`, `http_unix_socket`, `browser`, `prefer_editor_prompt` (enabled|disabled).

### gh alias
```
gh alias set NAME EXPANSION   [--shell] [--clobber]
gh alias delete NAME
gh alias list
gh alias import FILE          [--clobber]
```

---

## Repository management

### gh repo
```
gh repo create [NAME]        [--public|--private|--internal] [--clone] [--source DIR]
                             [--push] [--template REPO] [--add-readme] [--description]
                             [--gitignore TEMPLATE] [--license TEMPLATE] [--team TEAM]
                             [--disable-issues] [--disable-wiki] [--homepage URL]
                             [--include-all-branches]
gh repo clone REPO [DIR]     [-- GIT_CLONE_FLAGS...]
gh repo fork [REPO]          [--clone] [--remote] [--remote-name NAME] [--org ORG]
                             [--fork-name NAME] [--default-branch-only]
gh repo view [REPO]          [--web] [--branch BRANCH] [--json FIELDS] [--jq] [--template]
gh repo list [OWNER]         [--limit N] [--json] [--jq] [--language] [--topic]
                             [--visibility public|private|internal] [--fork] [--source]
                             [--archived] [--no-archived] [--sort stars|forks|size|updated]
gh repo edit [REPO]          [--visibility] [--description] [--homepage] [--default-branch]
                             [--enable-*] [--disable-*] [--add-topic] [--remove-topic]
                             [--template] [--allow-forking] [--allow-update-branch]
gh repo rename NEW-NAME
gh repo delete [REPO]        [--yes]
gh repo archive [REPO]       [--yes]
gh repo unarchive [REPO]     [--yes]
gh repo sync [REPO]          [--branch BRANCH] [--source REPO] [--force]
gh repo set-default [REPO]   [--unset] [--view]
gh repo deploy-key add FILE  [--title TITLE] [--allow-write]
gh repo deploy-key delete ID
gh repo deploy-key list
gh repo autolink create      --key-prefix PREFIX --url-template TEMPLATE [--numeric]
gh repo autolink list
gh repo autolink view ID
gh repo autolink delete ID   [--yes]
gh repo gitignore list
gh repo gitignore view NAME
gh repo license list
gh repo license view NAME
```

---

## Pull requests

### gh pr
```
gh pr create          [--title] [--body] [--body-file] [--base] [--head USER:BRANCH]
                      [--draft] [--fill] [--fill-first] [--fill-verbose]
                      [--reviewer USERS] [--assignee USERS|@me|@copilot]
                      [--label LABELS] [--milestone NAME] [--project NAME]
                      [--template NAME] [--web] [--editor] [--dry-run]
                      [--no-maintainer-edit] [--recover]
gh pr list            [--state open|closed|merged|all] [--limit N]
                      [--author] [--assignee] [--reviewer] [--label] [--base]
                      [--head] [--draft] [--search QUERY] [--app]
                      [--json FIELDS] [--jq] [--template] [--web]
gh pr view [NUMBER]   [--web] [--json FIELDS] [--jq] [--template] [--comments]
gh pr checkout NUMBER [--branch NAME] [--detach] [--force] [--recurse-submodules]
gh pr diff [NUMBER]   [--color always|never|auto] [--patch] [--name-only]
gh pr review [NUMBER] [--approve] [--comment] [--request-changes] [--body TEXT]
                      [--body-file FILE]
gh pr checks [NUMBER] [--watch] [--interval SEC] [--required] [--fail-fast]
gh pr merge [NUMBER]  [--merge|--squash|--rebase] [--auto] [--delete-branch]
                      [--admin] [--body TEXT] [--subject TEXT]
                      [--match-head-commit SHA]
gh pr ready [NUMBER]  [--undo]
gh pr close [NUMBER]  [--delete-branch] [--comment TEXT]
gh pr reopen [NUMBER] [--comment TEXT]
gh pr edit [NUMBER]   [--title] [--body] [--body-file] [--base]
                      [--add-label] [--remove-label] [--add-reviewer]
                      [--remove-reviewer] [--add-assignee] [--remove-assignee]
                      [--milestone] [--add-project] [--remove-project]
gh pr comment [NUMBER] [--body TEXT] [--body-file FILE] [--edit-last] [--web]
gh pr update-branch   [--rebase] [--state-id ID]
gh pr revert NUMBER   [--body TEXT] [--title TEXT] [--draft]
gh pr lock NUMBER     [--reason off-topic|resolved|spam|too-heated]
gh pr unlock NUMBER
```

---

## Issues

### gh issue
```
gh issue create       [--title] [--body] [--body-file] [--label LABELS]
                      [--assignee USERS|@me|@copilot] [--milestone] [--project]
                      [--template NAME] [--web] [--editor] [--recover]
gh issue list         [--state open|closed|all] [--limit N]
                      [--author] [--assignee] [--label] [--milestone]
                      [--mention USER] [--search QUERY] [--app]
                      [--json FIELDS] [--jq] [--template] [--web]
gh issue view NUMBER  [--web] [--json FIELDS] [--jq] [--template] [--comments]
gh issue edit NUMBER  [--title] [--body] [--body-file]
                      [--add-label] [--remove-label]
                      [--add-assignee] [--remove-assignee]
                      [--milestone] [--add-project] [--remove-project]
gh issue close NUMBER [--reason completed|"not planned"|duplicate]
                      [--comment TEXT]
gh issue reopen NUMBER [--comment TEXT]
gh issue comment NUMBER [--body TEXT] [--body-file FILE] [--edit-last] [--web]
gh issue delete NUMBER [--yes]
gh issue pin NUMBER
gh issue unpin NUMBER
gh issue transfer NUMBER DEST-REPO
gh issue develop NUMBER [--checkout] [--branch NAME] [--base BRANCH]
                        [--issue-repo REPO]
gh issue lock NUMBER  [--reason off-topic|resolved|spam|too-heated]
gh issue unlock NUMBER
```

---

## Search

### gh search
```
gh search repos QUERY     [--owner] [--visibility] [--topic] [--language]
                          [--stars RANGE] [--forks RANGE] [--size RANGE]
                          [--followers RANGE] [--created RANGE] [--pushed RANGE]
                          [--license] [--archived] [--match name|description|readme]
                          [--sort stars|forks|help-wanted-issues|updated]
                          [--order asc|desc] [--limit N] [--json] [--jq] [--web]
gh search code QUERY      [--language] [--filename] [--extension] [--repo]
                          [--match file|path] [--size RANGE] [--sort indexed]
                          [--order asc|desc] [--limit N] [--json] [--jq] [--web]
gh search issues QUERY    [--state open|closed] [--assignee] [--author] [--label]
                          [--milestone] [--repo] [--language] [--visibility]
                          [--comments RANGE] [--reactions RANGE] [--created RANGE]
                          [--updated RANGE] [--closed RANGE]
                          [--sort comments|reactions|created|updated]
                          [--order] [--limit] [--json] [--jq] [--web]
gh search prs QUERY       [--state open|closed|merged] [--author] [--assignee]
                          [--label] [--repo] [--review none|required|approved|changes_requested]
                          [--merged-at RANGE] [--draft] [--sort] [--limit] [--json] [--web]
gh search commits QUERY   [--author] [--committer] [--repo] [--hash]
                          [--author-date RANGE] [--committer-date RANGE]
                          [--merge] [--sort author-date|committer-date]
                          [--order] [--limit] [--json] [--jq] [--web]
```

---

## GitHub Actions (CI/CD)

### gh run
```
gh run list           [--workflow NAME] [--branch] [--actor] [--event]
                      [--status queued|in_progress|completed|failure|success|...]
                      [--created RANGE] [--commit SHA] [--limit N]
                      [--json FIELDS] [--jq] [--template]
gh run view [ID]      [--log] [--log-failed] [--verbose] [--exit-status]
                      [--attempt N] [--job JOB-ID] [--json] [--web]
gh run watch [ID]     [--interval SEC] [--exit-status]
gh run rerun [ID]     [--failed] [--debug] [--job JOB-ID]
gh run cancel [ID]
gh run delete [ID]    [--last N]
gh run download [ID]  [--name PATTERN] [--pattern GLOB] [--dir DIR]
```

### gh workflow
```
gh workflow list      [--all] [--limit N] [--json FIELDS] [--jq]
gh workflow view [ID|NAME|FILE]   [--web] [--yaml] [--ref BRANCH] [--json]
gh workflow run ID|NAME|FILE      [-f KEY=VALUE...] [--json] [--ref BRANCH]
gh workflow enable ID|NAME|FILE
gh workflow disable ID|NAME|FILE
```

### gh cache
```
gh cache list         [--sort created_at|last_accessed_at|size]
                      [--order asc|desc] [--key PREFIX] [--limit N] [--json]
gh cache delete ID|--all [--key KEY]
```

---

## Releases

### gh release
```
gh release create TAG [FILES...]  [--title] [--notes TEXT] [--notes-file FILE]
                                  [--generate-notes] [--notes-from-tag]
                                  [--notes-start-tag TAG] [--latest=bool]
                                  [--draft] [--prerelease] [--target BRANCH]
                                  [--discussion-category NAME] [--verify-tag]
gh release list       [--limit N] [--exclude-drafts] [--exclude-pre-releases]
                      [--order asc|desc] [--json FIELDS] [--jq]
gh release view [TAG] [--web] [--json FIELDS] [--jq]
gh release edit TAG   [--title] [--notes] [--notes-file] [--draft=bool]
                      [--prerelease=bool] [--latest=bool] [--tag NEWTAG]
                      [--target BRANCH] [--discussion-category]
gh release delete TAG [--yes] [--cleanup-tag]
gh release download [TAG]  [--pattern GLOB] [--dir DIR] [--output FILE]
                           [--skip-existing] [--clobber]
gh release upload TAG FILES...  [--clobber]
gh release verify TAG [--signer-workflow URL] [--signer-repo REPO]
gh release verify-asset FILE --tag TAG
```

---

## Additional commands

### gh gist
```
gh gist create [FILES...|-]  [--public] [--desc TEXT] [--filename NAME] [--web]
gh gist list                 [--limit N] [--public|--secret] [--json] [--jq]
gh gist view ID              [--raw] [--filename NAME] [--files] [--web]
gh gist edit ID              [--add FILE] [--remove NAME] [--filename NAME] [--desc]
gh gist clone ID [DIR]
gh gist delete ID
gh gist rename ID OLD NEW
```

### gh codespace
```
gh codespace create   [--repo] [--branch] [--machine TYPE] [--retention-period]
                      [--idle-timeout] [--location REGION] [--devcontainer-path]
                      [--display-name] [--status] [--default-permissions]
gh codespace list     [--limit N] [--repo REPO] [--org ORG] [--json]
gh codespace view     [-c NAME] [--json]
gh codespace ssh      [-c NAME] [--profile NAME] [--server-port PORT] [--debug]
                      [--config] [-- SSH_ARGS...]
gh codespace code     [-c NAME] [--insiders] [--web]
gh codespace ports    [-c NAME] [--json]
gh codespace ports forward    PORT:PORT [-c NAME]
gh codespace ports visibility PORT:VISIBILITY [-c NAME]
gh codespace cp       SRC... DEST [-c NAME] [-e] [-r]
gh codespace stop     [-c NAME] [--org ORG] [--user USER]
gh codespace delete   [-c NAME] [--all] [--days N] [--org ORG] [--user USER] [--force]
gh codespace logs     [-c NAME] [--follow] [--json]
gh codespace rebuild  [-c NAME] [--full]
gh codespace jupyter  [-c NAME]
gh codespace edit     [-c NAME] [--display-name NAME] [--machine TYPE]
```

### gh project
```
gh project create         [--owner OWNER] [--title TITLE] [--format]
gh project list           [--owner OWNER] [--limit N] [--closed] [--web] [--json]
gh project view NUMBER    [--owner OWNER] [--web] [--json]
gh project edit NUMBER    [--owner OWNER] [--title] [--description] [--visibility]
                          [--readme FILE]
gh project close NUMBER   [--owner OWNER] [--undo]
gh project copy NUMBER    [--drafts] [--source-owner] [--target-owner] [--title]
gh project delete NUMBER  [--owner OWNER] [--yes]
gh project link NUMBER    [--owner OWNER] [--repo REPO] [--team TEAM]
gh project unlink NUMBER  [--owner OWNER] [--repo REPO] [--team TEAM]
gh project field-create   [--owner OWNER] [--project-number N] [--name] [--data-type]
                          [--single-select-options]
gh project field-list NUMBER  [--owner OWNER] [--limit N] [--json]
gh project field-delete   [--id ID]
gh project item-add NUMBER    [--owner OWNER] [--url URL] [--format]
gh project item-create NUMBER [--owner OWNER] [--title TITLE] [--body TEXT] [--format]
gh project item-delete NUMBER [--owner OWNER] [--id ID] [--format]
gh project item-edit          [--id ID] [--field-id FID] [--text|--number|--date|--iteration-id|--single-select-option-id VALUE]
                              [--project-id PID] [--clear]
gh project item-list NUMBER   [--owner OWNER] [--limit N] [--json] [--jq]
gh project item-archive NUMBER    [--owner OWNER] [--id ID] [--undo] [--format]
gh project mark-template NUMBER   [--owner OWNER] [--undo]
```

### gh extension
```
gh extension install REPO   [--pin VERSION] [--force]
gh extension list
gh extension upgrade NAME   [--all] [--force] [--dry-run]
gh extension remove NAME
gh extension search [QUERY] [--limit N] [--sort] [--order] [--license] [--web] [--json]
gh extension browse         # Interactive TUI
gh extension create [NAME]  [--precompiled=go|other]
gh extension exec NAME [ARGS...]
```

### gh secret / gh variable
```
gh secret set NAME     [--body VALUE] [--env ENV] [--org ORG]
                       [--visibility all|private|selected] [--repos REPOS]
                       [-f FILE] [-a actions|codespaces|dependabot]
gh secret list         [--env ENV] [--org ORG] [-a APP] [--json]
gh secret delete NAME  [--env ENV] [--org ORG] [-a APP]

gh variable set NAME   [--body VALUE] [--env ENV] [--org ORG]
                       [--visibility all|private|selected] [--repos REPOS] [-f FILE]
gh variable get NAME   [--env ENV] [--org ORG] [--json]
gh variable list       [--env ENV] [--org ORG] [--json]
gh variable delete NAME [--env ENV] [--org ORG]
```

### gh label
```
gh label create NAME   [--color HEX] [--description TEXT] [--force]
gh label list          [--limit N] [--sort name|created] [--order] [--search QUERY]
                       [--json FIELDS] [--jq]
gh label edit NAME     [--name NEW] [--color HEX] [--description TEXT]
gh label delete NAME   [--yes] [--confirm]
gh label clone         [--from REPO] [--force]
```

### gh ssh-key / gh gpg-key
```
gh ssh-key add FILE    [--title TITLE] [--type authentication|signing]
gh ssh-key list        [--json FIELDS]
gh ssh-key delete ID   [--yes]

gh gpg-key add [FILE]
gh gpg-key list        [--json FIELDS]
gh gpg-key delete ID   [--yes]
```

### Other top-level commands
```
gh api ENDPOINT        [see references/api.md for full details]
gh browse [FILE:LINE|COMMIT]  [--web] [--no-browser] [--settings|--wiki|--projects|
                               --releases|--actions] [--repo REPO] [--branch] [--blame]
gh status              [--org ORG] [--exclude REPOS] [--json]
gh ruleset list        [--limit N] [--org ORG] [--parents] [--web] [--json]
gh ruleset view [ID]   [--org ORG] [--parents] [--web] [--json]
gh ruleset check       [--branch BRANCH] [--default] [--org ORG] [--web] [--json]
gh attestation verify ARTIFACT [--bundle FILE] [--digest-algorithm sha256|sha512]
                                [--owner OWNER] [--repo REPO] [--signer-workflow URL]
gh completion -s bash|zsh|fish|powershell
gh help [COMMAND]
```
