# Prompt Slimming Session Notes

**Date**: 2026-04-16  
**Session Type**: Interrupt task - System prompt reduction  
**Mode**: Socratic investigation → Planning → Implementation

---

## Current State

| File | Size | Description |
|------|------|-------------|
| `FULL_PROMPT_DUMP.md` | 43,454 bytes | Complete system prompt (PI base + sandpiper additions) |
| `BASE_PROMPT_DUMP.md` | 34,009 bytes | PI framework base prompt |
| **Difference** | **~9.4KB** | Sandpiper-specific injections |

---

## Option 1: Replace PI Base Prompt Entirely

### Investigation Status: READY FOR IMPLEMENTATION

**User's clarified direction** (2026-04-16):
- **DO replace PI's base prompt entirely** - NOT just fix our additions
- Write our own base prompt with unified identity preamble
- Replicate PI's injection machinery ourselves (AGENTS.md, skills, etc.)
- Examine pi-coding-agent package to understand how PI builds its base prompt
- **Goal**: Single coherent prompt architecture, not layering "our stuff" on top of "their stuff"

**Core Question**: What would it take to write our own base prompt, and what would we gain/lose?

#### Architecture Discovery - COMPLETE

**PI's prompt assembly** (`dist/core/system-prompt.js`):

```javascript
buildSystemPrompt(options) {
  // 1. Build base prompt with tool defs, guidelines, Pi docs
  // 2. Append contextFiles (AGENTS.md) under "# Project Context"
  // 3. Append skills via formatSkillsForPrompt()
  // 4. Add date/CWD at end
}
```

**Context file loading** (`dist/core/resource-loader.js`):
- `loadProjectContextFiles()`: Loads AGENTS.md from:
  - Global: `~/.sandpiper/agent/AGENTS.md`
  - Ancestors: Walks up from CWD looking for AGENTS.md
- Returns `[{path, content}, ...]`

**Path resolution** (`dist/core/config.js`):
- `getPackageDir()`: Checks `PI_PACKAGE_DIR` env var, then walks up to find package.json
- `getReadmePath()`, `getDocsPath()`, `getExamplesPath()`: Resolve relative to package dir

**Our replication target**:
1. Write our own `buildSandpiperSystemPrompt()` (~3-4KB base)
2. Replicate `loadProjectContextFiles()` logic (already have similar in `startup-context.ts`)
3. Replicate skills formatting (already have in system extension)
4. Inject date/CWD ourselves (easy)
5. **Key win**: Fix Pi's wrong doc paths by using `PI_CODING_AGENT_PACKAGE` env var

#### Questions Explored

**Q1: What is PI actually responsible for vs. what are we responsible for?**

**Discovery**: PI's base prompt (~34KB) = PI's core (~8KB tools/guidelines) + Our AGENTS.md files (~25KB) + Skills (~4KB)

**Q2: What's wrong with Pi's self-introspection paths?**

**Discovery from `pi_wrapper.ts`**:
- `PI_CODING_AGENT_PACKAGE` = actual pi-coding-agent package dir (e.g., `~/.local/share/mise/installs/.../pi-coding-agent/0.67.3/node_modules/@mariozechner/pi-coding-agent`)
- `PI_CODING_AGENT_VERSION` = pi version (e.g., `0.67.3`)
- These are injected into pi's environment BEFORE pi starts

**Current problem**: Pi's base prompt says:
```
Pi documentation (read only when the user asks about pi itself...):
- Main documentation: /Users/doug.stephen/git/sandpiper-ai/README.md
- Additional docs: /Users/doug.stephen/git/sandpiper-ai/docs
```

**This is WRONG** - it points to OUR repo, not the actual pi package. The model is being told to read OUR README when it wants to learn about Pi's API.

**What SHOULD happen**:
- Pi docs should point to: `${PI_CODING_AGENT_PACKAGE}/README.md`, `${PI_CODING_AGENT_PACKAGE}/docs/`
- Sandpiper docs should point to: `${cwd}/README.md`, `${cwd}/docs/`
- Both should be available for self-introspection

**Q3: How does PI know to inject our AGENTS.md files?**

**Discovery**:
- PI has built-in logic to inject `AGENTS.md` files from:
  - `~/.sandpiper/agent/AGENTS.md` (user global)
  - `<package-root>/AGENTS.md` (our sandpiper-ai repo root)
  - `<cwd>/AGENTS.md` (project-local, if exists)
- This is HARDCODED in PI - not configurable via pi.json
- PI also injects skills from the `skills` array in package.json's `pi` config

**Q4: What's the actual structure we're working with?**

