# System Prompt Replacement - Implementation Strategy

**Date**: 2026-04-16  
**Goal**: Replace PI's base prompt with our own unified Sandpiper base prompt

---

## Key Discoveries

### PI's Extension API Capabilities

**Available hooks for our use:**

1. **`resources_discover`** - Contribute skill/prompt/theme paths
   ```typescript
   pi.on("resources_discover", async (event, _ctx) => {
     return {
       skillPaths: ["/path/to/skills"],
       promptPaths: ["/path/to/prompts"],
     };
   });
   ```

2. **`before_agent_start`** - Modify system prompt per-turn
   ```typescript
   pi.on("before_agent_start", async (event, ctx) => {
     return {
       systemPrompt: customBasePrompt + contextSections,
     };
   });
   ```

3. **`pi.getAllTools()`** - Get list of all available tools
   - Returns: `{name, description, parameters, sourceInfo}[]`
   - Includes builtin tools + extension tools

4. **`ctx.sessionManager`** - Access session state
   - Can load skills/context files ourselves if needed

### PI's Prompt Assembly (from `dist/core/system-prompt.js`)

```javascript
buildSystemPrompt(options) {
  // 1. Tool definitions (from selectedTools + toolSnippets)
  // 2. Guidelines (based on available tools)
  // 3. Pi documentation paths (getReadmePath(), getDocsPath(), getExamplesPath())
  // 4. contextFiles (AGENTS.md from global + ancestor dirs)
  // 5. Skills (formatSkillsForPrompt())
  // 6. Date/CWD
}
```

### PI's Context File Loading (from `dist/core/resource-loader.js`)

```javascript
loadProjectContextFiles() {
  // 1. Load AGENTS.md from ~/.sandpiper/agent/
  // 2. Walk up from CWD looking for AGENTS.md in ancestors
  // 3. Return [{path, content}, ...]
}
```

---

## Implementation Strategy

### Phase 1: Build Our Own Base Prompt

**Module**: `packages/core/src/sandpiper-system-prompt.ts`

```typescript
export interface SandpiperBasePromptOptions {
  cwd: string;
  piCodingAgentPackage: string;  // From PI_CODING_AGENT_PACKAGE env var
  piCodingAgentVersion: string;  // From PI_CODING_AGENT_VERSION env var
}

export function buildSandpiperBasePrompt(options: SandpiperBasePromptOptions): string {
  // 1. Unified identity (~100 bytes)
  const identity = `You are a coding assistant running in Sandpiper, a framework built on top of the Pi coding agent.`;
  
  // 2. Tool definitions (~2KB) - replicate PI's logic
  const tools = getToolDefinitions();  // Use pi.getAllTools() or replicate
  
  // 3. Guidelines (~500 bytes) - distill from PI
  const guidelines = getDefaultGuidelines();
  
  // 4. Sandpiper docs (~400 bytes) - granular instructions
  const sandpiperDocs = formatSandpiperDocs(options.cwd);
  
  // 5. Pi docs (~150 bytes) - point to PI_CODING_AGENT_PACKAGE
  const piDocs = formatPiDocs(options.piCodingAgentPackage);
  
  // 6. Date/CWD (~50 bytes)
  const metadata = `Current date: ${new Date().toISOString().slice(0, 10)}\nCurrent working directory: ${options.cwd}`;
  
  return [identity, tools, guidelines, sandpiperDocs, piDocs, metadata].join('\n\n');
}
```

**Key design decisions:**

1. **Tool definitions**: We have two options:
   - **Option A**: Call `pi.getAllTools()` in `before_agent_start` and format dynamically
   - **Option B**: Replicate PI's tool snippets statically (simpler, but less dynamic)
   - **Recommendation**: Start with Option B for simplicity, can optimize to A later

2. **Pi docs paths**: Use `options.piCodingAgentPackage` to resolve:
   - `${piCodingAgentPackage}/README.md`
   - `${piCodingAgentPackage}/docs/`
   - `${piCodingAgentPackage}/examples/`

