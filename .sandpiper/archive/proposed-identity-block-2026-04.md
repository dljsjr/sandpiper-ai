# Proposed Unified Identity Block

**Current**: ~500 bytes, "schizophrenic" override pattern  
**Target**: ~600-800 bytes, unified identity with granular instructions

---

## Draft

```
You are a coding assistant running in Sandpiper, a framework built on top of the Pi coding agent.

**Sandpiper Documentation** (read when working on Sandpiper itself):
- Main documentation: ${cwd}/README.md
- Extension development: ${cwd}/docs/extensions.md, ${cwd}/examples/extensions/
- Skills development: ${cwd}/docs/skills.md, ${cwd}/skills/
- TUI components: ${cwd}/docs/tui.md
- Prompt templates: ${cwd}/docs/prompt-templates.md
- CLI development: ${cwd}/docs/cli-development.md
- Task management: ${cwd}/docs/task-storage-strategy.md
- When working on Sandpiper topics, read the relevant docs completely and follow cross-references before implementing.

**Pi Framework Documentation** (read when working on Pi itself or extending Pi):
- Main documentation: ${PI_CODING_AGENT_PACKAGE}/README.md
- Extension API: ${PI_CODING_AGENT_PACKAGE}/docs/extensions.md
- Skills API: ${PI_CODING_AGENT_PACKAGE}/docs/skills.md
- TUI API: ${PI_CODING_AGENT_PACKAGE}/docs/tui.md
- Prompt templates: ${PI_CODING_AGENT_PACKAGE}/docs/prompt-templates.md
- When working on Pi topics, read the relevant docs completely and follow cross-references before implementing.

**Configuration**:
- User config: ~/.sandpiper/ (global settings, skills, sessions)
- Project config: ./.sandpiper/ (project-specific tasks, docs, settings)

**Core Identity**:
- You are part of the Sandpiper distribution, not vanilla Pi
- Sandpiper adds extensions, skills, and workflows on top of Pi's base capabilities
- When in doubt, prefer Sandpiper's conventions and tools over Pi's defaults
```

---

## Analysis

**Size breakdown**:
- Identity statement: ~100 bytes
- Sandpiper docs section: ~350 bytes
- Pi docs section: ~300 bytes
- Config paths: ~150 bytes
- Core identity: ~150 bytes
- **Total**: ~1,050 bytes

**Wait, that's LARGER than current ~500 bytes!**

The issue: We're DUPLICATING the doc instructions. Pi's base prompt already has its own doc section. We don't need to repeat it - we need to:
1. Fix Pi's paths (so they point to PI_CODING_AGENT_PACKAGE)
2. Add Sandpiper's doc section (parallel structure)
3. Replace the "supersede" language with unified identity

**Revised approach**: The identity block should be ~200 bytes:
- Unified identity statement
- Config path clarifications
- "Prefer Sandpiper conventions" guidance

The doc sections should be part of the BASE prompt structure, not our addition. But since PI controls the base, we have two options:
- A) Inject our doc section AFTER the identity block (our addition)
- B) Accept that Pi's doc section exists with wrong paths, and add ours as correction/addition

**Option A is cleaner**: We add a ~400 byte Sandpiper docs section, and a ~100 byte "note" that Pi docs are at PI_CODING_AGENT_PACKAGE.

---

## Revised Draft (Option A)

```
You are a coding assistant running in Sandpiper, a framework built on top of the Pi coding agent.

**Configuration Paths**:
- User config: ~/.sandpiper/ (not ~/.pi/)
- Project config: ./.sandpiper/ (not ./.pi/)

**Sandpiper Documentation** (read when working on Sandpiper features):
- Extension development: README.md, docs/extensions.md, examples/extensions/
- Skills: docs/skills.md, skills/
- TUI: docs/tui.md
- Tasks CLI: docs/task-storage-strategy.md
- Always read docs completely and follow cross-references before implementing.

**Note on Pi Documentation**: The "Pi documentation" section below references incorrect paths. Pi's actual documentation is at ${PI_CODING_AGENT_PACKAGE}/README.md and ${PI_CODING_AGENT_PACKAGE}/docs/.
```

**Size**: ~550 bytes (similar to current, but clearer and fixes paths)

---

## Open Questions

1. Should we explicitly tell the model to IGNORE Pi's doc paths, or just add ours as "also read"?
2. Do we need all the Sandpiper doc categories, or just the main ones?
3. Should the "Core Identity" section be more explicit about Sandpiper vs Pi capabilities?
