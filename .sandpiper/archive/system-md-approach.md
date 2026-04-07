# SYSTEM.md Approach - Prompt Slimming

**Core Idea**: Vendor a `SYSTEM.md` file in our package that PI will automatically load, giving us control over the base prompt while letting PI handle AGENTS.md and skills assembly.

---

## How It Works

### 1. Create Our SYSTEM.md

Location: `packages/core/assets/SYSTEM.md` (or similar)

Content:
```markdown
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
- Main documentation: ${PI_CODING_AGENT_PACKAGE}/README.md
- Extension API: ${PI_CODING_AGENT_PACKAGE}/docs/extensions.md
- Skills API: ${PI_CODING_AGENT_PACKAGE}/docs/skills.md
- TUI API: ${PI_CODING_AGENT_PACKAGE}/docs/tui.md
- Always read Pi docs completely and follow cross-references before implementing.
```

Wait - we can't use `${PI_CODING_AGENT_PACKAGE}` in a static file. We'd need to:
- A) Generate the file at build time
- B) Generate it at runtime before PI loads
- C) Use a placeholder and have PI's prompt builder replace it (but PI doesn't do template replacement)

**Option B is viable**: In `pi_wrapper.ts`, generate the SYSTEM.md file dynamically before calling `main()`.

---

## Implementation

### Step 1: Create SYSTEM.md Template

`packages/core/assets/SYSTEM.md.template`:
```markdown
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
- Main documentation: {{PI_CODING_AGENT_PACKAGE}}/README.md
- Extension API: {{PI_CODING_AGENT_PACKAGE}}/docs/extensions.md
- Skills API: {{PI_CODING_AGENT_PACKAGE}}/docs/skills.md
- TUI API: {{PI_CODING_AGENT_PACKAGE}}/docs/tui.md
- Always read Pi docs completely and follow cross-references before implementing.
```

### Step 2: Generate SYSTEM.md in pi_wrapper.ts

```typescript
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

// In pi_wrapper.ts, before calling main():

const systemPromptPath = join(dirname(scriptDir), 'core', 'assets', 'SYSTEM.md');
const templatePath = systemPromptPath + '.template';

if (existsSync(templatePath)) {
  const template = readFileSync(templatePath, 'utf-8');
  const content = template.replace(
    /{{PI_CODING_AGENT_PACKAGE}}/g,
    systemPiPackageDir
  );
  mkdirSync(dirname(systemPromptPath), { recursive: true });
  writeFileSync(systemPromptPath, content, 'utf-8');
  
  // Prepend --system-prompt flag to piArgs
  piArgs.unshift('--system-prompt', systemPromptPath);
}

// Then call main() as usual
(await import(join(systemPiDistDir, 'main.js'))).main(piArgs);
```

### Step 3: PI Loads It Automatically

When PI's `DefaultResourceLoader.reload()` runs:
```javascript
const baseSystemPrompt = resolvePromptInput(
  this.systemPromptSource ?? this.discoverSystemPromptFile(),
  "system prompt"
);
```

Since we passed `--system-prompt`, `this.systemPromptSource` is set, and PI uses our file instead of looking for SYSTEM.md in canonical locations.

### Step 4: We Still Need before_agent_start for Dynamic Content

Our SYSTEM.md only contains the **static base**. We still need the extension to add:
- Standup context (cold-start only)
- Active task context
- Working copy summary
- Cold-start guidance

So `extensions/system/startup-hooks.ts` still has a `before_agent_start` handler, but it's **appending** to PI's assembled prompt instead of **replacing** it:

```typescript
pi.on('before_agent_start', async (event, ctx) => {
  // event.systemPrompt already contains:
  // - Our SYSTEM.md base (with Sandpiper identity + docs)
  // - AGENTS.md files (loaded by PI)
  // - Skills (loaded and formatted by PI)
  // - Date/CWD (added by PI)
  
  // We just add our dynamic sections:
  const dynamicSections = [
    formatStandupContext(...),
    formatActiveTaskContext(...),
    formatWorkingCopySummary(...),
    formatColdStartGuidance(),
  ].filter(Boolean).join('');
  
  return {
    systemPrompt: event.systemPrompt + dynamicSections,
  };
});
```

---

## Benefits

✅ **PI does the heavy lifting**:
- Discovers and loads AGENTS.md files (global + ancestors)
- Loads and formats skills
- Appends date/CWD
- We just provide the base and add dynamic sections

