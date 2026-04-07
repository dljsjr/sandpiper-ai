# Sandpiper System Prompt Architecture

**Status**: ✅ **ARCHITECTURE DECISION** - Chosen approach for system prompt assembly  
**Date**: 2026-04-16  
**Related**: AGENT-? (implementation task)  
**Last verified**: 2026-04-16  

---

## Summary

**Decision**: Build the base prompt dynamically in `before_agent_start` by parsing PI's assembled prompt, replacing identity/docs sections, and keeping PI's dynamic tools/guidelines.

**Rejected**: SYSTEM.md static file approach (see `archive/system-md-approach.md`) - PI's base prompt has dynamic tool-dependent content that a static file cannot replicate.

**Key insight**: Tools can be registered dynamically at ANY time via `pi.registerTool()`, so the tools section MUST be built dynamically using `pi.getAllTools()`.

---


**Date**: 2026-04-16  
**Based on**: Deep dive into Pi internals, extension examples, and PoC testing

---

## Problem Statement

We need to:
1. Replace PI's identity block with unified Sandpiper identity
2. Fix Pi docs paths (currently point to our repo, not actual Pi package)
3. Add Sandpiper docs with same granularity as Pi's
4. Handle **dynamic tools** (extensions can register tools at runtime)
5. Reuse PI's work loading AGENTS.md files and skills
6. Add our dynamic sections (standup, tasks, working copy, cold-start)

---

## Constraints Discovered

### Dynamic Tools (BLOCKER for SYSTEM.md approach)

From `docs/extensions.md`:
> "`pi.registerTool()` works both during extension load and **after startup**. You can call it inside `session_start`, command handlers, or other event handlers. **New tools are refreshed immediately** in the same session, so they appear in `pi.getAllTools()` and are callable by the LLM **without `/reload`**."

**Implication**: A static SYSTEM.md file would NEVER have the complete tools list. Tools can be registered:
- During extension load
- In `session_start` handlers
- In command handlers (e.g., `/add-echo-tool`)
- In any event handler

**Conclusion**: We MUST build the tools section dynamically in `before_agent_start` using `pi.getAllTools()`.

---

## Recommended Architecture

### Approach: Build Base in `before_agent_start`

**Don't use SYSTEM.md or `--system-prompt`**. Instead:

1. **Let PI build its default base prompt** (with dynamic tools/guidelines)
2. **In `before_agent_start` handler**:
   - Extract and REPLACE the identity/docs section (fix paths, add Sandpiper docs)
   - **KEEP** PI's tools section (already dynamic and correct!)
   - **KEEP** PI's guidelines section (already matches available tools!)
   - **KEEP** PI's skills section (already appended by PI)
   - **KEEP** PI's date/CWD (already appended by PI)
   - **ADD** our dynamic sections (standup, tasks, working copy, cold-start, projects)

### Why This Approach?

| Requirement | How We Meet It |
|-------------|----------------|
| ✅ Unified identity | Replace identity section in `before_agent_start` |
| ✅ Fix Pi docs paths | Replace docs section with correct paths |
| ✅ Add Sandpiper docs | Add parallel docs section with same granularity |
| ✅ Handle dynamic tools | **KEEP PI's tools section** (already dynamic) |
| ✅ Reuse AGENTS.md loading | **KEEP PI's context files** (already appended) |
| ✅ Reuse skills loading | **KEEP PI's skills section** (already appended) |
| ✅ Add dynamic sections | Append in `before_agent_start` |

**Key insight**: We're not replacing PI's base prompt - we're **surgically modifying** it to fix the identity/docs while keeping everything else PI built.

---

## Implementation Plan

### Step 1: Create Prompt Builder Module

**File**: `packages/core/src/sandpiper-prompt-builder.ts`

```typescript
export interface PromptSections {
  identity: string;
  tools: string;
  guidelines: string;
  piDocs: string;
  sandpiperDocs: string;
  contextFiles: string;
  skills: string;
  dateCwd: string;
}

/**
 * Parse PI's assembled prompt into sections.
 * Returns sections for manipulation.
 */
export function parsePromptSections(fullPrompt: string): PromptSections {
  // Use regex to extract sections based on known markers:
  // - "Available tools:" starts tools section
  // - "Guidelines:" starts guidelines section
  // - "Pi documentation" starts docs section
  // - "# Project Context" starts context files
  // - "<available_skills>" starts skills
  // - "Current date:" starts date/CWD
}

/**
 * Build Sandpiper identity section.
 */
export function buildSandpiperIdentity(options: {
  piCodingAgentPackage: string;
  piCodingAgentVersion: string;
}): string {
  return `
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