3. **Sandpiper docs**: Point to our repo:
   - `${cwd}/README.md`
   - `${cwd}/docs/extensions.md`, `${cwd}/examples/extensions/`
   - etc. (same granularity as PI's doc instructions)

---

### Phase 2: Load Context Files (AGENTS.md)

**Module**: `packages/core/src/sandpiper-context-loader.ts`

```typescript
export interface ContextFile {
  path: string;
  content: string;
}

export function loadSandpiperContextFiles(cwd: string): ContextFile[] {
  // Replicate PI's loadProjectContextFiles() logic:
  // 1. Load from ~/.sandpiper/agent/AGENTS.md
  // 2. Walk up from CWD looking for AGENTS.md
  // 3. Return array of {path, content}
}

export function formatContextFilesForPrompt(files: ContextFile[]): string {
  if (files.length === 0) return '';
  
  const sections = files.map(f => `## ${f.path}\n\n${f.content}`);
  return `# Project Context\n\nProject-specific instructions and guidelines:\n\n${sections.join('\n\n')}`;
}
```

**Note**: We already have similar logic in `packages/core/src/startup-context.ts` for PROJECT.md files. We can adapt that.

---

### Phase 3: Load Skills

**This is the trickiest part.** PI loads skills in its `resource-loader.js` before calling `buildSystemPrompt()`.

**Options:**

**Option A: Use PI's skill loading (easiest)**
- Let PI load skills normally via its resource system
- In `before_agent_start`, get skills from somewhere (event? ctx?)
- Problem: Skills are already formatted into PI's base prompt by the time we get it

**Option B: Load skills ourselves (more control)**
- In `resources_discover`, return empty skillPaths (disable PI's loading)
- Load skills ourselves using PI's `loadSkills()` function (if exported)
- Format skills ourselves using `formatSkillsForPrompt()` (if exported)
- Problem: These functions might not be exported from pi-coding-agent package

**Option C: Replicate skill loading (most work, most control)**
- Replicate PI's skill loading logic ourselves
- Read SKILL.md files, parse frontmatter, format for prompt
- Problem: Duplicating PI's logic, maintenance burden

**Recommended approach: Option A with a twist**
- Let PI load skills normally
- In `before_agent_start`, we get `event.systemPrompt` which ALREADY includes PI's formatted skills
- We build our OWN base prompt, then APPEND the skills section from PI's prompt
- Extract skills section via regex or known format

Wait, actually... let me reconsider. Looking at PI's `buildSystemPrompt()`:
- It appends skills ONLY if `hasRead` tool is available
- It uses `formatSkillsForPrompt(skills)` which we could import

**Better approach:**
- Import `formatSkillsForPrompt` from pi-coding-agent (if exported)
- Or replicate the formatting logic (it's probably simple XML-like format)
- Load skills ourselves in `resources_discover` by returning our skill paths
- Format them in `before_agent_start`

Actually, simplest approach:
- **Don't disable PI's skill loading**
- **Build our base prompt** (identity, tools, guidelines, docs, date/CWD)
- **Append context files** (AGENTS.md)
- **Let PI's base prompt include skills** - we'll extract them or just accept them as part of what we're replacing

Hmm, but that means we're still using PI's base prompt structure for skills...

**Cleanest approach:**
1. In `resources_discover`, return our skill paths (so PI knows where to find them)
2. In `before_agent_start`:
   - Build our base prompt from scratch
   - Load context files ourselves
   - Get the skills list from PI somehow (event? ctx? pi.getAllTools() includes skills?)
   - Format skills ourselves
   - Return complete prompt

Let me check if skills are available via ExtensionAPI...

Actually, looking at the docs, I don't see a `pi.getSkills()` method. But we can:
- Load skills ourselves using the same logic as PI (read SKILL.md files from skillPaths)
- Or: Accept that skills will be loaded by PI and just focus on replacing the rest

**Pragmatic approach for V1:**
- Build our base prompt (identity, tools, guidelines, docs)
- Load context files ourselves (AGENTS.md)
- **Let PI handle skills** - they're already in the base prompt we receive in `before_agent_start`
- We can extract the skills section from PI's base and re-append it, OR
- We can just accept that skills are part of "PI's base" and we're replacing everything else

For now, let's go with: **Replace everything EXCEPT skills section**

---

### Phase 4: Wire It Up

**Module**: `extensions/system/startup-hooks.ts`

```typescript
import { buildSandpiperBasePrompt } from 'sandpiper-ai-core/sandpiper-system-prompt';
import { loadSandpiperContextFiles, formatContextFilesForPrompt } from 'sandpiper-ai-core/sandpiper-context-loader';