✅ **No duplication**:
- We don't replicate PI's context file loading
- We don't replicate PI's skill loading
- We don't extract skills from PI's assembled prompt

✅ **Clean separation**:
- Static base: SYSTEM.md file (versioned in our package)
- Dynamic sections: Extension code (runtime assembly)

✅ **Correct paths**:
- Pi docs point to actual `PI_CODING_AGENT_PACKAGE` location
- Sandpiper docs point to our repo (via template replacement)

---

## Trade-offs

⚠️ **File generation at runtime**:
- Need to generate SYSTEM.md before PI starts
- Need to handle template replacement
- File I/O overhead (negligible)

⚠️ **Still need before_agent_start**:
- Can't avoid this because of dynamic content
- But it's simpler - just appending, not full assembly

⚠️ **Tight coupling to PI's prompt structure**:
- We depend on PI appending AGENTS.md + skills after our base
- If PI changes the order, our dynamic sections might end up in the wrong place
- Mitigation: Our dynamic sections are clearly marked with headers, so order matters less

---

## Alternative: Skip SYSTEM.md, Just Use --system-prompt with Generated Content

Instead of a template file, we could generate the entire SYSTEM.md content in memory and pass it as `--system-prompt <text>`:

```typescript
const systemPromptContent = `
You are a coding assistant running in Sandpiper...

**Pi Framework Documentation**:
- Main documentation: ${systemPiPackageDir}/README.md
...
`;

piArgs.unshift('--system-prompt', systemPromptContent);
```

**Pros**:
- No file I/O
- No template file to maintain
- Simpler code

**Cons**:
- Shell escaping issues if the content has special characters
- Very long CLI arguments (though probably fine)
- Harder to debug (can't inspect the file)

**My take**: The file-based approach is cleaner and easier to debug.

---

## Next Steps

If we proceed with this approach:

1. Create `packages/core/assets/SYSTEM.md.template`
2. Modify `packages/cli/pi_wrapper.ts` to:
   - Generate SYSTEM.md from template
   - Prepend `--system-prompt` flag to piArgs
3. Simplify `extensions/system/startup-hooks.ts` to just append dynamic sections
4. Test with `SANDPIPER_DUMP_SYSTEM_PROMPT=1`
5. Verify AGENTS.md and skills are still included

---

## Open Questions

1. **Should SYSTEM.md include tool definitions and guidelines?**
   - PI's default base prompt has these
   - If we skip them, PI won't add them (our SYSTEM.md replaces the base)
   - **Answer**: Yes, we should include them - copy from PI's system-prompt.js

2. **What about the "Available tools" section?**
   - PI builds this dynamically based on which tools are enabled
   - If we hardcode it in SYSTEM.md, it might not match the actual tools
   - **Answer**: This is a problem. PI's base prompt has dynamic tool snippets. We can't replicate this in a static file.

3. **Does PI's base prompt have other dynamic content?**
   - Guidelines are partially dynamic (based on available tools)
   - Date/CWD are dynamic (but PI adds these at the end, after our base)
   - **Answer**: The tool-dependent guidelines are a problem.

---

## Revised Understanding

**CRITICAL ISSUE**: PI's base prompt is NOT static. It has:
- Dynamic tool snippets (based on enabled tools)
- Dynamic guidelines (based on available tools)

If we use `--system-prompt` with a static SYSTEM.md, we lose this dynamism.

**Solutions**:
- A) Include ALL possible tools in SYSTEM.md (even if not enabled) - confusing for the model
- B) Generate SYSTEM.md dynamically with the correct tools for the current session - complex
- C) Accept that we need to build the base prompt dynamically in `before_agent_start` anyway

**Option C** brings us back to our original plan: build everything in `before_agent_start`, extract skills from PI's assembled prompt.

---

## Conclusion

The SYSTEM.md approach **doesn't actually save us from duplicating work** because:
- PI's base prompt has dynamic content (tools, guidelines) that we'd need to replicate
- We'd still need to generate SYSTEM.md dynamically, which is basically the same as building the prompt in code

**The extraction approach** (build base in `before_agent_start`, extract `<available_skills>` from PI's assembled prompt) is actually simpler and more flexible.

**Recommendation**: Stick with the original extraction approach. The SYSTEM.md mechanism is useful for users who want a custom static base, but for our use case (dynamic base + dynamic sections), building it all in code is cleaner.
