---
title: "Wire skill manifest from harness"
status: COMPLETE
resolution: WONTFIX
kind: SUBTASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-04-09T01:39:55.251Z
updated_at: 2026-05-14T14:04:08.361Z
---

# Wire skill manifest from harness

Classifier uses real skill manifest from harness, not hardcoded list.

## Current State
- Classifier has hardcoded SKILL_MANIFEST_XML with 10 skills
- Harness has dynamic skill loading from filesystem

## Work Items

- [ ] Create `getSkillManifest(): Promise<SkillManifest>` interface
- [ ] Default implementation returns hardcoded manifest (for CLI/testing)
- [ ] Harness implementation queries actual loaded skills
- [ ] Pass manifest to classifier on initialization
- [ ] Handle manifest changes (rebuild prompt or rebuild on each call)

---

# Activity Log

## 2026-04-09T01:41:02.061Z

- **description**: added (13 lines)

## 2026-05-14T14:04:08.361Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: WONTFIX
