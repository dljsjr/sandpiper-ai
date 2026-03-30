---
title: "Simplify root package metadata after extension unbundling"
status: NEEDS REVIEW
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-03-30T19:31:59.244Z
updated_at: 2026-03-30T19:39:50.115Z
---

# Simplify root package metadata after extension unbundling

After TOOLS-10, extensions under extensions/ are loaded from source via jiti and copied into dist/ by postinstall rather than being built as bundled artifacts. The root package metadata still appears to carry some extension-oriented declarations that may no longer be necessary or may obscure the new architecture.

Scope: audit the root package metadata for extension-related declarations that are now redundant or misleading after unbundling, and simplify them without changing the runtime behavior of the actual packaged artifacts. Focus on metadata clarity rather than broader package-publishing redesign.

Validation should confirm that extension loading still works after the cleanup and that the remaining root metadata reflects the current architecture more accurately.

---

# Activity Log

## 2026-03-30T19:31:59.283Z

- **description**: added (5 lines)

## 2026-03-30T19:31:59.506Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-30T19:39:50.116Z

- **status**: IN PROGRESS → NEEDS REVIEW
