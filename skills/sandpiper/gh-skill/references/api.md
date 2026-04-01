# gh api — REST and GraphQL API Wrapper Reference

`gh api` is the most powerful and underused feature of the GitHub CLI. It transforms `gh`
into an authenticated, pagination-aware, JQ-equipped HTTP client for the entire GitHub
API surface. Any operation possible through the GitHub REST or GraphQL API is available
through this single command.

---

## Table of contents

1. [Basic REST requests](#basic-rest-requests)
2. [Path placeholders](#path-placeholders)
3. [HTTP methods and data](#http-methods-and-data)
4. [GraphQL queries](#graphql-queries)
5. [Pagination](#pagination)
6. [JQ filtering](#jq-filtering)
7. [Go templates](#go-templates)
8. [Caching](#caching)
9. [Headers and debugging](#headers-and-debugging)
10. [Scripting patterns](#scripting-patterns)
11. [Real-world examples](#real-world-examples)

---

## Basic REST requests

The endpoint is the API path after `https://api.github.com/`. GET is the default method.

```bash
gh api repos/owner/repo                 # GET repo info
gh api repos/owner/repo/releases        # GET releases
gh api user                             # GET authenticated user
gh api orgs/myorg/members               # GET org members
gh api rate_limit                       # Check API rate limits
```

## Path placeholders

Inside a git repository, these placeholders auto-resolve:

- `{owner}` — repository owner
- `{repo}` — repository name
- `{branch}` — current branch

```bash
gh api repos/{owner}/{repo}/pulls       # Auto-resolved from git remote
gh api repos/{owner}/{repo}/git/ref/heads/{branch}
```

## HTTP methods and data

Use `-X` for the HTTP method. Use `-f` for string fields and `-F` for typed fields.

```bash
# POST — create a resource
gh api -X POST repos/{owner}/{repo}/issues \
  -f title="Bug report" \
  -f body="Steps to reproduce..."

# PATCH — update a resource
gh api -X PATCH repos/{owner}/{repo}/issues/42 \
  -f state="closed"

# PUT — replace/set a resource
gh api -X PUT repos/{owner}/{repo}/topics \
  -f 'names[]=cli' -f 'names[]=golang'

# DELETE — remove a resource
gh api -X DELETE repos/{owner}/{repo}/issues/42/labels/bug

# -f (raw string) vs -F (typed: numbers, booleans, null, @file)
gh api -X POST graphql -F per_page=100    # 100 as integer
gh api -X POST graphql -F draft=true      # true as boolean
gh api -X POST graphql -F 'body=@body.md' # File contents

# --input for raw request body from file or stdin
echo '{"title":"test"}' | gh api -X POST repos/{owner}/{repo}/issues --input -
gh api -X POST repos/{owner}/{repo}/issues --input payload.json
```

## GraphQL queries

Use the `graphql` endpoint with `-f query=` for queries and `-F` for variables.

```bash
# Simple query
gh api graphql -f query='{ viewer { login name } }'

# Query with variables
gh api graphql \
  -F owner='{owner}' \
  -F name='{repo}' \
  -f query='
    query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        description
        stargazerCount
        releases(last: 5) {
          nodes { tagName publishedAt }
        }
      }
    }'

# Mutations
gh api graphql -f query='
  mutation {
    addStar(input: {starrableId: "MDEwOlJlcG9zaXRvcnkx"}) {
      starrable { ... on Repository { nameWithOwner } }
    }
  }'
```

## Pagination

### REST pagination

`--paginate` automatically follows `Link: rel=next` headers until all pages are fetched.

```bash
# Fetch all issues (all pages)
gh api repos/{owner}/{repo}/issues --paginate

# Combine paginated results into a single JSON array
gh api repos/{owner}/{repo}/issues --paginate --slurp

# Paginate and filter
gh api repos/{owner}/{repo}/issues --paginate --jq '.[].title'
```

**Important:** `--paginate` returns each page as a separate JSON array. Use `--slurp`
to merge them into one array if you need a single valid JSON document.

### GraphQL pagination

For GraphQL, `--paginate` requires `$endCursor: String` variable and `pageInfo { hasNextPage endCursor }`:

```bash
gh api graphql --paginate -f query='
  query($endCursor: String) {
    repository(owner: "cli", name: "cli") {
      issues(first: 100, after: $endCursor) {
        pageInfo { hasNextPage endCursor }
        nodes { title number }
      }
    }
  }'
```

## JQ filtering

Built-in JQ — no external jq installation required. Works with `--jq` on `gh api` and
with `--jq` on most other `gh` commands that support `--json`.

```bash
# Extract fields
gh api repos/{owner}/{repo}/releases --jq '.[0].tag_name'

# Filter and transform
gh api repos/{owner}/{repo}/contributors \
  --jq '.[] | "\(.login): \(.contributions) commits"'

# Select with conditions
gh api repos/{owner}/{repo}/issues \
  --jq '[.[] | select(.labels | length > 0)] | length'

# Tab-separated output for scripting
gh api repos/{owner}/{repo}/pulls \
  --jq '.[] | [.number, .title, .user.login] | @tsv'

# CSV output
gh api repos/{owner}/{repo}/pulls \
  --jq '.[] | [.number, .title] | @csv'

# Complex aggregation
gh api repos/{owner}/{repo}/contributors --paginate \
  --jq '[.[].contributions] | add'

# Unique values
gh api repos/{owner}/{repo}/issues --paginate \
  --jq '[.[].user.login] | unique | .[]'
```

## Go templates

For formatting that JQ can't easily handle (like tables), use `--template`:

```bash
# Table output
gh api repos/{owner}/{repo}/pulls --template \
  '{{range .}}{{tablerow .number .title .user.login}}{{end}}{{tablerender}}'

# Colored output
gh api repos/{owner}/{repo}/releases --template \
  '{{range .}}{{.tag_name}} ({{timeago .published_at}}){{"\n"}}{{end}}'

# Conditional formatting
gh api repos/{owner}/{repo}/pulls --template \
  '{{range .}}{{if eq .draft true}}{{color "yellow"}}DRAFT{{color "reset"}} {{end}}#{{.number}} {{.title}}
{{end}}'
```

**Available template functions:**
- `autocolor` — Auto-color based on value (e.g., "open" → green)
- `color <name>` — Apply ANSI color (red, green, yellow, blue, magenta, cyan, white)
- `join <sep> <list>` — Join list elements
- `pluck <field> <list>` — Extract field from list of objects
- `tablerow <vals...>` — Add table row
- `tablerender` — Render accumulated table
- `timeago <time>` — Relative time ("3 hours ago")
- `timefmt <fmt> <time>` — Format time with Go layout
- `truncate <n> <str>` — Truncate string
- `hyperlink <url> <text>` — Terminal hyperlink

## Caching

Cache API responses to avoid rate limits and speed up repeated queries:

```bash
gh api repos/{owner}/{repo}/releases --cache 1h   # Cache for 1 hour
gh api repos/{owner}/{repo}/languages --cache 24h  # Cache for 24 hours
gh api user/repos --cache 5m                       # Cache for 5 minutes
```

Cache is stored in `~/.config/gh/`. Clear with `gh config clear-cache`.

## Headers and debugging

```bash
# Custom headers (e.g., API previews)
gh api repos/{owner}/{repo} -H "Accept: application/vnd.github.mercy-preview+json"

# Include response headers in output
gh api -i repos/{owner}/{repo}

# Verbose mode — full HTTP request/response
gh api --verbose repos/{owner}/{repo}

# Silent mode — suppress response body (useful for POST/DELETE)
gh api --silent -X DELETE repos/{owner}/{repo}/issues/42/labels/bug

# Target specific hostname
gh api --hostname ghes.corp.com repos/org/repo
```

## Scripting patterns

### Looping over paginated results

```bash
# Process all open PRs
gh api repos/{owner}/{repo}/pulls --paginate --jq '.[].number' | while read -r pr; do
  echo "Processing PR #$pr"
  gh pr view "$pr" --json title,mergeable
done
```

### Conditional API calls

```bash
# Check if a label exists before creating
if ! gh api repos/{owner}/{repo}/labels/bug --silent 2>/dev/null; then
  gh api -X POST repos/{owner}/{repo}/labels \
    -f name="bug" -f color="d73a4a" -f description="Something isn't working"
fi
```

### Combining REST and GraphQL

```bash
# Get repo ID via REST, use in GraphQL mutation
REPO_ID=$(gh api repos/{owner}/{repo} --jq '.node_id')
gh api graphql -f query="
  mutation { addStar(input: {starrableId: \"$REPO_ID\"}) { clientMutationId } }
"
```

### Bulk operations

```bash
# Close all issues with "wontfix" label
gh api repos/{owner}/{repo}/issues --paginate \
  --jq '.[] | select(.labels[].name == "wontfix") | .number' | while read -r num; do
  gh api -X PATCH repos/{owner}/{repo}/issues/$num -f state=closed --silent
done

# Add a label to all open PRs
gh pr list --json number --jq '.[].number' | while read -r pr; do
  gh api -X POST repos/{owner}/{repo}/issues/$pr/labels \
    -f 'labels[]=needs-review' --silent
done
```

## Real-world examples

```bash
# Get total stars for all your repos
gh api user/repos --paginate --jq '[.[].stargazers_count] | add'

# Find your largest repos by size
gh api user/repos --paginate \
  --jq 'sort_by(.size) | reverse | .[:10] | .[] | "\(.full_name): \(.size)KB"'

# List all GitHub Actions secrets (names only — values are write-only)
gh api repos/{owner}/{repo}/actions/secrets --jq '.secrets[].name'

# Get the latest commit SHA on main
gh api repos/{owner}/{repo}/git/ref/heads/main --jq '.object.sha'

# List all branch protection rules
gh api repos/{owner}/{repo}/branches/main/protection

# Get all workflow run durations for the last week
gh api repos/{owner}/{repo}/actions/runs \
  --jq '.workflow_runs[] | "\(.name): \(.run_started_at) → \(.updated_at)"'

# Check if a user is a collaborator
gh api repos/{owner}/{repo}/collaborators/username --silent && echo "Yes" || echo "No"

# Get repo traffic (requires push access)
gh api repos/{owner}/{repo}/traffic/clones --jq '.clones[] | "\(.timestamp): \(.count)"'

# Export org members to CSV
gh api orgs/myorg/members --paginate \
  --jq '.[] | [.login, .html_url] | @csv' > members.csv

# Find repos without branch protection
gh api user/repos --paginate --jq '.[].full_name' | while read -r repo; do
  if ! gh api repos/$repo/branches/main/protection --silent 2>/dev/null; then
    echo "UNPROTECTED: $repo"
  fi
done
```
