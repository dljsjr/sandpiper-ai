---
description: Re-orient a fresh session before implementation
---
Treat this as a cold-start continuity check for the current repository.

Work in this order:

1. Read the current `.sandpiper/standup.md` and summarize:
   - what was accomplished recently
   - what is in progress
   - what the next session should do
2. Use the **tasks** skill CLI to review live work:
   - `sandpiper-tasks task list -s IN_PROGRESS`
   - `sandpiper-tasks task list -s NEEDS_REVIEW`
   - `sandpiper-tasks task list -s NOT_STARTED --priority HIGH`
3. Check whether the working copy is dirty with `jj status` or `jj diff --summary`, and summarize any meaningful changed files
4. Use the root `AGENTS.md` routing table to identify the focused docs and local `README.md` / `AGENTS.md` files relevant to the user's current request
5. Report back with:
   - a concise continuity summary
   - the active tasks that matter most right now
   - any dirty-working-copy context that could affect the work
   - the focused docs / local docs that should guide implementation next
   - a proposed next step before changing code

Do not start implementing until the continuity summary is complete.
