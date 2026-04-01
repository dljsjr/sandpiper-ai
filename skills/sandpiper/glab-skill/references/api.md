# glab api — REST and GraphQL API Wrapper Reference

`glab api` transforms the CLI into an authenticated HTTP client for the entire GitLab
API surface. Any operation possible through the GitLab REST or GraphQL API is available
through this single command, with automatic auth, pagination, and placeholder resolution.

---

## Table of contents

1. [Basic REST requests](#basic-rest-requests)
2. [Path placeholders](#path-placeholders)
3. [HTTP methods and data](#http-methods-and-data)
4. [GraphQL queries](#graphql-queries)
5. [Pagination](#pagination)
6. [Output formats](#output-formats)
7. [File uploads](#file-uploads)
8. [Headers and debugging](#headers-and-debugging)
9. [Scripting patterns](#scripting-patterns)
10. [Real-world examples](#real-world-examples)

---

## Basic REST requests

The endpoint is the API v4 path after `https://gitlab.com/api/v4/`. GET is the default.

```bash
glab api projects/:fullpath              # GET project info
glab api projects/:fullpath/merge_requests  # GET merge requests
glab api user                            # GET authenticated user
glab api groups/mygroup                  # GET group info
glab api version                         # Check GitLab version
```

## Path placeholders

Inside a git repository with a GitLab remote, these placeholders auto-resolve:

- `:fullpath` or `:id` — URL-encoded project path (e.g., `group%2Frepo`)
- `:user` or `:username` — authenticated username
- `:group` — group/namespace of current project
- `:namespace` — namespace of current project
- `:repo` — repo name
- `:branch` — current branch

```bash
glab api projects/:fullpath/repository/branches  # Auto-resolved
glab api projects/:fullpath/merge_requests/55
glab api groups/:group/projects
```

**Note:** When using project paths manually (not with `:fullpath`), URL-encode slashes:
`glab api projects/mygroup%2Fmyrepo/issues`.

## HTTP methods and data

Use `--method` (or `-X`) for the HTTP method. Use `-f` for string fields and `-F` for
typed fields.

```bash
# POST — create a resource
glab api --method POST projects/:fullpath/issues \
  -f title="Bug report" \
  -f description="Steps to reproduce..."

# PUT — update a resource
glab api --method PUT projects/:fullpath/issues/42 \
  -f state_event="close"

# DELETE — remove a resource
glab api --method DELETE projects/:fullpath/issues/42/labels/bug

# -f (raw string field)
glab api --method POST projects/:fullpath/issues -f title="test"

# -F (typed field: numbers, booleans, files)
glab api --method POST projects/:fullpath/pipelines -F ref=main

# --raw-field for unprocessed values
glab api --method POST projects/:fullpath/issues --raw-field title="raw value"

# --input for raw request body from file or stdin
echo '{"title":"test"}' | glab api --method POST projects/:fullpath/issues --input -
glab api --method POST projects/:fullpath/issues --input payload.json
```

## GraphQL queries

Use the `graphql` endpoint with `-f query=` for queries and `-F` for variables.

```bash
# Simple query
glab api graphql -f query='{ currentUser { username name } }'

# Query with variables
glab api graphql \
  -F fullPath="mygroup/myrepo" \
  -f query='
    query($fullPath: ID!) {
      project(fullPath: $fullPath) {
        name
        description
        starCount
        mergeRequests(last: 5) {
          nodes { title iid state }
        }
      }
    }'

# Mutations
glab api graphql -f query='
  mutation {
    createNote(input: {
      noteableId: "gid://gitlab/MergeRequest/123"
      body: "Looks good!"
    }) {
      note { id body }
    }
  }'
```

## Pagination

`--paginate` automatically follows GitLab's `Link` headers or GraphQL `pageInfo` cursors.

### REST pagination

```bash
# Fetch all issues (all pages)
glab api projects/:fullpath/issues --paginate

# Paginate and filter with jq
glab api projects/:fullpath/issues --paginate | jq '.[].title'

# Control per-page count
glab api projects/:fullpath/issues --per-page 100 --paginate
```

**Important:** Unlike gh, glab does NOT have a `--slurp` flag. Each page is returned as
a separate JSON array. If you need a single array, use:
```bash
glab api projects/:fullpath/issues --paginate | jq -s 'flatten'
```

### GraphQL pagination

For GraphQL, `--paginate` requires `$endCursor: String` variable and
`pageInfo { hasNextPage endCursor }`:

```bash
glab api graphql --paginate -f query='
  query($endCursor: String) {
    project(fullPath: "mygroup/myrepo") {
      issues(first: 100, after: $endCursor) {
        pageInfo { hasNextPage endCursor }
        nodes { title iid }
      }
    }
  }'
```

## Output formats

glab api supports two output modes:

```bash
# Default JSON output
glab api projects/:fullpath

# NDJSON (newline-delimited JSON) — for streaming large datasets
glab api projects/:fullpath/issues --paginate --output ndjson

# Pipe to jq for filtering (required — no built-in --jq)
glab api projects/:fullpath/issues | jq '.[].title'
glab api projects/:fullpath/merge_requests | jq '.[] | {iid: .iid, title: .title}'

# Tab-separated output via jq
glab api projects/:fullpath/merge_requests \
  | jq -r '.[] | [.iid, .title, .author.username] | @tsv'

# CSV output via jq
glab api projects/:fullpath/issues \
  | jq -r '.[] | [.iid, .title] | @csv'
```

## File uploads

Use `--form` for multipart/form-data uploads:

```bash
# Upload file to wiki
glab api --method POST projects/:fullpath/wikis/attachments \
  --form "file=@./image.png"

# Upload project avatar
glab api --method PUT projects/:fullpath \
  --form "avatar=@./logo.png"

# Upload release asset
glab api --method POST projects/:fullpath/uploads \
  --form "file=@./release.tar.gz"
```

## Headers and debugging

```bash
# Custom headers
glab api projects/:fullpath -H "Accept: application/json"

# Include response headers in output
glab api -i projects/:fullpath

# Silent mode — suppress response body
glab api --silent --method DELETE projects/:fullpath/issues/42

# Target specific hostname
glab api --hostname gitlab.corp.com projects/:fullpath
```

Debug output uses environment variables:
```bash
DEBUG=1 glab api projects/:fullpath              # General debug
GLAB_DEBUG_HTTP=1 glab api projects/:fullpath    # HTTP transport debug
```

## Scripting patterns

### Looping over paginated results

```bash
# Process all open MRs
glab api projects/:fullpath/merge_requests?state=opened --paginate \
  | jq -r '.[].iid' | while read -r mr; do
    echo "Processing MR !$mr"
    glab mr view "$mr" -F json | jq '.title'
done
```

### Conditional API calls

```bash
# Check if a label exists before creating
if ! glab api projects/:fullpath/labels/bug --silent 2>/dev/null; then
  glab api --method POST projects/:fullpath/labels \
    -f name="bug" -f color="#d73a4a" -f description="Something isn't working"
fi
```

### Bulk operations

```bash
# Close all issues with "wontfix" label
glab api projects/:fullpath/issues?labels=wontfix --paginate \
  | jq -r '.[].iid' | while read -r iid; do
    glab api --method PUT projects/:fullpath/issues/$iid \
      -f state_event=close --silent
done

# Add a label to all open MRs
glab mr list -F json | jq -r '.[].iid' | while read -r mr; do
  glab api --method PUT projects/:fullpath/merge_requests/$mr \
    -f add_labels=needs-review --silent
done
```

### Working with CI/CD via API

```bash
# Get latest pipeline status
glab api projects/:fullpath/pipelines?per_page=1 | jq '.[0].status'

# Get pipeline variables
glab api projects/:fullpath/pipelines/12345/variables

# Download job artifact
glab api projects/:fullpath/jobs/12345/artifacts --output artifacts.zip

# Trigger pipeline with variables
glab api --method POST projects/:fullpath/pipeline \
  -f ref=main \
  -F 'variables[0][key]=DEPLOY_ENV' \
  -F 'variables[0][value]=production'
```

## Real-world examples

```bash
# Get project statistics
glab api projects/:fullpath?statistics=true \
  | jq '{stars: .star_count, forks: .forks_count, size: .statistics.repository_size}'

# List all project members with access levels
glab api projects/:fullpath/members/all --paginate \
  | jq '.[] | "\(.username): access_level=\(.access_level)"'

# Find MRs merged in the last 7 days
glab api "projects/:fullpath/merge_requests?state=merged&updated_after=$(date -d '7 days ago' -Iseconds)" \
  | jq '.[] | "\(.iid): \(.title)"'

# Get code coverage for a branch
glab api projects/:fullpath/repository/commits/main \
  | jq '.last_pipeline.id' | xargs -I {} \
    glab api projects/:fullpath/pipelines/{}/test_report_summary

# List all environments
glab api projects/:fullpath/environments --paginate | jq '.[].name'

# Get deployment history for production
glab api projects/:fullpath/environments/production/deployments \
  | jq '.[] | "\(.created_at): \(.ref) by \(.user.username)"'

# Export project as tar.gz
glab api projects/:fullpath/export --method POST --silent
# ... wait for export ...
glab api projects/:fullpath/export/download --output project.tar.gz

# Get container registry repositories
glab api projects/:fullpath/registry/repositories --paginate \
  | jq '.[].path'

# List wiki pages
glab api projects/:fullpath/wikis | jq '.[].title'

# Get merge request approval rules
glab api projects/:fullpath/approval_rules \
  | jq '.[] | {name: .name, approvals_required: .approvals_required}'

# Search across all projects in a group
glab api groups/mygroup/search?scope=blobs&search="TODO" --paginate \
  | jq '.[] | "\(.project_id):\(.path):\(.startline)"'

# Get recent audit events (admin)
glab api audit_events?created_after=2025-01-01 --paginate \
  | jq '.[] | "\(.created_at): \(.event_name)"'

# Check if CI/CD is enabled and get shared runners
glab api projects/:fullpath | jq '{ci_enabled: .jobs_enabled, shared_runners: .shared_runners_enabled}'
glab api runners?scope=active --paginate | jq '.[] | "\(.id): \(.description) (\(.status))"'
```
