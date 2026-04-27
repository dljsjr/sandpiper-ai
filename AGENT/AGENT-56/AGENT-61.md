---
title: "Add production logging"
status: COMPLETE
resolution: WONTFIX
kind: SUBTASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-04-09T01:39:55.299Z
updated_at: 2026-05-14T14:04:08.424Z
---

# Add production logging

Capture classifier decisions for analysis.

## Log Format

```json
{
  "timestamp": "ISO-8601",
  "prompt": "user prompt text",
  "result": {
    "guidance": "heavy",
    "skills": ["refactoring"]
  },
  "latency_ms": 342,
  "cache_hit": false
}
```

## Work Items

- [ ] Log every classification call with timestamp, prompt, result, latency, cache state
- [ ] Add optional side-by-side logging (LLM vs regex) for A/B comparison
- [ ] Log injection events (mode, skills, turn number)
- [ ] Flag divergences between LLM and regex for review

---

# Activity Log

## 2026-04-09T01:41:23.643Z

- **description**: added (23 lines)

## 2026-05-14T14:04:08.425Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: WONTFIX
