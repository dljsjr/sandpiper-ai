---
description: Re-orient a fresh session before implementation
---
Treat this as a cold-start continuity check for the current repository.

Work in this order:

1. If Journal is installed, load its skill and read through its resolved absolute script. Use an explicit absolute `--dir <project>/.sandpiper` for work outside the launch project. Summarize:
   - what was accomplished recently
   - what is in progress
   - what the next session should do
2. If the repository uses a task tracker, review work in progress, work awaiting review, and high-priority backlog items through that tracker.
3. Check whether the working copy is dirty using the repo's version control tool (e.g., `jj status`, `git status`), and summarize any meaningful changed files
4. Use the root `AGENTS.md` routing table to identify the focused docs and local `README.md` / `AGENTS.md` files relevant to the user's current request
5. Report back with:
   - a concise continuity summary
   - the active tasks that matter most right now
   - any dirty-working-copy context that could affect the work
   - the focused docs / local docs that should guide implementation next
   - a proposed next step before changing code

Do not start implementing until the continuity summary is complete.
