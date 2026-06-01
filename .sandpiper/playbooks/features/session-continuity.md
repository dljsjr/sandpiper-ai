---
name: Session Continuity and Standup
read_when: standup, session continuity, concurrent sessions, PID files, liveness, .sandpiper/standup.md, sandpiper-standup, startup context, active session, handoff
---

# Session Continuity and Standup

Read this before changing standup behavior, concurrent-session handling, or session startup context.

## Key Rules

- The standup file is `.sandpiper/standup.md`.
- Use the standup CLI/skill behavior rather than assuming direct file shape.
- Concurrent session behavior depends on PID/liveness checks; do not rely only on matching session UUIDs.
- Keep startup context compact. Active tasks and meaningful dirty-working-copy summaries are useful; noisy task-history churn is not.
- Treat YAAMS as optional external memory until it is integrated into this repo. Persistent identity agents may have memory tools; ordinary ephemeral/expert agents may not. Do not make startup or continuity code depend on YAAMS being configured.
- Tests must not touch real user standup files, real YAAMS databases, or installed config.

## References

- Public feature overview: `docs/features/standup.md`
- Concurrent sessions design: `.sandpiper/docs/specs/concurrent-sessions.md`
- Standup skill: `packages/resources/skills/sandpiper/standup/SKILL.md`
- Standup CLI package: `packages/sandpiper-standup-cli/`
