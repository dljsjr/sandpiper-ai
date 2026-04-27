---
title: "Define Tattler inbox batch content and details schema"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: "Huginn"
reporter: USER
created_at: 2026-05-25T19:11:37.811Z
depends_on:
  - TAT-45
  - TAT-58
updated_at: 2026-05-25T19:48:18.049Z
---

# Define Tattler inbox batch content and details schema

Implemented in jj changes xszoyull / 7401716b plus review fix wxqnulxl / 5874382f. Defines canonical pending batch custom message type tattler:pending-batch with model-facing XML content and structured details { kind: batch, batchId, messages[] }. Content is canonical for LLM/debug/compaction; details are for renderer fidelity. Batch display is forced false until TAT-43 lands a renderer that can filter hidden vs visible items, preventing mixed hidden Tattler + visible Chorus batches from raw-rendering hidden content.

---

# Activity Log

## 2026-05-25T19:12:56.518Z

- **assignee**: UNASSIGNED → Huginn

## 2026-05-25T19:17:28.092Z

- **depends_on**: (none) → TAT-45, TAT-58

## 2026-05-25T19:38:32.773Z

- **description**: updated

## 2026-05-25T19:38:32.995Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-05-25T19:46:26.394Z

- **description**: updated

## 2026-05-25T19:48:18.050Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
