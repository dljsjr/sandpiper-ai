---
title: "Create ClassifierService wrapper"
status: COMPLETE
resolution: WONTFIX
kind: SUBTASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-04-09T01:38:57.366Z
updated_at: 2026-05-14T14:04:08.196Z
---

# Create ClassifierService wrapper

Production-ready wrapper that can be called from the harness.

## Work Items

- [ ] Extract `buildSystemPrompt()` to shared module (`classifier-prompt.ts`)
- [ ] Create `ClassifierService` class with singleton pattern
- [ ] Add `classify(prompt: string): Promise<ClassifierResult>` method
- [ ] Add timeout handling (default 5000ms, return fallback on timeout)
- [ ] Add LRU cache for recent prompts (configurable size, default 100)
- [ ] Add proper disposal method for clean shutdown

---

# Activity Log

## 2026-04-09T01:39:24.612Z

- **description**: added (10 lines)

## 2026-05-14T14:04:08.197Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: WONTFIX
