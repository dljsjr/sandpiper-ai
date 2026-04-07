# Pi Codebase Deep Dive - Research Notes

**Date Started**: 2026-04-16  
**Purpose**: Comprehensive exploration of Pi coding agent internals to inform system prompt architecture decisions  
**Scope**: Pi docs, source code, extension APIs, prompt assembly, tool registration, skill loading

---

## Table of Contents

- [Pi Package Structure](#pi-package-structure)
- [Extension System](#extension-system)
- [Prompt Assembly](#prompt-assembly)
- [Tool System](#tool-system)
- [Skills System](#skills-system)
- [Context Files (AGENTS.md)](#context-files-agentsmd)
- [Session Management](#session-management)
- [Resource Loading](#resource-loading)
- [Key Findings](#key-findings)
- [Open Questions](#open-questions)

---

## Pi Package Structure

*(To be filled as we explore)*

---

## Extension System

*(To be filled as we explore)*

---

## Prompt Assembly

*(To be filled as we explore)*

---

## Tool System

*(To be filled as we explore)*

---

## Skills System

*(To be filled as we explore)*

---

## Context Files (AGENTS.md)

*(To be filled as we explore)*

---

## Session Management

*(To be filled as we explore)*

---

## Resource Loading

*(To be filled as we explore)*

---

## Key Findings

### System Prompt Assembly (CONFIRMED)

**PI's `buildSystemPrompt()` has two modes**:

1. **Default mode** (no customPrompt):
   - Builds dynamic tools list from `selectedTools` + `toolSnippets`
   - Builds dynamic guidelines based on available tools
   - Appends context files (AGENTS.md from global + ancestors)
   - Appends skills (if read tool available)
   - Appends date/CWD

2. **Custom mode** (customPrompt provided via `--system-prompt` or SYSTEM.md):
   - Uses custom base as-is
   - **SKIPS** dynamic tools/guidelines
   - **STILL** appends context files (AGENTS.md)
   - **STILL** appends skills (if read tool available)
   - **STILL** appends date/CWD

**Source**: `dist/core/system-prompt.js` lines 17-45

### Tool Registration (CRITICAL)

**Tools can be registered dynamically**:
- `pi.registerTool()` works during extension load AND after startup
- Can be called in `session_start`, command handlers, or any event handler
- **New tools are refreshed immediately** - appear in `pi.getAllTools()` without `/reload`
- LLM can use them immediately

**Source**: `docs/extensions.md` under "pi.registerTool()"

**Implication**: A static SYSTEM.md file would NEVER have the complete tools list. We MUST build the tools section dynamically in `before_agent_start` using `pi.getAllTools()`.

### Extension Event Flow

**Relevant events for system prompt**:
1. `session_start` - Extensions can register tools here
2. `resources_discover` - Extensions can contribute skill/prompt/theme paths
3. `before_agent_start` - Can modify system prompt (THIS IS WHERE WE WORK)
4. `tool_call` - Can block/modify tool calls

**Source**: `docs/extensions.md` lifecycle diagram

### Context Files (AGENTS.md)

**PI loads AGENTS.md from**:
- Global: `~/.pi/agent/AGENTS.md` (or `~/.sandpiper/agent/AGENTS.md`)
- Ancestors: Walks up from CWD looking for `AGENTS.md`
- Stops at git repo root or filesystem root

**Source**: `dist/core/resource-loader.js` `loadProjectContextFiles()`

### Skills Loading

**PI loads skills from**:
- Global: `~/.pi/agent/skills/`, `~/.agents/skills/`
- Project: `.pi/skills/`, `.agents/skills/` (in cwd and ancestors)
- Package: `skills/` directory in pi packages
- CLI: `--skill` flag paths

**Format**: XML in prompt (`<available_skills>...</available_skills>`)

**Source**: `dist/core/skills.js`, `docs/skills.md`

### System Prompt Override Mechanisms

**Three ways to override**:
1. **SYSTEM.md file** - Place in `~/.pi/agent/SYSTEM.md` or `<cwd>/.pi/SYSTEM.md`
2. **`--system-prompt` CLI flag** - Pass text or file path
3. **`systemPromptOverride` function** - Programmatic (SDK only)

**All three**: PI uses custom base, still appends context files + skills + date/CWD

**Source**: `README.md` line 283, `dist/core/resource-loader.js`

---

## Open Questions

### RESOLVED

1. ~~**Can we use `--system-prompt`?**~~ YES - PoC successful
2. ~~**Does PI still append AGENTS.md with custom base?**~~ YES - confirmed
3. ~~**Does PI still append skills with custom base?**~~ YES - confirmed
4. ~~**Does PI still append date/CWD with custom base?**~~ YES - confirmed
5. ~~**Can tools be registered dynamically?**~~ YES - `pi.registerTool()` works anytime
6. ~~**Does `pi.getAllTools()` reflect dynamic tools?**~~ YES - immediate refresh

### REMAINING

1. **What's the best architecture given dynamic tools?**
   - Option A: Build entire base in `before_agent_start` using `pi.getAllTools()`
   - Option B: Use SYSTEM.md for static parts, inject tools in `before_agent_start`
   - **Leaning toward Option A** - cleaner, no placeholder mechanism needed

2. **Should we replicate PI's tool snippet format exactly?**
   - PI's format: `- name: description`
   - We should match for consistency

3. **Should we replicate PI's guidelines logic?**
   - PI's logic: Different guidelines based on which tools are available
   - Could simplify to always-relevant guidelines

---

## Exploration Log

### Session 1: 2026-04-16

**Goal**: Read all Pi documentation files

**Files Read**:
- *(To be filled)*

**Notes**:
- *(To be filled)*
