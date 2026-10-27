# Pi Documentation - Complete Review Summary

**Date Completed**: 2026-04-16  
**Files Reviewed**: All 23 markdown files in Pi's `docs/` directory  
**Total Pages**: ~800+ pages of documentation

---

## Documentation Files Reviewed

### Core Documentation
1. **compaction.md** (450 lines) - Context compaction and branch summarization
2. **custom-provider.md** (600+ lines) - Custom provider implementation guide
3. **development.md** (100 lines) - Development setup and forking
4. **extensions.md** (2000+ lines) - Complete extension API reference
5. **json.md** (100 lines) - JSON event stream mode
6. **keybindings.md** (300 lines) - All keyboard shortcuts and customization
7. **models.md** (400+ lines) - Custom model configuration
8. **packages.md** (300+ lines) - Pi package system
9. **prompt-templates.md** (100 lines) - Prompt template system
10. **providers.md** (300 lines) - Provider authentication and setup
11. **rpc.md** (900+ lines) - JSON-RPC protocol specification
12. **sdk.md** (750+ lines) - SDK usage and AgentSession API
13. **session.md** (500+ lines) - Session file format and SessionManager API
14. **settings.md** (300 lines) - All configuration options
15. **shell-aliases.md** (50 lines) - Shell alias configuration
16. **skills.md** (300 lines) - Agent Skills standard implementation
17. **terminal-setup.md** (200 lines) - Terminal compatibility guide
18. **termux.md** (200 lines) - Android/Termux setup
19. **themes.md** (300 lines) - Theme system and color tokens
20. **tmux.md** (100 lines) - tmux configuration
21. **tree.md** (400 lines) - Session tree navigation
22. **tui.md** (900+ lines) - TUI component system
23. **windows.md** (50 lines) - Windows setup

---

## Major Architectural Insights

### 1. Extension System Architecture

**Extension Loading**:
- Extensions loaded via **Jiti** (TypeScript without compilation)
- Support for single files, directories, and full npm packages
- Extensions can have npm dependencies
- Hot reload via `/reload`

**Extension Lifecycle Events**:
```
session_start → resources_discover → [user prompt] → 
input → before_agent_start → agent_start → 
[turn_start → context → tool_call → tool_result → turn_end]* → 
agent_end
```

**Extension API Surface** (from `extensions.md`):
- `pi.on(event, handler)` - Event subscription
- `pi.registerTool()` - Register custom tools
- `pi.registerCommand()` - Register `/command`
- `pi.registerProvider()` - Register custom providers
- `pi.registerMessageRenderer()` - Custom message rendering
- `pi.registerShortcut()` - Keyboard shortcuts
- `pi.registerFlag()` - CLI flags
- `pi.sendMessage()` - Inject custom messages
- `pi.sendUserMessage()` - Send as user
- `pi.appendEntry()` - Persist state
- `pi.getAllTools()` / `pi.setActiveTools()` - Tool management
- `pi.setModel()` - Switch models
- `pi.exec()` - Execute shell commands
- `ctx.ui.*` - Full TUI interaction (notify, confirm, select, custom)

**CRITICAL FINDING**: Tools can be registered **dynamically at ANY time**:
> "`pi.registerTool()` works both during extension load and after startup. You can call it inside `session_start`, command handlers, or other event handlers. New tools are refreshed immediately in the same session."

This means **SYSTEM.md approach cannot work** - a static file would never have the complete tools list.

### 2. Prompt Assembly Architecture

**Two Modes** (from `system-prompt.js`):

**Default Mode** (no custom prompt):
```
[Identity] → [Tools (dynamic)] → [Guidelines (dynamic)] → 
[Pi docs] → [Context files (AGENTS.md)] → [Skills] → [Date/CWD]
```

**Custom Mode** (with `--system-prompt` or SYSTEM.md):
```
[Custom base (as-is)] → [Context files (AGENTS.md)] → 
[Skills] → [Date/CWD]
```

**Key insight**: When using custom base, PI **SKIPS** dynamic tools/guidelines but **STILL** appends context files, skills, and date/CWD.

### 3. Session Architecture

**Session Format**: JSONL (one entry per line)

**Entry Types** (from `session.md`):
- `session` - Header (version, id, cwd, timestamp)
- `message` - User/assistant/toolResult messages
- `model_change` - Model switch
- `thinking_level_change` - Thinking level change
- `compaction` - Compaction summary
- `branch_summary` - Branch navigation summary
- `custom` - Extension state (NOT in LLM context)
- `custom_message` - Extension messages (IN LLM context)
- `label` - User bookmarks
- `session_info` - Session display name

