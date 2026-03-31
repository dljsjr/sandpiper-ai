---
title: "Optimize startup system prompt ordering for prefix caching"
status: NEEDS REVIEW
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-03-31T19:55:05.909Z
updated_at: 2026-03-31T22:35:02.610Z
---

# Optimize startup system prompt ordering for prefix caching

Reorder system prompt construction so static components are emitted first, followed by dynamic components ordered from least-likely to change to most-likely to change.\n\nDecision update: do not inject an additional dynamic Current Date line because the harness already provides Current date in the base system prompt; duplicating it adds churn without value.

---

# Activity Log

## 2026-03-31T19:55:05.949Z

- **description**: added (1 line)

## 2026-03-31T19:55:05.988Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-31T19:57:57.398Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-03-31T22:34:00.533Z

- **status**: NEEDS REVIEW → IN PROGRESS

## 2026-03-31T22:34:00.574Z

- **description**: updated

## 2026-03-31T22:35:02.610Z

- **status**: IN PROGRESS → NEEDS REVIEW
