---
title: "Test suite"
status: IN PROGRESS
kind: TASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-21T01:54:16-05:00
---

# Test suite

Implement comprehensive unit and integration tests using Vitest, following the test-first (TDD/BDD) approach.

**Acceptance criteria:**
- All framework-independent modules have unit tests
- Integration tests validate end-to-end behavior with real Zellij + fish
- Edge cases have dedicated test coverage
- Tests run via `bunx vitest`
- Test real behavior over mocks where practical (real FIFOs, mock Zellij CLI)

**References:** AGENTS.md (Testing section), Work Plan Phase 3
