---
title: "Style tattler_receive tool call background"
status: COMPLETE
resolution: DONE
kind: BUG
priority: MEDIUM
assignee: "Huginn"
reporter: USER
created_at: 2026-05-25T21:38:04.446Z
related:
  - TAT-38
  - TAT-59
  - TAT-23
  - TAT-62
updated_at: 2026-05-25T22:08:16.291Z

---

# Style tattler_receive tool call background

Implemented in jj changes tzuoyxvk / 8b1fca01 and rylstlsy / 69f2d3fc. The canonical tattler:pending-batch renderer now gives each visible Chorus card one background-padded blank line above and below and one background-colored cell of horizontal padding on the left and right of content lines. Content wraps/truncates against width-2 so right padding is preserved; blank padding lines remain full width. Multiple cards retain the separator, and hidden Tattler DMs remain non-rendered. Tests cover top/bottom blank background lines and left/right horizontal padding.

---

# Activity Log

## 2026-05-25T21:38:41.985Z

- **description**: updated

## 2026-05-25T21:47:20.750Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Huginn

## 2026-05-25T21:47:20.807Z

- **description**: updated

## 2026-05-25T21:47:20.865Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-25T21:50:33.781Z

- **description**: updated

## 2026-05-25T22:00:06.789Z

- **description**: updated
- **related**: TAT-38, TAT-59, TAT-23 → TAT-38, TAT-59, TAT-23, TAT-62

## 2026-05-25T22:00:12.908Z

- **status**: NEEDS REVIEW → IN PROGRESS

## 2026-05-25T22:00:12.969Z

- **description**: updated

## 2026-05-25T22:01:19.797Z

- **description**: updated

## 2026-05-25T22:01:19.881Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-25T22:02:08.799Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-05-25T22:05:32.440Z

- **status**: COMPLETE → IN PROGRESS
- **description**: updated

## 2026-05-25T22:05:35.324Z

- **description**: 1 line → updated (5 lines)

## 2026-05-25T22:06:30.581Z

- **description**: 5 lines → updated (1 line)

## 2026-05-25T22:06:30.663Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-25T22:08:16.297Z

- **status**: NEEDS REVIEW → COMPLETE