**Package config** (`dist/package.json`):
```json
{
  "piConfig": { "name": "sandpiper", "configDir": ".sandpiper", "bin": "sandpiper" },
  "pi": {
    "extensions": ["./extensions/system.ts", ...],
    "skills": ["./skills/sandpiper", "./skills/third-party"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

**User settings** (`~/.sandpiper/agent/settings.json`):
```json
{
  "packages": ["../../git/sandpiper-ai/dist"]
}
```

**So the injection chain is**:
1. User settings point to our dist package
2. PI loads our package's `pi` config
3. PI injects skills from our `skills/` directory
4. PI injects AGENTS.md from our repo root + global + project-local
5. PI builds base prompt with tool defs + guidelines + injected content
6. Our system extension modifies the prompt in `before_agent_start`

**User's position** (2026-04-16):
- Sandpiper is a shell around Pi, not a fork
- Pi's base prompt has excellent self-introspection instructions that enabled Sandpiper to be built
- Current "identity override" pattern is awkward: "you are pi, actually you're sandpiper"
- **Proposal**: Write our own unified base prompt:
  - "You are a coding assistant running in Sandpiper" (not an override)
  - Reference Pi docs/APIs as part of our prompt, not as a superseding layer
  - Preserve the "good stuff" from Pi's base in a more compact form
- **CRITICAL DISCOVERY**: Pi's base prompt has WRONG paths for self-introspection (points to our repo, not actual pi-coding-agent package)
- **Self-introspection should point to BOTH**:
  - Our docs (sandpiper-ai repo)
  - Pi's docs (via PI_CODING_AGENT_PACKAGE env var)
- Keep AGENTS.md injection (it's an agentic coding convention)
- Keep tool/skill definitions (convention; TOON could provide ~10% savings)
- **Target**: Architectural cleanup, <10K tokens soft goal

**My analysis**:
- ✅ Agree: The identity override block is a design smell - tells model to "supersede" its own identity
- ✅ Agree: We're paying token cost for duplication/overlap
- ✅ Agree: Keep AGENTS.md injection (it's an agentic coding convention)
- ✅ Agree: Keep tool/skill definitions (convention; TOON could provide ~10% savings later)
- ✅ Agree: Self-introspection should point to BOTH our docs AND Pi's docs (via PI_CODING_AGENT_PACKAGE)
- ⚠️ **KEY INSIGHT**: Pi's base prompt has WRONG paths - points to our repo instead of actual pi-coding-agent package location
- ✅ **CRITICAL**: The GRANULARITY of Pi's doc instructions is ESSENTIAL ballast, not bloat
  - "Read X when you need to do Y" patterns are functional, not decorative
  - Vague doc references don't work - model needs specific triggering conditions
  - This granularity is what makes self-introspection ACTUALLY FUNCTIONAL
- **Reframed goal**: Remove DUPLICATION and fix ARCHITECTURE, not minimize bytes at all costs
- **Next step**: Analyze WHAT makes Pi's doc instructions work, replicate that pattern for Sandpiper docs

---

## Option 2: Strip Down What We Add

### Investigation Status: IN PROGRESS

**User's guidance** (2026-04-16):
- **AGENTS.md files**: Out of scope for this effort - user's responsibility to curate
- **Skills**: Out of scope for this effort - user's responsibility to curate  
- **Identity block**: Agreed on reification - unified identity with granular instructions
- **Dynamic content** (standup, working copy, task context): This is where the big gains are, but discuss AFTER handling base/static content

**Focus for this session**: Base/static content only (identity block + doc instructions)

---

## Decisions Made

1. **Identity block**: Replace "schizophrenic" override pattern with unified identity statement
2. **Pi docs paths**: Fix to point to `${PI_CODING_AGENT_PACKAGE}` (actual pi installation)
3. **Sandpiper docs**: Add parallel doc instructions with same granularity as Pi's
4. **Behavioral instructions**: Preserve the functional granularity ("read when...", "follow cross-references", etc.)
5. **Out of scope**: AGENTS.md slimming, skills optimization, dynamic content (defer to next discussion)
6. **Skills handling**: Use PI's exported `loadSkills()` and `formatSkillsForPrompt()` functions
7. **Tool definitions**: Start with static replication of PI's tool snippets
8. **Fallback**: Wrap in try/catch, fall back to current behavior on error

---

## Action Items / Task Breakdown

*(To be filled)*

---

## Open Questions

1. What exact wording for the unified identity statement?
2. What's the complete list of Sandpiper docs that need granular instructions?
3. How do we handle the path injection for Pi docs (PI_CODING_AGENT_PACKAGE is an env var)?