export function registerStartupPromptHooks(pi: ExtensionAPI, ...) {
  pi.on('before_agent_start', async (event, ctx) => {
    // 1. Build our base prompt
    const basePrompt = buildSandpiperBasePrompt({
      cwd: ctx.cwd,
      piCodingAgentPackage: process.env.PI_CODING_AGENT_PACKAGE!,
      piCodingAgentVersion: process.env.PI_CODING_AGENT_VERSION!,
    });
    
    // 2. Load context files (AGENTS.md)
    const contextFiles = loadSandpiperContextFiles(ctx.cwd);
    const contextSection = formatContextFilesForPrompt(contextFiles);
    
    // 3. Extract skills from PI's base prompt (or skip for now)
    // For V1, let's just not include skills and see if that breaks anything
    // Or: extract via regex from event.systemPrompt
    
    // 4. Add our dynamic sections (standup, tasks, working copy, cold-start)
    const dynamicSections = [
      contextSection,
      formatStandupContext(...),
      formatActiveTaskContext(...),
      formatWorkingCopySummary(...),
      formatColdStartGuidance(),
    ].filter(Boolean).join('');
    
    const fullPrompt = basePrompt + dynamicSections;
    
    return {
      systemPrompt: fullPrompt,
    };
  });
}
```

---

## Testing Strategy

1. **Unit tests** for `buildSandpiperBasePrompt()`:
   - Verify identity statement is present
   - Verify tool definitions match expected format
   - Verify doc paths are correct (especially PI_CODING_AGENT_PACKAGE)
   - Verify date/CWD are injected

2. **Unit tests** for `loadSandpiperContextFiles()`:
   - Test with various directory structures
   - Test AGENTS.md discovery from global + ancestors
   - Test empty case (no AGENTS.md files)

3. **Integration test**:
   - Run `SANDPIPER_DUMP_SYSTEM_PROMPT=1 pi`
   - Compare output to expected structure
   - Verify no PI paths leak through (except in Pi docs section)

4. **Smoke test**:
   - Start a session
   - Ask "What is Sandpiper?"
   - Ask "Where can I find Pi documentation?"
   - Verify model references correct paths

---

## Open Questions

1. ~~**Skills handling**: Do we extract from PI's base, or load ourselves, or accept PI's loading?~~
   - **RESOLVED**: Extract `<available_skills>...</available_skills>` from PI's assembled prompt, write our own preamble
   - **Why**: PI already did the loading work, we just extract and reuse with our own instructions

2. **Tool definitions**: Static replication or dynamic via `pi.getAllTools()`?
   - **Decision**: Start with static replication (copy from PI's system-prompt.js), optimize later

3. **Backward compatibility**: Should we support a fallback to PI's base if our build fails?
   - **Decision**: Yes, wrap in try/catch and log errors, fall back to PI's base + our additions (current behavior)

---

## Next Steps

1. ✅ Discuss and approve this strategy
2. ⏭️ Create task for implementation
3. ⏭️ Implement `packages/core/src/sandpiper-system-prompt.ts`
4. ⏭️ Implement `packages/core/src/sandpiper-context-loader.ts`
5. ⏭️ Modify `extensions/system/startup-hooks.ts`
6. ⏭️ Test with prompt dumps
7. ⏭️ Smoke test with real session
