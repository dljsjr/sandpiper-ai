# glab — Complete Command Tree Reference

Every `glab` top-level command and subcommand with key flags. Commands are grouped by
category. Most list/view commands support `-F json` for JSON output.

---

## Authentication and configuration

### glab auth
```
glab auth login       [--hostname HOST] [--token TOKEN] [--stdin] [--web]
                      [--job-token TOKEN] [--use-keyring] [--api-host HOST]
                      [--git-protocol ssh|https]
glab auth logout      [--hostname HOST]
glab auth status      [--hostname HOST] [--show-token]
glab auth configure-docker  [--hostname HOST]
glab auth docker-helper
```

### glab config
```
glab config set KEY VALUE    [-g] [--host HOST]
glab config get KEY          [-g] [--host HOST]
glab config edit
```

Config keys: `git_protocol` (ssh|https), `editor`, `browser`, `pager`,
`glamour_style` (dark|light|notty), `display_hyperlinks` (true|false),
`skip_tls_verify`, `ca_cert`, `client_cert`, `client_key`, `host`,
`token`, `api_host`, `client_id`, `no_prompt`.

### glab alias
```
glab alias set NAME EXPANSION   [--shell]
glab alias delete NAME
glab alias list
```

---

## Repository management

### glab repo
```
glab repo clone REPO [DIR]   [-g GROUP] [--paginate] [--preserve-namespace]
                             [--archived] [--visibility public|internal|private]
                             [-- GIT_CLONE_FLAGS...]
glab repo create [NAME]      [--public|--private|--internal] [--description TEXT]
                             [--group GROUP] [--name NAME] [--tag TAGS]
                             [--readme] [--default-branch NAME]
glab repo fork [REPO]        [--clone] [--remote] [--name NAME]
glab repo view [REPO]        [--web] [-F text|json] [--branch BRANCH]
glab repo list               [--mine] [--member] [--starred] [--archived]
                             [--visibility public|internal|private]
                             [-o name|path|id] [--per-page N] [--page N]
                             [-g GROUP] [-F text|json]
glab repo search [QUERY]     [--sort stars|updated|forks] [--order asc|desc]
                             [--per-page N] [-F text|json]
glab repo archive [REPO]     [-f tar.gz|tar.bz2|tbz|tbz2|tb2|bz2|tar|zip]
glab repo delete [REPO]      [--yes]
glab repo transfer [REPO]    [--target-namespace NAMESPACE] [--yes]
glab repo contributors       [-o text|json] [--per-page N] [--order-by commits]
glab repo members             [-F text|json]
glab repo mirror [REPO]      [--url URL] [--direction push|pull]
glab repo publish             [--catalog-dir PATH]
```

---

## Merge requests

### glab mr
```
glab mr create            [--title TEXT] [--description TEXT] [--description-file FILE]
                          [--source-branch BRANCH] [--target-branch BRANCH]
                          [--draft|--wip] [--fill] [--fill-commit-body]
                          [--reviewer USERS] [--assignee USERS]
                          [--label LABELS] [--milestone NAME]
                          [--related-issue NUMBER] [--copy-issue-labels]
                          [--squash-before-merge] [--remove-source-branch]
                          [--allow-collaboration] [--auto-merge]
                          [--create-source-branch] [--signoff]
                          [--web] [--yes] [--push] [--recover]
glab mr list              [--state opened|closed|merged|all] [--per-page N]
                          [--author USER] [--assignee USER] [--reviewer USER]
                          [--label LABELS] [--not-label LABELS]
                          [--target-branch BRANCH] [--source-branch BRANCH]
                          [--draft] [--search QUERY] [--group GROUP]
                          [--merged-after DATE] [--merged-before DATE]
                          [-F text|json] [--output-format ids|urls|details]
glab mr view [NUMBER]     [--web] [-F text|json] [--comments] [--system-logs]
glab mr checkout NUMBER   [--branch NAME] [--track]
glab mr diff [NUMBER]     [--color always|never|auto]
glab mr approve [NUMBER]  [--sha SHA]
glab mr revoke [NUMBER]
glab mr approvers [NUMBER]
glab mr merge [NUMBER]    [--squash] [--rebase] [--remove-source-branch]
                          [--auto-merge|--when-pipeline-succeeds]
                          [--sha SHA] [--squash-message TEXT]
                          [--message TEXT] [--yes]
glab mr rebase [NUMBER]   [--skip-ci]
glab mr update [NUMBER]   [--title TEXT] [--description TEXT]
                          [--add-label LABELS] [--remove-label LABELS]
                          [--add-assignee USERS] [--remove-assignee USERS]
                          [--add-reviewer USERS] [--remove-reviewer USERS]
                          [--milestone NAME] [--target-branch BRANCH]
                          [--draft|--ready] [--squash-before-merge BOOL]
                          [--remove-source-branch BOOL]
                          [--lock-discussion] [--unlock-discussion]
glab mr close [NUMBER]
glab mr reopen [NUMBER]
glab mr note [NUMBER]     [--message TEXT] [--resolve ID] [--unresolve ID]
                          [--unique]
glab mr todo [NUMBER]
glab mr subscribe [NUMBER]
glab mr unsubscribe [NUMBER]
glab mr issues [NUMBER]
glab mr delete [NUMBER]
```

