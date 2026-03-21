---
title: "Implement index update command"
status: NEEDS REVIEW
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-03-21T12:30:00-05:00
updated_at: 2026-03-21T18:17:11.983Z
---

# Implement index update command

Implement `<tasks-cli> index update` — scans a `.sandpiper/tasks` directory, parses task frontmatter, and maintains a TOON-serialized index file for efficient querying.

**Requirements:**
- Confirm presence of `.sandpiper/tasks` subdirectory
- Optionally accept path to parent directory as argument
- Deserialize existing index file before performing operations
- Index contains task frontmatter metadata in structured format
- Each task entry includes a `lastIndexedAt` unix epoch timestamp
- Designed for efficient queries
- Serialized as `index.toon` at the root of the tasks directory
- Compare file mtime with lastIndexedAt, skip unmodified files
- Remove tasks from index that no longer exist on disk

**Data format:** TOON (via `@toon-format/toon`)
