---
title: "Build rule grading UI with criteria versioning in Streamlit dashboard"
status: COMPLETE
resolution: WONTFIX
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-04-21T19:47:28.544Z
updated_at: 2026-05-04T19:31:48.100Z
---

# Build rule grading UI with criteria versioning in Streamlit dashboard

## Implementation

### DuckDB Schema (history_db.py)
Added three new tables:
- `extracted_rulesets` — extraction cache keyed by SHA256(agents_content + extractor_prompt_content)
- `criteria_versions` — versioned grading criteria snapshots
- `rule_grades` — individual rule grades with trace/scope status

### Harness Cache (harness.ts)
- Computes `cache_key = SHA256(agentsContent + extractorPromptContent)`
- Cache path: `CACHE_DIR/{cache_key}.json` (default `./extracted_rulesets/`)
- Cache hit: loads rules, skips extraction (extractionTimeMs=0)
- Cache miss: extracts, saves to cache, continues
- Emits `cacheHit: true/false` in result JSON

### Grading Page (smoke_dashboard.py)
New "Rule Grading" view added to sidebar radio:
- Lists cached rulesets with rule count + extraction timestamp
- Sequential rule grading interface (Previous/Next navigation)
- Grades per rule: trace_status + scope_status + notes
- Progress tracking: total / graded / remaining
- Summary table for completed grading

## Status
- ✅ DuckDB schema deployed
- ✅ Harness cache implemented & compiled
- ✅ Grading UI implemented in Streamlit
- ✅ Dashboard restarted with new view
- ⏳ Need to populate extraction cache (run matrix with CACHE_DIR env)
- ⏳ Need to validate grading flow end-to-end
- ⏳ Need to define actual grading criteria (currently uses placeholder version_id=1)

## Next Steps
1. Run matrix to populate `extracted_rulesets` cache
2. Test grading UI in browser
3. Define criteria_versions content
4. Grade sample rulesets to validate framework

---

# Activity Log

## 2026-05-04T19:31:48.104Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: WONTFIX