**Pi Framework Documentation** (read when working on Pi itself):
- Main documentation: ${options.piCodingAgentPackage}/README.md
- Extension API: ${options.piCodingAgentPackage}/docs/extensions.md
- Skills API: ${options.piCodingAgentPackage}/docs/skills.md
- TUI API: ${options.piCodingAgentPackage}/docs/tui.md
- Always read Pi docs completely and follow cross-references before implementing.
`;
}

/**
 * Reassemble prompt from sections.
 */
export function reassemblePrompt(sections: PromptSections): string {
  return [
    sections.identity,
    sections.tools,
    sections.guidelines,
    sections.piDocs, // Replace with sandpiperDocs or keep both?
    sections.contextFiles,
    sections.skills,
    sections.dateCwd,
  ].join('\n\n');
}
```

### Step 2: Modify System Extension

**File**: `extensions/system/startup-hooks.ts`

```typescript
import { parsePromptSections, buildSandpiperIdentity, reassemblePrompt } from 'sandpiper-ai-core/sandpiper-prompt-builder';

pi.on('before_agent_start', async (event, ctx) => {
  // 1. Parse PI's assembled prompt
  const sections = parsePromptSections(event.systemPrompt);
  
  // 2. Replace identity/docs sections
  sections.identity = buildSandpiperIdentity({
    piCodingAgentPackage: process.env.PI_CODING_AGENT_PACKAGE!,
    piCodingAgentVersion: process.env.PI_CODING_AGENT_VERSION!,
  });
  
  // 3. Reassemble base prompt
  let newPrompt = reassemblePrompt(sections);
  
  // 4. Add our dynamic sections
  const dynamicSections = [
    formatStandupContext(...),
    formatActiveTaskContext(...),
    formatWorkingCopySummary(...),
    formatProjectTriggers(...),
    formatColdStartGuidance(),
  ].filter(Boolean).join('\n\n');
  
  newPrompt += '\n\n' + dynamicSections;
  
  return {
    systemPrompt: newPrompt,
  };
});
```

### Step 3: Testing

**Unit tests**:
- `parsePromptSections()` correctly extracts sections
- `buildSandpiperIdentity()` produces correct output
- `reassemblePrompt()` produces valid prompt

**Integration test**:
- Run `SANDPIPER_DUMP_SYSTEM_PROMPT=1 pi`
- Verify structure:
  - Sandpiper identity (not PI's)
  - Correct Pi docs paths (PI_CODING_AGENT_PACKAGE)
  - Sandpiper docs section present
  - Tools section intact (from PI)
  - Guidelines intact (from PI)
  - AGENTS.md files appended (from PI)
  - Skills appended (from PI)
  - Date/CWD appended (from PI)
  - Dynamic sections appended (from us)

---

## Trade-offs

### Pros

✅ **Handles dynamic tools** - Uses PI's dynamically-built tools section  
✅ **Reuses PI's work** - AGENTS.md, skills, guidelines all from PI  
✅ **Minimal code** - Just parse/replace/reassemble, no duplication  
✅ **Clean separation** - Identity/docs are ours, rest is PI's  
✅ **No placeholder mechanism** - Direct string manipulation  

### Cons

⚠️ **Tight coupling to PI's prompt structure** - If PI changes section markers, our regex breaks  
  - Mitigation: Section markers are stable ("Available tools:", "Guidelines:", etc.)  
  - Mitigation: We'd notice immediately in testing  

⚠️ **String manipulation** - Parsing and reassembling strings feels fragile  
  - Mitigation: Well-tested regex patterns  
  - Mitigation: Fallback to current behavior on parse failure  

---

## Alternative Approaches Considered

### Option A: SYSTEM.md + Dynamic Injection

**Idea**: Use SYSTEM.md for static base, inject tools in `before_agent_start`

**Why rejected**:
- Tools can be registered AFTER `session_start` (in command handlers)
- Would need to re-inject tools on every `before_agent_start`
- More complex than just keeping PI's tools section
- No real benefit over recommended approach

### Option B: Full Rebuild in `before_agent_start`

**Idea**: Build entire prompt from scratch using `pi.getAllTools()`

**Why rejected**:
- Duplicates PI's tools/guidelines logic
- More code to maintain
- No benefit - PI already built it correctly
- Would still need to extract skills/context files or call PI's loaders

### Option C: `--system-prompt` Flag

**Idea**: Generate SYSTEM.md dynamically, pass via `--system-prompt`

**Why rejected**:
- Still can't handle tools registered after `session_start`
- More complex (file generation, template substitution)
- No benefit over recommended approach
- PI would still build the base, we'd just be replacing it

---

## Conclusion

**Recommended approach**: Parse PI's assembled prompt in `before_agent_start`, replace identity/docs sections, keep everything else, add our dynamic sections.

**Why**:
- Handles dynamic tools correctly
- Reuses PI's work (no duplication)
- Minimal code changes
- Clean architectural separation
- No complex placeholder mechanisms

**Next steps**:
1. Implement `packages/core/src/sandpiper-prompt-builder.ts`
2. Modify `extensions/system/startup-hooks.ts`
3. Add unit tests
4. Integration test with prompt dumps
5. Smoke test with real session
