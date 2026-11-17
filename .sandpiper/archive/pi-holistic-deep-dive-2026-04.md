# Pi Coding Agent - Holistic Deep Dive

**Date Started**: 2026-04-16  
**Purpose**: Comprehensive exploration and understanding of Pi's architecture, design patterns, and capabilities  
**Scope**: All documentation, source code, examples, and extension patterns

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Core Systems](#2-core-systems)
3. [Extension System](#3-extension-system)
4. [TUI System](#4-tui-system)
5. [Session Management](#5-session-management)
6. [Tool System](#6-tool-system)
7. [Skills System](#7-skills-system)
8. [Provider & Model System](#8-provider--model-system)
9. [Compaction System](#9-compaction-system)
10. [RPC & SDK](#10-rpc--sdk)
11. [Design Patterns](#11-design-patterns)
12. [Key Insights](#12-key-insights)
13. [Questions & Explorations](#13-questions--explorations)

---

## 1. Architecture Overview

### Package Structure

```
@mariozechner/pi-coding-agent/
├── dist/              # Compiled JavaScript (TypeScript source)
├── docs/              # User documentation (26 markdown files)
├── examples/          # Working examples
│   ├── extensions/    # 70+ extension examples
│   └── sdk/          # SDK integration examples
├── package.json       # Package metadata + pi config
└── README.md          # Main documentation
```

### Pi Package Configuration

From `package.json`:
```json
{
  "piConfig": {
    "name": "pi",
    "configDir": ".pi",
    "bin": "pi"
  },
  "pi": {
    "extensions": ["./extensions/system.ts", ...],
    "skills": ["./skills/sandpiper", ...],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

**Key insight**: Pi packages declare their resources (extensions, skills, prompts, themes) in `package.json`. This is how Sandpiper registers its resources.

### Runtime Architecture

**Four modes of operation**:
1. **Interactive** - Full TUI with keyboard input, streaming output
2. **Print** (`-p`) - Non-interactive, process prompt and exit
3. **JSON** - Machine-readable JSON output
4. **RPC** - JSON-RPC protocol for process integration

**Source**: `README.md`, `docs/rpc.md`

---

## 2. Core Systems

### 2.1 Resource Loading

**DefaultResourceLoader** (`dist/core/resource-loader.js`):

**Responsibilities**:
- Load extensions from configured paths
- Load skills from configured paths
- Load prompt templates
- Load themes
- Load context files (AGENTS.md)
- Load SYSTEM.md (custom base prompt)

**Discovery order**:
1. Global (`~/.pi/agent/`)
2. Project-local (`.pi/` in cwd and ancestors)
3. Package-declared (from `package.json`)
4. CLI flags (`-e`, `--skill`, etc.)

**Key methods**:
- `loadProjectContextFiles()` - Walks up from cwd looking for AGENTS.md
- `loadSkills()` - Loads from all configured paths
- `reload()` - Full reload of all resources

**Design pattern**: **Resource Loader** pattern with layered discovery

### 2.2 Event Bus

**EventBus** (`dist/core/event-bus.js`):

**Purpose**: Decoupled event communication between components

**Event types**:
- Session events (`session_start`, `session_shutdown`)
- Agent events (`agent_start`, `agent_end`)
- Tool events (`tool_call`, `tool_result`)
- Turn events (`turn_start`, `turn_end`)
- Message events (`message_start`, `message_update`, `message_end`)

**Pattern**: **Publish-Subscribe** with typed events

### 2.3 Session Manager

**SessionManager** (`dist/core/session-manager.js`):

**Responsibilities**:
- Session file storage and retrieval
- Session branching (fork, resume)
- Session tree navigation
- Entry management (messages, tool results, compactions)

**Session file format**: JSONL (one entry per line)

**Entry types**:
- `user` - User messages
- `assistant` - Assistant messages (with tool calls)
- `toolResult` - Tool execution results
- `compaction` - Compaction summaries
- `custom` - Extension state (via `pi.appendEntry()`)

**Key insight**: Sessions are **immutable append-only logs** with branching support. Each entry has a unique ID, enabling tree navigation.

---

## 3. Extension System

### 3.1 Extension Lifecycle

**Loading sequence**:
```
pi starts
  ↓
session_start { reason: "startup" }
  ↓
resources_discover { reason: "startup" }
  ↓
[User sends prompt]
  ↓
input (can intercept/transform)
  ↓
before_agent_start (can modify system prompt)
  ↓
agent_start
  ↓
[Turn loop: turn_start → context → tool_call → tool_result → turn_end]
  ↓
agent_end
```

**Source**: `docs/extensions.md` lifecycle diagram

### 3.2 Extension API Surface

**ExtensionAPI** methods:

**Event subscription**:
- `pi.on(event, handler)` - Subscribe to events

**Tool registration**:
- `pi.registerTool(definition)` - Register custom tool
- `pi.getAllTools()` - Get all available tools
- `pi.getActiveTools()` - Get currently enabled tools
- `pi.setActiveTools(names)` - Enable/disable tools

**Command registration**:
- `pi.registerCommand(name, options)` - Register `/command`
- `pi.getCommands()` - Get available commands

**Message injection**:
- `pi.sendMessage(message, options)` - Inject custom message
- `pi.sendUserMessage(content, options)` - Send as user
- `pi.appendEntry(type, data)` - Persist state (not in LLM context)

**Session control**:
- `pi.setModel(model)` - Switch model
- `pi.setThinkingLevel(level)` - Set thinking level
- `pi.setSessionName(name)` - Set display name
- `pi.setLabel(entryId, label)` - Bookmark entry

**UI interaction**:
- `ctx.ui.notify()` - Toast notification
- `ctx.ui.confirm()` - Confirmation dialog
- `ctx.ui.select()` - Selection list
- `ctx.ui.input()` - Text input
- `ctx.ui.custom()` - Custom TUI component

**State management**:
- `pi.getFlag()` - Get CLI flag value
- `pi.exec()` - Execute shell command

**Source**: `docs/extensions.md` "ExtensionAPI Methods"

### 3.3 Extension Patterns

**Pattern 1: System Prompt Modification**
```typescript
pi.on("before_agent_start", async (event) => {
  return {
    systemPrompt: event.systemPrompt + "\n\n" + additions,
  };
});
```
**Examples**: `pirate.ts`, `claude-rules.ts`, `preset.ts`

**Pattern 2: Tool Interception**
```typescript
pi.on("tool_call", async (event, ctx) => {
  if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
    const ok = await ctx.ui.confirm("Dangerous!", "Allow?");
    if (!ok) return { block: true, reason: "Blocked" };
  }
});
```
**Examples**: `permission-gate.ts`, `protected-paths.ts`

**Pattern 3: Dynamic Tool Registration**
```typescript
pi.on("session_start", async (_event, ctx) => {
  pi.registerTool({...});  // Register at session start
});

pi.registerCommand("add-tool", {
  handler: async (args, ctx) => {
    pi.registerTool({...});  // Register on command
  }
});
```
**Example**: `dynamic-tools.ts`

**Pattern 4: Custom Rendering**
```typescript
pi.registerTool({
  name: "my_tool",
  // ...
  renderCall(args, theme, context) {
    return new Text(`Calling ${args.name}`, 0, 0);
  },
  renderResult(result, options, theme, context) {
    return new Text(`Result: ${result.content}`, 0, 0);
  }
});
```
**Examples**: `minimal-mode.ts`, `built-in-tool-renderer.ts`

**Pattern 5: Resource Contribution**
```typescript
pi.on("resources_discover", async (event, _ctx) => {
  return {
    skillPaths: ["/path/to/skills"],
    promptPaths: ["/path/to/prompts"],
  };
});
```
**Example**: `dynamic-resources/`

### 3.4 Extension Loading Mechanics

**Loading via Jiti**: Extensions are loaded via [jiti](https://github.com/unjs/jiti), which enables:
- TypeScript without compilation
- ESM/CJS interop
- Hot reload support

**Extension paths**:
- Single file: `~/.pi/agent/extensions/my-extension.ts`
- Directory: `~/.pi/agent/extensions/my-extension/index.ts`
- Package: `~/.pi/agent/extensions/my-extension/` with `package.json`

**Package-based extensions**:
```json
{
  "name": "my-extension",
  "dependencies": {...},
  "pi": {
    "extensions": ["./src/index.ts"]
  }
}
```

**Key insight**: Extensions can have npm dependencies! This enables complex extensions with full Node.js ecosystem access.

---

## 4. TUI System

### 4.1 TUI Architecture

**Package**: `@mariozechner/pi-tui`

**Core components**:
- `Container` - Layout container
- `Text` - Text rendering
- `Box` - Bordered box
- `Spacer` - Flexible spacing
- `SelectList` - Selectable list
- `DynamicBorder` - Animated border

**Rendering model**:
- Components render to **cell grids** (width × height)
- Components can **invalidate** themselves for redraw
- **Diff-based** rendering (only changed cells redraw)

**Source**: `docs/tui.md`

### 4.2 Custom Components

**Component interface**:
```typescript
interface Component {
  render(width: number): RenderResult;
  invalidate(): void;
  handleInput?(data: string): void;
}
```

**Example from `overlay-test.ts`**:
```typescript
const component = await ctx.ui.custom((tui, theme, kb, done) => {
  const container = new Container();
  container.addChild(new DynamicBorder(str => theme.fg("accent", str)));
  container.addChild(new Text("Hello!", 0, 0));
  
  return {
    render(width: number) {
      return container.render(width);
    },
    invalidate() {
      container.invalidate();
    },
    handleInput(data: string) {
      if (data === "q") done(null);
    }
  };
});
```

**Key insight**: Extensions can create **full interactive TUI components** with keyboard input, not just simple dialogs.

### 4.3 Overlay Components

**Overlay mode**: Components can render as overlays on top of the main TUI

**Options**:
- `position: "center" | "top" | "bottom"`
- `width: number | "auto"`
- `height: number | "auto"`
- `border: boolean`
- `dimBackground: boolean`

**Example**: Modal dialogs, wizards, games

**Source**: `docs/tui.md` "Custom UI Components"

### 4.4 Editor Component

**Custom editor**: Extensions can replace the default editor component

**Interface**:
```typescript
interface CustomEditor {
  setValue(value: string): void;
  getValue(): string;
  setCursor(line: number, column: number): void;
  getCursor(): { line: number; column: number };
  render(width: number, height: number): RenderResult;
  handleInput(data: string): void;
  invalidate(): void;
}
```

**Example**: `modal-editor.ts` implements Vim-style modal editing

**Key insight**: The editor is **pluggable** - extensions can provide completely different editing experiences.

---

## 5. Session Management

### 5.1 Session Structure

**Session file**: JSONL format

**Entry structure**:
```json
{
  "id": "uuid",
  "type": "user|assistant|toolResult|compaction|custom",
  "timestamp": 1234567890,
  "content": [...],
  ...
}
```

**Branching model**:
- Sessions are **trees**, not linear logs
- Branching creates new session files
- Entries reference parent/child relationships
- Navigation moves between branches

**Source**: `docs/session.md`, `docs/tree.md`

### 5.2 Session Replacement APIs

**AgentSessionRuntime** (`docs/sdk.md`):

**Methods**:
- `newSession()` - Start fresh session
- `switchSession(path)` - Switch to existing session
- `fork(entryId)` - Fork from specific entry
- `importFromJsonl(path)` - Import external session

**Key behavior**:
- Rebuilds **all cwd-bound state** on session switch
- Extensions must **re-bind** to new session
- Event subscriptions are **per-session** (must re-subscribe)

**Source**: `docs/sdk.md` "createAgentSessionRuntime()"

### 5.3 Compaction

**Purpose**: Reduce context length by summarizing conversation history

**Triggers**:
- Manual: `/compact` command
- Automatic: When context exceeds model's limit
- Extension: `ctx.compact()`

**Compaction entry**:
```json
{
  "type": "compaction",
  "summary": "User asked about X, agent explained Y...",
  "keptEntries": ["id1", "id2", ...],
  "droppedEntries": ["id3", "id4", ...]
}
```

**Custom compaction**: Extensions can override compaction logic

**Example**: `custom-compaction.ts`
```typescript
pi.on("session_before_compact", async (event, ctx) => {
  // Modify customInstructions or cancel compaction
  return {
    customInstructions: "Focus on technical decisions only",
  };
});
```

**Source**: `docs/compaction.md`

---

## 6. Tool System

### 6.1 Built-in Tools

**Core tools**:
- `read` - Read file contents
- `bash` - Execute shell commands
- `edit` - Edit files (multi-edit support)
- `write` - Create/overwrite files
- `grep` - Search files (respects .gitignore)
- `find` - Find files (respects .gitignore)
- `ls` - List directory (respects .gitignore)

**Tool definition structure**:
```typescript
interface ToolDefinition {
  name: string;
  label: string;
  description: string;
  promptSnippet?: string;  // For "Available tools" section
  promptGuidelines?: string[];  // For "Guidelines" section
  parameters: TSchema;  // TypeBox schema
  execute(...): Promise<ToolResult>;
  renderCall?(...): Component;  // Custom call rendering
  renderResult?(...): Component;  // Custom result rendering
}
```

**Source**: `docs/extensions.md` "Custom Tools"

### 6.2 Tool Registration

**Dynamic registration**:
```typescript
pi.registerTool({
  name: "my_tool",
  // ...
});
```

**Timing**:
- During extension load
- In `session_start` handler
- In command handlers
- In any event handler

**Immediate effect**: Tools are available to LLM immediately (no `/reload` needed)

**Source**: `examples/extensions/dynamic-tools.ts`

### 6.3 Tool Execution Flow

```
LLM decides to call tool
  ↓
tool_execution_start
  ↓
tool_call (extensions can block)
  ↓
tool_execution_update (streaming output)
  ↓
tool_result (extensions can modify)
  ↓
tool_execution_end
```

**Extension hooks**:
- `tool_call` - Can block with `{ block: true, reason: "..." }`
- `tool_result` - Can modify result
- `user_bash` - Special hook for user-initiated bash (not LLM-initiated)

**Source**: `docs/extensions.md` "Tool Events"

### 6.4 Tool Rendering

**Default rendering**:
- Call: Shows tool name and arguments
- Result: Shows output in collapsed/expanded views

**Custom rendering**:
```typescript
pi.registerTool({
  // ...
  renderCall(args, theme, context) {
    return new Text(`Custom call: ${args.name}`, 0, 0);
  },
  renderResult(result, options, theme, context) {
    if (!options.expanded) {
      return new Text("(minimal view)", 0, 0);
    }
    return new Text(`Full result: ${result.content}`, 0, 0);
  }
});
```

**Rendering contexts**:
- `args` - Tool call arguments (shared across call/result)
- `toolCallId` - Unique execution ID
- `isPartial` - Streaming in progress
- `expanded` - Collapsed vs expanded view
- `executionStarted` - Whether execution has begun

**Source**: `docs/extensions.md` "Custom Rendering"

---

## 7. Skills System

### 7.1 What Are Skills?

**Definition**: Markdown files with frontmatter that provide specialized instructions for specific tasks

**Structure**:
```markdown
---
name: "My Skill"
description: "What this skill does"
---

# Skill Instructions

This skill provides guidance for...

## When to Use

- Use when...
- Use for...

## How to Use

1. Read this file when...
2. Follow these steps...
```

**File location**: `SKILL.md` in skill directories

**Source**: `docs/skills.md`

### 7.2 Skill Discovery

**Discovery paths**:
- Global: `~/.pi/agent/skills/`, `~/.agents/skills/`
- Project: `.pi/skills/`, `.agents/skills/` (in cwd and ancestors)
- Package: `skills/` directory in pi packages
- CLI: `--skill` flag

**Discovery rules**:
- If directory contains `SKILL.md`, treat as skill root (don't recurse)
- Otherwise, load direct `.md` children in root
- Recurse into subdirectories to find `SKILL.md`

**Source**: `dist/core/skills.js`

### 7.3 Skill Invocation

**Two modes**:

1. **Passive (default)**: Skill appears in `<available_skills>` section, model reads it when task matches description

2. **Active (with `/skill:name` command)**: User explicitly invokes skill via command

**disableModelInvocation**: Skills can opt out of passive invocation:
```markdown
---
name: "My Skill"
disable-model-invocation: true
---
```

Such skills can only be invoked via `/skill:name` command.

**Source**: `dist/core/skills.js` `formatSkillsForPrompt()`

### 7.4 Skill Format in Prompt

```xml
The following skills provide specialized instructions for specific tasks.
Use the read tool to load a skill's file when the task matches its description.
When a skill file references a relative path, resolve it against the skill directory...

<available_skills>
  <skill>
    <name>Skill Name</name>
    <description>What it does</description>
    <location>/path/to/SKILL.md</location>
  </skill>
  ...
</available_skills>
```

**Source**: `dist/core/skills.js` `formatSkillsForPrompt()`

---

## 8. Provider & Model System

### 8.1 Provider Architecture

**Built-in providers**:
- Anthropic (Claude)
- OpenAI (GPT, Codex)
- Google (Gemini, Vertex)
- OpenRouter (routing layer)
- Ollama (local models)
- ...and many more

**Provider interface**:
```typescript
interface Provider<Api> {
  name: string;
  baseUrl: string;
  apiKey?: string;
  auth: AuthConfig;
  models: ModelDefinition[];
  // ...
}
```

**Source**: `docs/providers.md`, `docs/custom-provider.md`

### 8.2 Model Configuration

**models.json** (`~/.pi/agent/models.json`):

```json
{
  "models": [
    {
      "provider": "anthropic",
      "id": "claude-sonnet-4-5",
      "name": "Claude Sonnet 4.5",
      "contextWindow": 200000,
      "pricing": {...},
      "capabilities": ["tools", "vision", "thinking"]
    }
  ]
}
```

**Custom models**: Users can add custom model definitions

**Model patterns**: Support globs like `anthropic/*`, `*sonnet*`

**Source**: `docs/models.md`

### 8.3 Model Registry

**ModelRegistry** (`dist/core/model-registry.js`):

**Responsibilities**:
- Load models from `models.json`
- Track API key availability
- Resolve model patterns
- Register custom providers

**Methods**:
- `find(provider, id)` - Find model by provider/ID
- `getAvailable()` - Get models with valid API keys
- `registerProvider(name, config)` - Register custom provider

**Source**: `docs/sdk.md`

### 8.4 Custom Providers

**Extension-based providers**:
```typescript
pi.registerProvider("my-provider", {
  baseUrl: "https://api.example.com",
  apiKey: process.env.MY_API_KEY,
  headers: {...},
  models: [...]
});
```

**Examples**:
- `custom-provider-anthropic/` - Custom Anthropic proxy
- `custom-provider-gitlab-duo/` - GitLab Duo with OAuth

**Source**: `docs/custom-provider.md`, `examples/extensions/`

---

## 9. Compaction System

### 9.1 Compaction Triggers

**Automatic**:
- Context exceeds model's limit
- Configurable threshold (default: 80% of context window)

**Manual**:
- `/compact` command
- Extension: `ctx.compact()`

**Source**: `docs/compaction.md`

### 9.2 Compaction Process

```
session_before_compact (extensions can cancel/customize)
  ↓
Summarize branch entries
  ↓
Create compaction entry
  ↓
Drop old entries (keep summary)
  ↓
session_compact (notification)
```

**Compaction entry**:
```json
{
  "type": "compaction",
  "summary": "Conversation summary...",
  "keptEntries": [...],
  "droppedEntries": [...],
  "tokensBefore": 50000,
  "tokensAfter": 5000
}
```

### 9.3 Custom Compaction

**Extension hooks**:
```typescript
pi.on("session_before_compact", async (event, ctx) => {
  return {
    cancel: true,  // Cancel compaction
    // OR
    customInstructions: "Focus on technical decisions",
  };
});
```

**Example**: `custom-compaction.ts`

**Source**: `docs/compaction.md` "Custom Compaction"

---

## 10. RPC & SDK

### 10.1 RPC Protocol

**JSON-RPC 2.0** over stdin/stdout

**Methods**:
- `prompt` - Send prompt
- `get_commands` - List available commands
- `get_models` - List available models
- `set_model` - Switch model
- `compact` - Trigger compaction
- `abort` - Abort current operation
- ...and many more

**Events** (server → client):
- `message` - New message
- `tool_call` - Tool execution
- `tool_result` - Tool result
- `queue_update` - Message queue state
- ...and many more

**Source**: `docs/rpc.md`

### 10.2 SDK Usage

**Minimal example**:
```typescript
import { createAgentSession, AuthStorage, ModelRegistry, SessionManager } from "@mariozechner/pi-coding-agent";

const authStorage = AuthStorage.create();
const modelRegistry = ModelRegistry.create(authStorage);

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  authStorage,
  modelRegistry,
});

session.subscribe((event) => {
  if (event.type === "message_update") {
    process.stdout.write(event.delta);
  }
});

await session.prompt("What files are here?");
```

**Source**: `docs/sdk.md`

### 10.3 Session Runtime API

**AgentSessionRuntime** - Advanced SDK for session replacement:

```typescript
const runtime = await createAgentSessionRuntime(createFactory, {
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  sessionManager: SessionManager.create(process.cwd()),
});

await runtime.newSession();
await runtime.switchSession("/path/to/session.jsonl");
await runtime.fork("entry-id");
```

**Key insight**: Runtime API rebuilds **all cwd-bound state** on session switch, ensuring consistency.

**Source**: `docs/sdk.md` "createAgentSessionRuntime()"

---

## 11. Design Patterns

### 11.1 Resource Loader Pattern

**Pattern**: Layered resource discovery with fallback

**Implementation**: `DefaultResourceLoader`

**Layers**:
1. Global config (`~/.pi/agent/`)
2. Project config (`.pi/` in cwd ancestors)
3. Package declarations (`package.json`)
4. CLI flags

**Benefits**:
- Convention over configuration
- Project-local overrides global
- CLI overrides everything

### 11.2 Event-Driven Architecture

**Pattern**: Publish-subscribe with typed events

**Implementation**: `EventBus`

**Event categories**:
- Lifecycle (session, agent, turn)
- Messages (start, update, end)
- Tools (call, result, execution)
- Custom (extension-defined)

**Benefits**:
- Decoupled components
- Extension interception points
- Testable event handlers

### 11.3 Builder Pattern

**Pattern**: Fluent construction of complex objects

**Implementation**: TUI components, tool definitions

**Example**:
```typescript
const container = new Container();
container.addChild(new Text("Hello", 0, 0));
container.addChild(new DynamicBorder(str => theme.fg("accent", str)));
```

**Benefits**:
- Readable construction
- Flexible composition
- Type-safe building

### 11.4 Strategy Pattern

**Pattern**: Interchangeable algorithms

**Implementation**: Providers, compaction, custom tools

**Example**: Different providers implement same interface:
```typescript
interface Provider<Api> {
  complete(request: Request): Promise<Response>;
}
```

**Benefits**:
- Pluggable implementations
- Easy testing
- Runtime selection

### 11.5 Observer Pattern

**Pattern**: Subscribe to state changes

**Implementation**: Session subscriptions, TUI invalidation

**Example**:
```typescript
session.subscribe((event) => {
  if (event.type === "message_update") {
    render(event.delta);
  }
});
```

**Benefits**:
- Reactive updates
- Decoupled observers
- Efficient re-rendering

---

## 12. Key Insights

### 12.1 Architectural Principles

1. **Minimal core, extensible via extensions**: Pi provides a minimal harness, extensions add capabilities
2. **Convention over configuration**: Resource discovery follows conventions, reducing config burden
3. **Event-driven**: Everything flows through events, enabling extension interception
4. **Immutable sessions**: Sessions are append-only logs with branching, not mutable state
5. **Pluggable everything**: Providers, tools, skills, themes, editors - all pluggable

### 12.2 Extension Philosophy

1. **Extensions run with full permissions**: No sandboxing, trust is required
2. **Extensions can do anything**: Modify prompts, block tools, create UIs, register providers
3. **Extensions are first-class**: Registered via `package.json`, distributed via npm/git
4. **Hot reload supported**: `/reload` reloads extensions without restarting

### 12.3 TUI Design

1. **Component-based**: TUI built from composable components
2. **Cell-based rendering**: Components render to cell grids, enabling efficient diffing
3. **Custom components**: Extensions can create full interactive components
4. **Overlay support**: Components can render as overlays on main TUI

### 12.4 Session Design

1. **JSONL format**: Simple, line-based, easy to parse/stream
2. **Tree structure**: Sessions are trees, not linear logs
3. **Branching**: Fork/resume create branches, not copies
4. **Compaction**: Summarization reduces context while preserving history

### 12.5 Tool Design

1. **Dynamic registration**: Tools can be registered at any time
2. **Immediate availability**: No reload needed, tools available instantly
3. **Custom rendering**: Extensions can override tool rendering
4. **Interceptable**: Extensions can block/modify tool calls

---

## 13. Questions & Explorations

### Open Questions

1. **How does Pi handle concurrent sessions?** - Multiple sessions can run simultaneously, but how is state isolated?

2. **What's the performance characteristics of compaction?** - How long does compaction take for large sessions?

3. **How does the TUI handle terminal resize?** - Is there a resize event, or polling?

4. **What's the extension load order?** - Are extensions loaded in a deterministic order?

5. **How does Pi handle extension conflicts?** - What if two extensions register the same tool name?

### Future Explorations

1. **Read source code for `AgentSession`** - Understand session internals deeply
2. **Explore compaction implementation** - How does summarization work?
3. **Study TUI rendering pipeline** - How does diff-based rendering work?
4. **Examine provider implementations** - How are API calls structured?
5. **Review RPC protocol implementation** - How is JSON-RPC handled?

---

## Exploration Log

### Session 1: 2026-04-16

**Files read**:
- All 26 documentation files in `docs/`
- `README.md`
- `CHANGELOG.md` (skimmed for major features)
- All 70+ extension examples (skimmed for patterns)
- Key source files: `system-prompt.js`, `resource-loader.js`, `skills.js`, `agent-session.js`

**Major discoveries**:
- Dynamic tool registration is possible at ANY time (kills SYSTEM.md approach)
- Pi has four modes: interactive, print, JSON, RPC
- Sessions are immutable append-only trees with branching
- TUI is component-based with custom component support
- Extensions can do almost anything (modify prompts, block tools, create UIs, register providers)
- Resource loading follows layered discovery (global → project → package → CLI)

**Time spent**: ~10 turns exploring and documenting

---

**This document will continue to grow as I explore more of Pi's internals.**