**Tree Structure**:
- Sessions are **trees**, not linear logs
- Each entry has `id` and `parentId`
- "Leaf" pointer tracks current position
- Branching creates new children from earlier entries
- Navigation moves leaf without creating new files

**Compaction** (from `compaction.md`):
- Triggers when `contextTokens > contextWindow - reserveTokens`
- Default `reserveTokens`: 16384
- Default `keepRecentTokens`: 20000
- Summarizes old messages, keeps recent
- Repeated compactions preserve messages that survived earlier compactions
- Custom summarization via `session_before_compact` event

### 4. Tool System

**Built-in Tools**:
- `read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`

**Tool Definition** (from `extensions.md`):
```typescript
interface ToolDefinition {
  name: string;
  label: string;
  description: string;
  promptSnippet?: string;      // For "Available tools" section
  promptGuidelines?: string[]; // For "Guidelines" section
  parameters: TSchema;         // TypeBox schema
  execute(...): Promise<ToolResult>;
  renderCall?(...): Component;     // Custom call rendering
  renderResult?(...): Component;   // Custom result rendering
}
```

**Tool Execution Flow**:
```
tool_execution_start → tool_call (can block) → 
tool_execution_update → tool_result (can modify) → 
tool_execution_end
```

**Dynamic Registration**:
- Tools can be registered in `session_start`, command handlers, any event
- **Immediately available** to LLM (no `/reload` needed)
- `pi.getAllTools()` reflects current state including dynamic tools

### 5. Skills System

