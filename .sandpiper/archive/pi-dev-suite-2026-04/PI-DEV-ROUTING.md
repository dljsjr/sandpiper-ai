# Pi Extension Developer Documentation - Routing Table

**Target Audience**: Extension developers, SDK users, and developers extending Pi's functionality  
**Pi Version**: 0.67.3  
**Root Path**: `$PI_CODING_AGENT_PACKAGE` (resolves to Pi package location)

---

## How to Use This Routing Table

This documentation suite is **modular and task-oriented**. Don't read everything—use this table to find the right document for your current task.

Each document includes:
- **When to read** - Specific triggers that indicate you need this doc
- **Code snippets** - Working examples you can adapt
- **Source references** - Links to Pi's TypeScript source files
- **Related docs** - Cross-references to other documents in this suite

---

## Quick Reference by Task

| I want to... | Read this first | Then read |
|--------------|-----------------|-----------|
| Create my first extension | [PI-DEV-QUICKSTART.md](#pi-dev-quickstartmd) | [PI-DEV-EVENTS.md](#pi-dev-eventsmD) |
| Work in Sandpiper (not vanilla Pi) | [PI-DEV-SANDPIPER-PATTERNS.md](#pi-dev-sandpiper-patternsmd) | `.sandpiper/docs/` |
| Understand Pi's architecture | [PI-DEV-ARCHITECTURE.md](#pi-dev-architecturemd) | [PI-DEV-EVENTS.md](#pi-dev-eventsmD) |
| Build a custom tool | [PI-DEV-TOOLS.md](#pi-dev-toolsmd) | [PI-DEV-STATE.md](#pi-dev-statemd) |
| Create custom UI | [PI-DEV-UI.md](#pi-dev-uimd) | [PI-DEV-QUICKSTART.md](#pi-dev-quickstartmd) |
| Persist extension state | [PI-DEV-STATE.md](#pi-dev-statemd) | [PI-DEV-EVENTS.md](#pi-dev-eventsmD) |
| Register a custom provider | [PI-DEV-PROVIDERS.md](#pi-dev-providersmd) | [PI-DEV-SDK.md](#pi-dev-sdkmd) |
| Use Pi programmatically | [PI-DEV-SDK.md](#pi-dev-sdkmd) | [PI-DEV-ARCHITECTURE.md](#pi-dev-architecturemd) |
| Follow best practices | [PI-DEV-PATTERNS.md](#pi-dev-patternsmd) | [PI-DEV-SECURITY.md](#pi-dev-securitymd) |
| Build safety features | [PI-DEV-SECURITY.md](#pi-dev-securitymd) | [PI-DEV-TOOLS.md](#pi-dev-toolsmd) |
| Build advanced integrations | [PI-DEV-ADVANCED.md](#pi-dev-advancedmd) | [PI-DEV-ARCHITECTURE.md](#pi-dev-architecturemd) |

---

## Document Index

### 🚀 Getting Started

#### [PI-DEV-QUICKSTART.md](./PI-DEV-QUICKSTART.md)
**When to read**: 
- You're building your first Pi extension
- You need a minimal working example to adapt
- You want to understand extension anatomy (structure, exports, registration)
- You need to know how to load and test extensions

**Contents**:
- Extension anatomy (default export, ExtensionAPI, registration)
- Minimal working extension
- Loading extensions (CLI flags, discovery paths)
- Testing workflow
- Common first mistakes

**Key code**: Minimal extension template, tool registration, event subscription

---

### 🏗️ Architecture & Core Concepts

#### [PI-DEV-ARCHITECTURE.md](./PI-DEV-ARCHITECTURE.md)
**When to read**:
- You need to understand Pi's event-driven architecture
- You're debugging extension lifecycle issues
- You want to understand how extensions interact with the agent loop
- You need to know the extension loading mechanism
- You're building extensions that depend on specific timing

**Contents**:
- Package structure and key source files
- Extension loading (Jiti, discovery, hot reload)
- Event-driven architecture (publish-subscribe)
- Agent loop and turn lifecycle
- Extension runtime and API surface
- Resource discovery (skills, prompts, themes, extensions)

**Key source files**:
- `$PI_CODING_AGENT_PACKAGE/dist/core/agent-session.js` - AgentSession, event flow
- `$PI_CODING_AGENT_PACKAGE/dist/core/extension-runtime.js` - Extension loading, API
- `$PI_CODING_AGENT_PACKAGE/dist/core/resource-loader.js` - Resource discovery
- `$PI_CODING_AGENT_PACKAGE/dist/modes/interactive/interactive-mode.js` - TUI integration

**Related**: [PI-DEV-EVENTS.md](./PI-DEV-EVENTS.md), [PI-DEV-SDK.md](./PI-DEV-SDK.md)

---

### 📡 Event System Reference

#### [PI-DEV-EVENTS.md](./PI-DEV-EVENTS.md)
**When to read**:
- You're implementing an extension and need to know which events to subscribe to
- You need to intercept tool calls, modify prompts, or handle session lifecycle
- You want to understand event ordering and timing
- You need code patterns for specific event handlers

**Contents**:
- Complete event reference (25+ events)
- Event ordering and lifecycle flows
- Handler signatures and return types
- Code patterns for each event type
- Common pitfalls (async handlers, return values, blocking)

**Event categories**:
- **Session lifecycle**: `session_start`, `session_shutdown`, `session_before_*`
- **Turn lifecycle**: `turn_start`, `turn_end`, `agent_start`, `agent_end`
- **Tool events**: `tool_call`, `tool_result`, `tool_execution_*`
- **Message events**: `message_*`, `context`, `input`
- **Model events**: `model_select`
- **Compaction**: `session_before_compact`

**Key patterns**:
```typescript
// Tool interception
pi.on("tool_call", async (event, ctx) => {
  if (shouldBlock(event)) {
    return { block: true, reason: "Blocked" };
  }
  return undefined; // Allow
});

// Prompt modification
pi.on("before_agent_start", async (event) => {
  return { systemPrompt: event.systemPrompt + "\n\nAdditional instructions" };
});
```

**Related**: [PI-DEV-ARCHITECTURE.md](./PI-DEV-ARCHITECTURE.md), [PI-DEV-TOOLS.md](./PI-DEV-TOOLS.md)

---

### 🛠️ Custom Tools

#### [PI-DEV-TOOLS.md](./PI-DEV-TOOLS.md)
**When to read**:
- You're building a custom tool for the LLM to use
- You want to override a built-in tool (read, bash, edit, write)
- You need to implement custom rendering (renderCall, renderResult)
- You need to handle output truncation properly
- You want to add tool-specific prompt guidelines

**Contents**:
- Tool definition (TypeBox schemas, execute function)
- Tool registration (`pi.registerTool()`)
- Custom rendering (renderCall, renderResult, expanded flag)
- Output truncation patterns
- Overriding built-in tools
- Tool result details for state persistence
- Prompt snippets and guidelines

**Key code**:
```typescript
pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "What it does",
  promptSnippet: "Brief description for tools section",
  promptGuidelines: ["When to use", "Best practices"],
  parameters: Type.Object({ /* ... */ }),
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // Implementation
    return { content: [...], details: { /* persisted state */ } };
  },
  renderCall(args, theme, context) { /* ... */ },
  renderResult(result, { expanded, isPartial }, theme, context) { /* ... */ }
});
```

**Key source files**:
- `$PI_CODING_AGENT_PACKAGE/dist/core/tools/` - Built-in tool implementations
- `$PI_CODING_AGENT_PACKAGE/dist/types/tool.js` - ToolDefinition type
- `$PI_CODING_AGENT_PACKAGE/dist/core/agent-session.js` - Tool execution flow

**Related**: [PI-DEV-STATE.md](./PI-DEV-STATE.md), [PI-DEV-UI.md](./PI-DEV-UI.md)

---

### 🎨 Custom UI (TUI)

#### [PI-DEV-UI.md](./PI-DEV-UI.md)
**When to read**:
- You're building custom TUI components
- You need to show dialogs (confirm, select, input, editor)
- You want to create overlays or widgets
- You need to implement a custom editor
- You want to add IME support for CJK input
- You're building real-time animations or games

**Contents**:
- Component interface (render, handleInput, invalidate)
- Built-in components (Text, Box, Container, SelectList, Markdown)
- Custom components (state management, caching, theming)
- Overlays (positioning, anchors, margins, responsive)
- Widgets (above/below editor, status bar, header, title)
- Custom editors (CustomEditor, modal editing, IME support)
- Focusable interface (CURSOR_MARKER for hardware cursor)
- Theme integration (theme.fg(), theme.bg())

**Key code**:
```typescript
// Custom component
class MyComponent {
  render(width: number): string[] {
    // Return lines, each <= width
    return [theme.fg("accent", "Hello")];
  }
  
  handleInput(data: string) {
    if (matchesKey(data, Key.enter)) {
      this.onSelect?.();
    }
  }
  
  invalidate() {
    this.cachedLines = undefined;
  }
}

// Show with ctx.ui.custom()
const result = await ctx.ui.custom((tui, theme, _kb, done) => {
  const component = new MyComponent();
  component.onSelect = () => done("selected");
  return component;
}, { overlay: true, overlayOptions: { anchor: "center" } });
```

**Key source files**:
- `$PI_CODING_AGENT_PACKAGE/node_modules/@mariozechner/pi-tui/dist/index.js` - TUI components
- `$PI_CODING_AGENT_PACKAGE/dist/modes/interactive/tui.js` - TUI integration
- `$PI_CODING_AGENT_PACKAGE/dist/modes/interactive/components/` - Built-in components

**Related**: [PI-DEV-QUICKSTART.md](./PI-DEV-QUICKSTART.md), [PI-DEV-ADVANCED.md](./PI-DEV-ADVANCED.md)

---

### 💾 State Persistence

#### [PI-DEV-STATE.md](./PI-DEV-STATE.md)
**When to read**:
- You need to persist extension state across session restarts
- You're building stateful tools (todo lists, games, configuration)
- You need to handle session branching correctly
- You want to restore state when navigating the session tree

**Contents**:
- Session entry types (message, custom, compaction, branch_summary)
- Storing state in tool result details
- Custom entry types (`pi.appendEntry()`)
- Reconstructing state from session branch
- Handling branch navigation (`session_tree` event)
- Session persistence patterns
- Common mistakes (module-level variables, external files)

**Key patterns**:
```typescript
// Store in tool result details
return {
  content: [{ type: "text", text: "Done" }],
  details: { todos: [...todos], nextId }  // Persisted
};

// Reconstruct from branch
pi.on("session_start", async (_event, ctx) => {
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "message" && entry.message.toolName === "todo") {
      todos = entry.message.details.todos;
    }
  }
});

// Custom entry types
pi.appendEntry("my-extension-state", { config: {...} });

const entries = ctx.sessionManager.getBranch();
const stateEntry = entries
  .filter(e => e.type === "custom" && e.customType === "my-extension-state")
  .pop();
```

**Key source files**:
- `$PI_CODING_AGENT_PACKAGE/dist/core/session-manager.js` - SessionManager, getBranch()
- `$PI_CODING_AGENT_PACKAGE/dist/types/session.js` - SessionEntry types
- `$PI_CODING_AGENT_PACKAGE/dist/core/agent-session.js` - Entry persistence

**Related**: [PI-DEV-EVENTS.md](./PI-DEV-EVENTS.md), [PI-DEV-TOOLS.md](./PI-DEV-TOOLS.md)

---

### 🔌 Custom Providers

#### [PI-DEV-PROVIDERS.md](./PI-DEV-PROVIDERS.md)
**When to read**:
- You're integrating a new LLM provider
- You need to implement OAuth authentication
- You want to create custom streaming implementations
- You need to add custom models to an existing provider

**Contents**:
- Provider registration (`pi.registerProvider()`)
- OAuth flows (PKCE, device code, token refresh)
- Custom streaming (streamSimple implementation)
- Model definitions (cost, context window, capabilities)
- API key management (env vars, auth storage)
- Existing provider examples (Anthropic, GitLab Duo, Qwen)

**Key code**:
```typescript
pi.registerProvider("my-provider", {
  baseUrl: "https://api.example.com",
  apiKey: "MY_API_KEY",  // Env var name
  api: "my-api",
  models: [/* ... */],
  oauth: {
    name: "My Provider",
    login: loginMyProvider,
    refreshToken: refreshMyProvider,
    getApiKey: (cred) => cred.access
  },
  streamSimple: streamMyProvider
});
```

**Key source files**:
- `$PI_CODING_AGENT_PACKAGE/node_modules/@mariozechner/pi-ai/dist/index.js` - Provider types
- `$PI_CODING_AGENT_PACKAGE/node_modules/@mariozechner/pi-ai/dist/providers/` - Built-in providers
- `$PI_CODING_AGENT_PACKAGE/dist/core/model-registry.js` - ModelRegistry, auth storage

**Related**: [PI-DEV-SDK.md](./PI-DEV-SDK.md), [PI-DEV-ADVANCED.md](./PI-DEV-ADVANCED.md)

---

### 💻 SDK & Programmatic Usage

#### [PI-DEV-SDK.md](./PI-DEV-SDK.md)
**When to read**:
- You're embedding Pi in another application
- You need to create agent sessions programmatically
- You want to use Pi without the TUI (RPC, headless)
- You need to manage sessions dynamically (new, switch, fork)
- You're building tools on top of Pi's SDK

**Contents**:
- `createAgentSession()` usage
- Service configuration (auth, models, tools, resources)
- Session management (in-memory, persistent)
- Event subscription patterns
- AgentSessionRuntime for dynamic session replacement
- Full control configuration (no discovery)

**Key code**:
```typescript
import { createAgentSession, SessionManager } from "@mariozechner/pi-coding-agent";

// Minimal
const { session } = await createAgentSession();

// Custom configuration
const { session } = await createAgentSession({
  model: getModel("anthropic", "claude-sonnet-4-20250514"),
  thinkingLevel: "high",
  tools: [createReadTool(cwd), createBashTool(cwd)],
  sessionManager: SessionManager.inMemory()
});

// Subscribe to events
session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await session.prompt("Hello");
```

**Key source files**:
- `$PI_CODING_AGENT_PACKAGE/dist/sdk/agent-session-factory.js` - createAgentSession
- `$PI_CODING_AGENT_PACKAGE/dist/sdk/agent-session-runtime.js` - AgentSessionRuntime
- `$PI_CODING_AGENT_PACKAGE/dist/core/services.js` - Service creation

**Related**: [PI-DEV-ARCHITECTURE.md](./PI-DEV-ARCHITECTURE.md), [PI-DEV-PROVIDERS.md](./PI-DEV-PROVIDERS.md)

---

### 📚 Patterns & Best Practices

#### [PI-DEV-PATTERNS.md](./PI-DEV-PATTERNS.md)
**When to read**:
- You want to follow established best practices
- You're designing a new extension and need architectural guidance
- You want to avoid common mistakes and anti-patterns
- You need token efficiency strategies
- You're looking for code organization patterns

**Contents**:
- Extension design patterns (initialization, cleanup, state)
- Tool design patterns (truncation, rendering, persistence)
- UI patterns (caching, invalidation, theming)
- State management patterns (session entries, branching)
- Token efficiency (collapsed views, progressive disclosure)
- Code organization (file structure, naming, exports)
- Anti-patterns to avoid

**Key patterns**:
```typescript
// ✅ DO: Use session_start for initialization
pi.on("session_start", async (_event, ctx) => {
  // Initialize state, scan resources
});

// ✅ DO: Persist state in session entries
pi.appendEntry("my-state", { data: {...} });

// ❌ DON'T: Use module-level variables (breaks on reload)
let state = {};  // Wrong!

// ✅ DO: Use ctx.hasUI checks
if (!ctx.hasUI) {
  ctx.ui.notify("Requires interactive mode", "error");
  return;
}
```

**Related**: [PI-DEV-SECURITY.md](./PI-DEV-SECURITY.md), [PI-DEV-STATE.md](./PI-DEV-STATE.md)

---

### 🔒 Security & Safety

#### [PI-DEV-SECURITY.md](./PI-DEV-SECURITY.md)
**When to read**:
- You're building safety features (permission gates, protected paths)
- You need to validate or sanitize user input
- You want to implement OS-level sandboxing
- You're building extensions that handle sensitive data
- You need to block dangerous operations

**Contents**:
- Input validation patterns (regex, allowlists)
- Path protection (blocked patterns, git hooks)
- Tool call interception and blocking
- OS-level sandboxing (@anthropic-ai/sandbox-runtime)
- Subagent security (project-local agent confirmation)
- Secure credential handling
- Common security mistakes

**Key code**:
```typescript
// Permission gate
pi.on("tool_call", async (event, ctx) => {
  if (event.toolName === "bash" && isDangerous(event.input.command)) {
    if (!ctx.hasUI) {
      return { block: true, reason: "No UI for confirmation" };
    }
    const ok = await ctx.ui.confirm("Dangerous!", "Allow?");
    if (!ok) return { block: true, reason: "Blocked" };
  }
});

// Path protection
const protectedPaths = [".env", ".git/", "node_modules/"];
if (protectedPaths.some(p => path.includes(p))) {
  return { block: true, reason: "Protected path" };
}
```

**Key source files**:
- `$PI_CODING_AGENT_PACKAGE/dist/core/tools/bash-tool.js` - Bash tool implementation
- `$PI_CODING_AGENT_PACKAGE/node_modules/@anthropic-ai/sandbox-runtime/` - Sandboxing

**Related**: [PI-DEV-TOOLS.md](./PI-DEV-TOOLS.md), [PI-DEV-ADVANCED.md](./PI-DEV-ADVANCED.md)

---

### 🏢 Sandpiper-Specific Patterns

#### [PI-DEV-SANDPIPER-PATTERNS.md](./PI-DEV-SANDPIPER-PATTERNS.md)
**When to read**:
- You're working in the Sandpiper distribution (not vanilla Pi)
- You need to integrate with Sandpiper-specific systems (tasks, Journal, shell relay)
- You want to use the capability guidance registry for prompt injection
- You're building extensions that need task context or session continuity
- You need to understand Sandpiper's system prompt assembly approach

**Contents**:
- Capability guidance registry (static/dynamic prompt injection)
- System prompt assembly (parse/replace/reassemble pattern)
- Shell relay integration (Zellij, FIFO management)
- Task management integration (CLI, storage modes, context injection)
- Session lifecycle and optional Journal continuation notes
- Environment variable mirroring (SANDPIPER_* / PI_* namespaces)
- Build & extension loading (source-loaded extensions, postinstall)
- Sandpiper-specific testing constraints

**Key patterns**:
```typescript
// Capability guidance registration (module load time)
pi.events.emit('capability_guidance:register_static', {
  id: 'my-extension',
  block: '## My Guidance\n\nInstructions here...'
});

// Task context injection (before_agent_start)
const tasks = execFileSync('sandpiper-tasks', ['list', '--status', 'active']);
return { systemPrompt: event.systemPrompt + '\n\n## Active Tasks\n\n' + tasks };

// Shell relay FIFO pattern
await writeToFIFO('/tmp/sandpiper-relay.fifo', command);
const output = await readFromFIFO('/tmp/sandpiper-relay.fifo');
```

**Related**: `.sandpiper/docs/` for Sandpiper architecture docs

---

### 🚀 Advanced Topics

#### [PI-DEV-ADVANCED.md](./PI-DEV-ADVANCED.md)
**When to read**:
- You're building subagent delegation
- You need real-time rendering (games, animations)
- You want to delegate tools to remote systems (SSH)
- You're building complex integrations (file watching, system sync)
- You need advanced TUI techniques (overlays at 35 FPS)

**Contents**:
- Subagent patterns (spawning pi subprocesses, JSON mode)
- Real-time game loops (Snake, DOOM overlay)
- SSH tool delegation (remote read/write/edit/bash)
- File watching and triggers
- System integration (macOS dark mode, notifications)
- Advanced overlay techniques (stacking, responsive, animation)
- Custom editor implementations (modal, rainbow, IME)

**Key code**:
```typescript
// Subagent delegation
const proc = spawn("pi", [
  "--mode", "json",
  "-p", prompt,
  "--no-session"
], { stdio: ["ignore", "pipe", "pipe"] });

for await (const line of proc.stdout) {
  const event = JSON.parse(line);
  if (event.type === "message_end") {
    // Process structured output
  }
}

// Real-time rendering
class GameComponent {
  private animationFrame: number | null = null;
  
  private gameLoop() {
    this.engine.tick();
    this.tui.requestRender();
    this.animationFrame = requestAnimationFrame(() => this.gameLoop());
  }
}
```

**Key source files**:
- `$PI_CODING_AGENT_PACKAGE/examples/extensions/subagent/` - Subagent example
- `$PI_CODING_AGENT_PACKAGE/examples/extensions/doom-overlay/` - DOOM game overlay
- `$PI_CODING_AGENT_PACKAGE/examples/extensions/ssh.ts` - SSH delegation

**Related**: [PI-DEV-UI.md](./PI-DEV-UI.md), [PI-DEV-PROVIDERS.md](./PI-DEV-PROVIDERS.md)

---

## Source File Reference

### Core Runtime

| File | Purpose | Read when... |
|------|---------|--------------|
| `$PI_CODING_AGENT_PACKAGE/dist/core/agent-session.js` | AgentSession, event flow, tool execution | Understanding event ordering, tool lifecycle |
| `$PI_CODING_AGENT_PACKAGE/dist/core/extension-runtime.js` | Extension loading, API implementation | Building extensions, debugging loading issues |
| `$PI_CODING_AGENT_PACKAGE/dist/core/resource-loader.js` | Resource discovery (extensions, skills, prompts) | Understanding resource loading, custom paths |
| `$PI_CODING_AGENT_PACKAGE/dist/core/session-manager.js` | Session persistence, branching, navigation | Implementing state persistence, handling branches |
| `$PI_CODING_AGENT_PACKAGE/dist/core/model-registry.js` | Model registry, auth storage, OAuth | Custom providers, credential management |

### Tools

| File | Purpose | Read when... |
|------|---------|--------------|
| `$PI_CODING_AGENT_PACKAGE/dist/core/tools/read-tool.js` | Read tool implementation | Overriding read, understanding tool patterns |
| `$PI_CODING_AGENT_PACKAGE/dist/core/tools/bash-tool.js` | Bash tool implementation | Overriding bash, sandboxing |
| `$PI_CODING_AGENT_PACKAGE/dist/core/tools/edit-tool.js` | Edit tool implementation | Overriding edit, diff handling |
| `$PI_CODING_AGENT_PACKAGE/dist/core/tools/write-tool.js` | Write tool implementation | Overriding write, file creation |
| `$PI_CODING_AGENT_PACKAGE/dist/types/tool.js` | ToolDefinition type | Defining custom tools |

### TUI

| File | Purpose | Read when... |
|------|---------|--------------|
| `$PI_CODING_AGENT_PACKAGE/node_modules/@mariozechner/pi-tui/dist/index.js` | TUI components, types | Building custom components |
| `$PI_CODING_AGENT_PACKAGE/dist/modes/interactive/tui.js` | TUI integration | Understanding TUI lifecycle |
| `$PI_CODING_AGENT_PACKAGE/dist/modes/interactive/components/` | Built-in components | Creating similar components |
| `$PI_CODING_AGENT_PACKAGE/dist/modes/interactive/interactive-mode.js` | Interactive mode, event handling | Understanding TUI flow |

### SDK

| File | Purpose | Read when... |
|------|---------|--------------|
| `$PI_CODING_AGENT_PACKAGE/dist/sdk/agent-session-factory.js` | createAgentSession() | Programmatic usage |
| `$PI_CODING_AGENT_PACKAGE/dist/sdk/agent-session-runtime.js` | AgentSessionRuntime | Dynamic session management |
| `$PI_CODING_AGENT_PACKAGE/dist/sdk/services.js` | Service creation | Full control configuration |

### Providers

| File | Purpose | Read when... |
|------|---------|--------------|
| `$PI_CODING_AGENT_PACKAGE/node_modules/@mariozechner/pi-ai/dist/index.js` | Provider types, streaming | Custom provider implementation |
| `$PI_CODING_AGENT_PACKAGE/node_modules/@mariozechner/pi-ai/dist/providers/` | Built-in providers | Reference implementations |
| `$PI_CODING_AGENT_PACKAGE/node_modules/@mariozechner/pi-ai/dist/utils/oauth/` | OAuth utilities | OAuth implementation |

---

## Version Compatibility

This documentation suite targets **Pi version 0.67.3**.

### Breaking Changes to Watch For

| Version | Change | Impact |
|---------|--------|--------|
| 0.65.0 | Extension API changes | Check `ExtensionAPI` type for updates |
| 0.66.0 | TUI component interface | Review `Component` interface if building custom components |
| 0.67.0 | Session entry types | Check `SessionEntry` types for new custom types |

### Checking Your Version

```bash
pi --version
# or
echo $PI_CODING_AGENT_VERSION
```

---

## Getting Help

### Documentation
- This documentation suite (`.sandpiper/docs/pi-dev-suite/`)
- Pi official docs (`$PI_CODING_AGENT_PACKAGE/docs/`)
- Example code (`$PI_CODING_AGENT_PACKAGE/examples/`)

### Debugging
- Enable extension logging: `PI_DEBUG=extensions pi`
- Check extension load errors in startup output
- Use `ctx.ui.notify()` for runtime debugging

### Community
- Pi GitHub repository
- Extension examples as reference implementations
- This documentation suite's cross-references

---

## Document Changelog

| Date | Document | Change |
|------|----------|--------|
| 2026-04-16 | All | Initial creation from comprehensive docs + examples analysis |

---

**Next Steps**: Start with [PI-DEV-QUICKSTART.md](./PI-DEV-QUICKSTART.md) if you're building your first extension, or use the task table above to find the right document for your current task.