---

## Issues

### glab issue
```
glab issue create         [--title TEXT] [--description TEXT] [--description-file FILE]
                          [--label LABELS] [--assignee USERS]
                          [--milestone NAME] [--weight N]
                          [--confidential] [--due-date YYYY-MM-DD]
                          [--epic NUMBER] [--linked-issues IDS]
                          [--linked-mr NUMBER] [--link-type TEXT]
                          [--time-estimate DURATION] [--time-spent DURATION]
                          [--web] [--yes] [--recover]
glab issue list           [--state opened|closed|all] [--per-page N]
                          [--author USER] [--assignee USER] [--not-assignee USER]
                          [--label LABELS] [--not-label LABELS]
                          [--milestone NAME] [--search QUERY]
                          [--confidential] [--epic NUMBER]
                          [--iteration NAME] [--issue-type issue|incident|test_case]
                          [--group GROUP] [--mine]
                          [--created-after DATE] [--created-before DATE]
                          [--updated-after DATE] [--updated-before DATE]
                          [-F text|json] [--output-format ids|urls|details]
glab issue view NUMBER    [--web] [-F text|json] [--comments] [--system-logs]
glab issue close NUMBER   [--comment TEXT]
glab issue reopen NUMBER  [--comment TEXT]
glab issue update NUMBER  [--title TEXT] [--description TEXT]
                          [--add-label LABELS] [--remove-label LABELS]
                          [--add-assignee USERS] [--remove-assignee USERS]
                          [--milestone NAME] [--weight N]
                          [--confidential BOOL] [--due-date DATE]
                          [--lock-discussion] [--unlock-discussion]
                          [--unassign]
glab issue note NUMBER    [--message TEXT]
glab issue subscribe NUMBER
glab issue unsubscribe NUMBER
glab issue delete NUMBER
glab issue board view     [--assignee USER] [-g GROUP]
glab issue board create   [--name NAME]
```

---

## CI/CD — Pipelines and Jobs

### glab ci (aliases: pipe, pipeline)
```
glab ci list              [--status STATUS] [--scope SCOPE]
                          [--source push|trigger|schedule|merge_request_event|...]
                          [--ref BRANCH] [--sha SHA]
                          [--username USER] [--updated-before DATE]
                          [--updated-after DATE] [--yaml-errors]
                          [--per-page N] [-F text|json]
glab ci view [ID]         [--branch BRANCH] [--web]
glab ci status            [--branch BRANCH] [--live] [--compact]
glab ci run               [--branch BRANCH] [--variables KEY:VAL,...]
                          [--variables-env VAR] [--variables-file FILE]
                          [--variables-from JSON_FILE]
                          [--input KEY=VALUE] [--mr NUMBER]
glab ci trace [JOB-ID]    [--branch BRANCH]
glab ci get               [--branch BRANCH] [--with-job-details]
                          [--with-variables] [-F text|json]
glab ci retry [ID]        [--branch BRANCH]
glab ci cancel [ID]       [--dry-run]
  glab ci cancel pipeline [ID]
glab ci delete [ID]       [--status STATUS] [--older-than DURATION]
                          [--source SOURCE] [--before DATE]
                          [--dry-run] [--paginate]
glab ci lint [FILE]       [--dry-run] [--include-jobs] [--ref BRANCH]
glab ci artifact [JOB-ID] [--path DIR]
```

### glab job
```
glab job list             [--pipeline ID] [-F text|json]
glab job artifact JOB-ID  [--path DIR]
glab job play JOB-ID
glab job retry JOB-ID
```

### glab schedule
```
glab schedule create      [--cron EXPRESSION] [--ref BRANCH]
                          [--description TEXT] [--variable KEY=VALUE]
                          [--active BOOL] [--timezone TZ]
glab schedule list        [-F text|json]
glab schedule run ID
glab schedule update ID   [--cron EXPRESSION] [--ref BRANCH]
                          [--description TEXT] [--active BOOL]
glab schedule delete ID
```