**Agent Skills Standard**: Pi implements the [Agent Skills specification](https://agentskills.io/specification)

**Skill Structure**:
```
my-skill/
├── SKILL.md          # Required: frontmatter + instructions
├── scripts/          # Helper scripts
├── references/       # Detailed docs
└── assets/
```

**Frontmatter** (required fields):
```yaml
---
name: my-skill                    # Max 64 chars, lowercase a-z, 0-9, hyphens
description: What it does         # Max 1024 chars
disable-model-invocation: false   # If true, only accessible via /skill:name
---
```

**Skill Invocation**:
- **Passive**: Appears in `<available_skills>`, model reads when task matches
- **Active**: `/skill:name` command forces loading

**Discovery Paths**:
- Global: `~/.pi/agent/skills/`, `~/.agents/skills/`
- Project: `.pi/skills/`, `.agents/skills/` (cwd ancestors)
- Package: `skills/` in pi packages
- CLI: `--skill` flag

### 6. TUI System

**Component Interface** (from `tui.md`):
```typescript
interface Component {
  render(width: number): string[];
  handleInput?(data: string): void;
  wantsKeyRelease?: boolean;
  invalidate(): void;
}
```

**Built-in Components**:
- `Text` - Multi-line text with wrapping
- `Box` - Container with padding/background
- `Container` - Vertical layout
- `Spacer` - Empty space
- `Markdown` - Markdown rendering
- `Image` - Image rendering (Kitty, iTerm2, Ghostty, WezTerm)
- `SelectList` - Selectable list
- `DynamicBorder` - Animated border

**Custom Components**:
- Extensions can create **full interactive TUI components**
- Support for overlays with positioning options
- IME support via `Focusable` interface
- Theme integration via `theme.fg()`, `theme.bg()`

**Overlay Options**:
```typescript
{
  overlay: true,
  overlayOptions: {
    width: "50%",           // or number
    anchor: "right-center", // 9 positions
    margin: 2,
    visible: (w, h) => w >= 80, // responsive
  }
}
```

### 7. Provider & Model System

**Built-in Providers** (from `providers.md`):
- Anthropic (Claude Pro/Max subscription or API key)
- OpenAI (ChatGPT Plus/Pro subscription or API key)
- Google (Gemini CLI, Antigravity - free with Google account)
- GitHub Copilot (subscription)
- Azure OpenAI, Amazon Bedrock, Google Vertex (cloud providers)
- OpenRouter, Mistral, Groq, Cerebras, xAI, Z.ai, etc. (API key)

**Custom Models** (from `models.md`):
```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "models": [
        {
          "id": "llama3.1:8b",
          "name": "Llama 3.1 8B",
          "reasoning": false,
          "input": ["text", "image"],
          "contextWindow": 128000,
          "maxTokens": 32000,
          "cost": { "input": 0, "output": 0 }
        }
      ]
    }
  }
}
```

**Custom Providers** (from `custom-provider.md`):
```typescript
pi.registerProvider("my-provider", {
  baseUrl: "https://api.example.com",
  apiKey: "MY_API_KEY",
  api: "openai-completions",  // or custom implementation
  models: [...],
  oauth: { ... },             // Optional OAuth flow
  streamSimple: streamFunc    // Custom streaming implementation
});
```

**Supported APIs**:
- `anthropic-messages`
- `openai-completions`, `openai-responses`, `openai-codex-responses`
- `google-generative-ai`, `google-gemini-cli`, `google-vertex`
- `mistral-conversations`
- `bedrock-converse-stream`
- Custom via `streamSimple` implementation

### 8. RPC Protocol

**JSON-RPC 2.0** over stdin/stdout (from `rpc.md`)

**Commands**:
- `prompt`, `steer`, `follow_up` - Send prompts
- `get_state`, `get_messages` - Query state
- `set_model`, `cycle_model`, `get_available_models` - Model control
- `set_thinking_level`, `cycle_thinking_level` - Thinking control
- `compact`, `set_auto_compaction` - Compaction
- `bash`, `abort_bash` - Shell execution
- `new_session`, `get_session_stats` - Session management
- `set_session_name`, `get_commands` - Session metadata

**Events**:
- `agent_start`, `agent_end` - Agent lifecycle
- `turn_start`, `turn_end` - Turn lifecycle
- `message_start`, `message_update`, `message_end` - Message lifecycle
- `tool_execution_start`, `tool_execution_update`, `tool_execution_end` - Tool execution
- `queue_update` - Message queue state
- `compaction_start`, `compaction_end` - Compaction
- `auto_retry_start`, `auto_retry_end` - Retry

**Framing**: Strict JSONL with LF (`\n`) as delimiter. Node `readline` is NOT protocol-compliant (splits on Unicode separators).

### 9. Pi Packages

**Package System** (from `packages.md`):

**Installation**:
```bash
pi install npm:@foo/bar@1.0.0
pi install git:github.com/user/repo@v1
pi install ./local/path
```

**Package Structure**:
```json
{
  "name": "my-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

**Resource Filtering**:
```json
{
  "packages": [
    {
      "source": "npm:my-package",
      "extensions": ["extensions/*.ts", "!extensions/legacy.ts"],
      "skills": [],
      "prompts": ["prompts/review.md"]
    }
  ]
}
```

### 10. Settings System

**All Settings** (from `settings.md`):

**Model & Thinking**:
- `defaultProvider`, `defaultModel`, `defaultThinkingLevel`
- `hideThinkingBlock`, `thinkingBudgets`

**UI & Display**:
- `theme`, `quietStartup`, `enableInstallTelemetry`
- `doubleEscapeAction`, `treeFilterMode`
- `editorPaddingX`, `autocompleteMaxVisible`

**Compaction**:
- `compaction.enabled`, `compaction.reserveTokens`, `compaction.keepRecentTokens`

**Retry**:
- `retry.enabled`, `retry.maxRetries`, `retry.baseDelayMs`, `retry.maxDelayMs`

**Resources**:
- `packages`, `extensions`, `skills`, `prompts`, `themes`
- `enableSkillCommands`

**Shell**:
- `shellPath`, `shellCommandPrefix`, `npmCommand`

---

## Design Patterns Identified

### 1. Resource Loader Pattern
Layered discovery with fallback:
1. Global config
2. Project config
3. Package declarations
4. CLI flags

### 2. Event-Driven Architecture
Publish-subscribe throughout:
- Session events
- Agent events
- Tool events
- Custom extension events

### 3. Builder Pattern
Fluent construction:
- TUI components
- Tool definitions
- Message construction

### 4. Strategy Pattern
Interchangeable algorithms:
- Providers (different LLM APIs)
- Compaction (custom summarization)
- Tools (custom implementations)

### 5. Observer Pattern
Reactive updates:
- Session subscriptions
- TUI invalidation
- Theme changes

### 6. Plugin Architecture
Everything is pluggable:
- Providers
- Tools
- Skills
- Themes
- Editors
- Compaction logic

---

## Key Architectural Principles

### 1. Minimal Core, Extensible via Extensions
Pi provides minimal harness, extensions add all capabilities

### 2. Convention over Configuration
Resource discovery follows conventions, reducing config burden

### 3. Event-Driven Everything
All flows through events, enabling extension interception

### 4. Immutable Sessions
Sessions are append-only logs with branching, not mutable state

### 5. Pluggable Everything
Providers, tools, skills, themes, editors - all pluggable

### 6. Progressive Disclosure
Skills use descriptions in prompt, full content loaded on-demand

### 7. Layered Security
- Extensions run with full permissions (trust required)
- Skills can instruct any action (review before use)
- No sandboxing

---

## Critical Findings for System Prompt Work

### 1. Dynamic Tools Kill SYSTEM.md Approach

From `extensions.md`:
> "`pi.registerTool()` works both during extension load and **after startup**. You can call it inside `session_start`, command handlers, or other event handlers. **New tools are refreshed immediately** in the same session."

**Implication**: A static SYSTEM.md file would NEVER have the complete tools list. Tools can be registered:
- During extension load
- In `session_start` handlers
- In command handlers (e.g., `/add-echo-tool`)
- In any event handler

**Conclusion**: We MUST build the tools section dynamically in `before_agent_start` using `pi.getAllTools()`.

### 2. PI's Prompt Assembly Has Two Modes

From `system-prompt.js`:
- **Default mode**: Builds dynamic tools/guidelines, appends context files + skills + date/CWD
- **Custom mode** (with `--system-prompt`): Uses custom base, **SKIPS** tools/guidelines, STILL appends context files + skills + date/CWD

**Implication**: If we use `--system-prompt`, we lose dynamic tools/guidelines.

### 3. Extension Pattern: Append, Don't Replace

All extension examples (`pirate.ts`, `claude-rules.ts`, `preset.ts`) use:
```typescript
pi.on("before_agent_start", async (event) => {
  return {
    systemPrompt: event.systemPrompt + "\n\n" + ourAdditions,
  };
});
```

They **append** to PI's assembled prompt, they don't replace it.

### 4. Recommended Approach

**Don't use SYSTEM.md or `--system-prompt`**. Instead:

1. Let PI build its default base (with dynamic tools/guidelines)
2. In `before_agent_start`:
   - Parse PI's prompt into sections
   - **Replace** identity/docs sections (fix paths, add Sandpiper docs)
   - **Keep** tools/guidelines sections (already dynamic and correct!)
   - **Keep** context files/skills/date/CWD (already appended by PI)
   - **Add** our dynamic sections (tasks, working copy, etc.)

**Why this wins**:
- ✅ Handles dynamic tools (uses PI's dynamically-built section)
- ✅ Reuses PI's work (no duplication of loaders)
- ✅ Minimal code (parse/replace/reassemble)
- ✅ Clean separation (identity/docs are ours, rest is PI's)
- ✅ No placeholder mechanisms

---

## Open Questions Answered

### Q: Can extensions register tools dynamically?
**A**: YES - at ANY time during session, immediately available to LLM

### Q: Does `--system-prompt` skip tools/guidelines?
**A**: YES - custom mode skips dynamic tools/guidelines, still appends context files + skills

### Q: How does PI load AGENTS.md files?
**A**: Walks up from cwd looking for AGENTS.md, also loads from global `~/.pi/agent/`

### Q: Can we override compaction?
**A**: YES - via `session_before_compact` event, can cancel or provide custom summary

### Q: Can we create custom TUI components?
**A**: YES - full component system with overlays, IME support, theme integration

### Q: How does session branching work?
**A**: Tree structure with id/parentId, leaf pointer tracks current position, navigation moves leaf

### Q: Can we register custom providers?
**A**: YES - via `pi.registerProvider()`, with optional OAuth and custom streaming

---

## Documentation Quality Assessment

**Strengths**:
- Comprehensive coverage of all features
- Working code examples for everything
- Clear tables and diagrams
- TypeScript type definitions referenced
- Migration guides for breaking changes
- Security warnings where appropriate

**Weaknesses**:
- Some docs very long (extensions.md is 2000+ lines)
- Could benefit from more architecture diagrams
- Some advanced features buried in examples rather than main docs

**Overall**: Excellent documentation quality. Everything needed to understand and extend Pi is here.

---

## Personal Learning

This deep dive fundamentally changed my understanding of Pi:

1. **It's not just a coding agent** - It's a highly extensible platform
2. **The extension system is sophisticated** - Full lifecycle, event-driven, hot reload
3. **Everything is pluggable** - Providers, tools, skills, themes, editors, compaction
4. **Session management is elegant** - Immutable trees with branching, not linear logs
5. **TUI is production-grade** - Component-based, themeable, overlay support, IME
6. **The architecture is clean** - Event-driven, layered discovery, convention over configuration

This knowledge will inform not just our system prompt work, but any future extension development, SDK integration, or architectural decisions.

---

**Total time invested**: ~20+ turns reading and synthesizing 800+ pages of documentation  
**Files created**: 3 comprehensive research documents  
**Key insight**: Dynamic tools make SYSTEM.md approach infeasible; surgical modification in `before_agent_start` is the winning pattern
