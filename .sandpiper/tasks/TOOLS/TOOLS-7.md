---
title: "Convert remaining shell scripts to portable TypeScript"
status: NOT STARTED
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-03-24T21:02:38.813Z
updated_at: 2026-03-24T21:02:53.136Z
---

# Convert remaining shell scripts to portable TypeScript

Replace remaining bash/POSIX shell scripts with portable TypeScript for cross-platform support. Candidates: postinstall.sh (rsync, symlinks, mcporter, curl), preinstall.sh (mkdir scaffolding), vendor.sh, locatePi.sh. The clean script was already converted (devtools/clean.ts). Low priority — the shell scripts work fine on macOS/Linux, this is only needed for Windows support or environments without bash.

---

# Activity Log

## 2026-03-24T21:02:53.137Z

- **description**: added (1 line)