---

## Releases

### glab release
```
glab release create TAG [FILES...]  [--name TEXT] [--notes TEXT]
                                    [--notes-file FILE] [--ref BRANCH]
                                    [--milestone MILESTONE]
                                    [--assets-links JSON]
                                    [--use-package-registry]
                                    [--publish-to-catalog]
glab release list       [--per-page N] [-F text|json]
glab release view TAG   [--web] [-F text|json]
glab release download TAG [--asset-name PATTERN] [--dir DIR]
glab release upload TAG FILES...
glab release delete TAG [--yes] [--with-tag]
```

---

## Variables

### glab variable
```
glab variable set NAME [VALUE]   [--scope ENV] [-g GROUP] [--type env_var|file]
                                 [--masked] [--protected] [--raw]
glab variable get NAME           [--scope ENV] [-g GROUP]
glab variable list               [--per-page N] [-g GROUP] [-F text|json]
glab variable delete NAME        [--scope ENV] [-g GROUP]
glab variable update NAME VALUE  [--scope ENV] [-g GROUP] [--type] [--masked] [--protected]
glab variable export             [-F json|env|export] [-g GROUP]
```

---

## Stacked diffs

### glab stack
```
glab stack create [NAME]     [--description TEXT]
glab stack sync              [--rebase]
glab stack list
glab stack next
glab stack prev
glab stack first
glab stack last
glab stack amend
glab stack move              [--position N]
glab stack save              [--description TEXT]
```

---

## Additional commands

### glab snippet
```
glab snippet create [FILES...]  [--title TEXT] [--description TEXT]
                                [--visibility public|internal|private]
                                [--filename NAME]
glab snippet list               [--per-page N] [-F text|json]
glab snippet view ID            [--raw] [--web]
glab snippet delete ID
```

### glab incident
```
glab incident create      [--title TEXT] [--description TEXT] [--severity critical|high|medium|low|unknown]
                          [--label LABELS] [--confidential]
glab incident list        [--state opened|closed|all] [--label LABELS]
                          [--per-page N] [-F text|json]
glab incident view NUMBER [--web] [--comments]
glab incident close NUMBER
glab incident reopen NUMBER
glab incident update NUMBER [--title] [--severity] [--add-label] [--remove-label]
glab incident note NUMBER [--message TEXT]
glab incident subscribe NUMBER
glab incident unsubscribe NUMBER
```

### glab token
```
glab token create     [--name NAME] [--scopes SCOPES] [--access-level LEVEL]
                      [--expires-at DATE] [-g GROUP]
glab token list       [-g GROUP] [-F text|json]
glab token revoke ID  [-g GROUP]
```

### glab runner
```
glab runner list      [--per-page N] [-F text|json]
glab runner delete ID
glab runner status
```

### glab ssh-key
```
glab ssh-key add [FILE]    [--title TEXT] [--usage-type auth|signing]
                           [--expires-at DATE]
glab ssh-key list          [-F text|json]
glab ssh-key get ID
glab ssh-key delete ID
```

### glab label
```
glab label create NAME     [--color HEX] [--description TEXT]
glab label list            [--per-page N] [-F text|json]
```

### glab milestone
```
glab milestone create      [--title TEXT] [--description TEXT]
                           [--start-date DATE] [--due-date DATE]
glab milestone list        [--state active|closed] [--per-page N]
glab milestone delete ID
```

### glab cluster agent
```
glab cluster agent bootstrap
glab cluster agent create  [--name NAME]
glab cluster agent list    [-F text|json]
```

### glab deploy-key
```
glab deploy-key add FILE   [--title TEXT] [--can-push]
glab deploy-key list       [-F text|json]
glab deploy-key delete ID
glab deploy-key enable ID
```

### glab securefile
```
glab securefile list       [-F text|json]
```

### glab opentofu
```
glab opentofu list
glab opentofu lock ID
glab opentofu unlock ID
```

### glab work-items (experimental)
```
glab work-items create     [--title TEXT] [--type TEXT]
glab work-items list       [--type TEXT] [-F text|json]
glab work-items view ID
```

### Other top-level commands
```
glab api ENDPOINT          [see references/api.md for full details]
glab duo ask [QUERY]
glab mcp start
glab changelog generate    [--version TAG] [--from TAG] [--to TAG]
                           [--config-file FILE] [--date DATE]
glab check-update
glab completion -s bash|zsh|fish|powershell
glab version
glab help [COMMAND]
```
