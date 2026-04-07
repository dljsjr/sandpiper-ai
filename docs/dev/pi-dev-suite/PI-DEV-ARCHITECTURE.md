# Pi Architecture for Extension Developers

**Target**: Developers who need to understand Pi's internals  
**Related**: [PI-DEV-ROUTING.md](./PI-DEV-ROUTING.md), [PI-DEV-EVENTS.md](./PI-DEV-EVENTS.md)

---

## Package Structure

```
$PI_CODING_AGENT_PACKAGE/
├── dist/                          # Compiled TypeScript
│   ├── core/                      # Core runtime
│   │   ├── agent-session.js       # AgentSession, event flow
│   │   ├── extension-runtime.js   # Extension loading, API
│   │   ├── resource-loader.js     # Resource discovery
│   │   ├── session-manager.js     # Session persistence
│   │   ├── model-registry.js      # Models, auth, OAuth
│   │   ├── tools/                 # Built-in tools
│   │   │   ├── read-tool.js
│   │   │   ├── bash-tool.js
│   │   │   ├── edit-tool.js
│   │   │   └── write-tool.js
│   │   └── services.js            # Service creation
│   ├── modes/                     # Operating modes
│   │   ├── interactive/           # TUI mode
│   │   │   ├── interactive-mode.js
│   │   │   ├── tui.js
│   │   │   └── components/        # Built-in components
│   │   └── rpc/                   # RPC mode
│   ├── sdk/                       # SDK
│   │   ├── agent-session-factory.js
│   │   └── agent-session-runtime.js
│   └── types/                     # TypeScript types
├── node_modules/
│   ├── @mariozechner/pi-ai/       # AI provider layer
│   │   ├── dist/providers/        # Provider implementations
│   │   └── dist/utils/oauth/      # OAuth utilities
│   └── @mariozechner/pi-tui/      # TUI components
├── examples/                      # Working examples
│   ├── extensions/                # 70+ extension examples
│   └── sdk/                       # SDK examples
└── docs/                          # User documentation
```

---

## Extension Loading

### Discovery Paths

Extensions are discovered from:

1. **Global**: `~/.pi/agent/extensions/*.ts`
2. **Project**: `<cwd>/.pi/extensions/*.ts`
3. **Settings**: `extensions` array in settings.json
4. **Packages**: `pi.extensions` in package.json
5. **CLI**: `--extension` flags

### Loading Mechanism

Extensions are loaded via **Jiti** (TypeScript without compilation):

```typescript
// From $PI_CODING_AGENT_PACKAGE/dist/core/extension-runtime.js
import jiti from "jiti";

const loadExtension = (path: string) => {
  const require = jiti(__filename, { interopDefault: true });
  const mod = require(path);
  return mod.default || mod;
};
```

**Key implications**:
- ✅ TypeScript files work directly (no build step)
- ✅ ES modules and CommonJS both supported
- ✅ Extensions can have their own `node_modules/`
- ⚠️ Jiti caches modules - use `/reload` to refresh

### Extension Runtime

Each extension receives an `ExtensionAPI` instance:

```typescript
// Simplified from extension-runtime.js
class ExtensionRuntime {
  private extensions: Array<(pi: ExtensionAPI) => void> = [];
  
  async loadExtension(path: string) {
    const factory = await loadExtension(path);
    const api = this.createAPI();
    this.extensions.push(factory);
    factory(api);
  }
  
  async fireEvent(event: string, ...args: any[]) {
    for (const ext of this.extensions) {
      // Fire event to all extensions
    }
  }
}
```

---

## Event-Driven Architecture

### Publish-Subscribe Pattern

```typescript
// From $PI_CODING_AGENT_PACKAGE/dist/core/agent-session.js
class AgentSession {
  private eventHandlers = new Map<string, Set<EventHandler>>();
  
  on(event: string, handler: EventHandler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }
  
  async emit(event: string, ...args: any[]) {
    const handlers = this.eventHandlers.get(event) || [];
    for (const handler of handlers) {
      await handler(...args);
    }
  }
}
```

### Event Flow

```
User Input
  ↓
[input event] → Extensions can transform
  ↓
[before_agent_start] → Extensions can modify prompt
  ↓
[agent_start] → Extensions notified
  ↓
[turn_start] → Extensions notified
  ↓
[context event] → Extensions can filter messages
  ↓
LLM Processing
  ↓
[tool_call] → Extensions can block/modify
  ↓
[tool_result] → Extensions can modify results
  ↓
[turn_end] → Extensions notified
  ↓
[agent_end] → Extensions notified
```

**Source**: `$PI_CODING_AGENT_PACKAGE/dist/core/agent-session.js`

---

## Agent Loop

### Turn Processing

```typescript
// Simplified from agent-session.js
async runTurn() {
  // 1. Build context
  const context = await this.buildContext();
  
  // 2. Fire before_agent_start
  const promptResult = await this.emit("before_agent_start", {
    systemPrompt: context.systemPrompt
  });
  
  // 3. Apply prompt modifications
  if (promptResult?.systemPrompt) {
    context.systemPrompt = promptResult.systemPrompt;
  }
  
  // 4. Start agent
  await this.emit("agent_start");
  await this.emit("turn_start");
  
  // 5. Stream from LLM
  const stream = this.model.stream(context);
  
  for await (const event of stream) {
    if (event.type === "toolCall") {
      // 6. Fire tool_call (can block)
      const blockResult = await this.emit("tool_call", {
        toolName: event.name,
        input: event.arguments
      });
      
      if (blockResult?.block) {
        continue;  // Skip tool execution
      }
      
      // 7. Execute tool
      const result = await this.executeTool(event);
      
      // 8. Fire tool_result
      await this.emit("tool_result", { result });
    }
  }
  
  // 9. End turn
  await this.emit("turn_end");
}
```

---

## Resource Discovery

### Resource Loader

```typescript
// From $PI_CODING_AGENT_PACKAGE/dist/core/resource-loader.js
class DefaultResourceLoader {
  async reload() {
    // Discover extensions
    this.extensions = await this.discoverExtensions();
    
    // Discover skills
    this.skills = await this.discoverSkills();
    
    // Discover prompts
    this.prompts = await this.discoverPrompts();
    
    // Discover themes
    this.themes = await this.discoverThemes();
    
    // Discover agents files
    this.agentsFiles = await this.discoverAgentsFiles();
  }
  
  async discoverExtensions() {
    const paths = [
      ...this.globalPaths,
      ...this.projectPaths,
      ...this.settingsPaths
    ];
    
    const extensions = [];
    for (const path of paths) {
      if (existsSync(path)) {
        extensions.push(path);
      }
    }
    return extensions;
  }
}
```

**Source**: `$PI_CODING_AGENT_PACKAGE/dist/core/resource-loader.js`

### Discovery Order

Resources are discovered in order:

1. **Global** (`~/.pi/agent/`)
2. **Project** (`<cwd>/.pi/`)
3. **Packages** (from package.json)
4. **Settings** (from settings.json)
5. **CLI** (from flags)

Later resources can override earlier ones.

---

## Session Management

### Session Structure

```typescript
// From $PI_CODING_AGENT_PACKAGE/dist/types/session.js
interface SessionEntry {
  id: string;
  parentId: string | null;
  type: "session" | "message" | "compaction" | "custom" | ...;
  timestamp: number;
  // Type-specific fields...
}

interface MessageEntry extends SessionEntry {
  type: "message";
  message: {
    role: "user" | "assistant" | "toolResult";
    content: ContentBlock[];
    toolName?: string;
    details?: any;  // For state persistence
  };
}

interface CustomEntry extends SessionEntry {
  type: "custom";
  customType: string;
  data: any;
}
```

### Branch Navigation

Sessions are **trees**, not linear logs:

```
Root (session header)
├─ user: "Hello"
│  └─ assistant: "Hi! How can I help?"
│     ├─ user: "Help with X"  ← Branch A
│     │  └─ assistant: "Sure..."
│     └─ user: "Actually Y"   ← Branch B (forked)
        └─ assistant: "Okay..."
```

**Key methods**:
- `ctx.sessionManager.getBranch()` - Get entries in current branch
- `ctx.sessionManager.getEntries()` - Get all entries
- `ctx.sessionManager.getLeafEntry()` - Get current position

**Source**: `$PI_CODING_AGENT_PACKAGE/dist/core/session-manager.js`

---

## Tool System

### Tool Definition

```typescript
// From $PI_CODING_AGENT_PACKAGE/dist/types/tool.js
interface ToolDefinition {
  name: string;
  label: string;
  description: string;
  promptSnippet?: string;      // For "Available tools" section
  promptGuidelines?: string[]; // For "Guidelines" section
  parameters: TSchema;         // TypeBox schema
  execute: ToolExecutor;
  renderCall?: RenderCall;
  renderResult?: RenderResult;
  renderShell?: "default" | "self";
}
```

### Tool Execution Flow

```typescript
// Simplified from agent-session.js
async executeTool(toolCall: ToolCall) {
  const tool = this.tools.get(toolCall.name);
  if (!tool) throw new Error(`Unknown tool: ${toolCall.name}`);
  
  // Fire tool_call (can block)
  const blockResult = await this.emit("tool_call", {
    toolName: tool.name,
    input: toolCall.arguments
  });
  
  if (blockResult?.block) {
    return { blocked: true, reason: blockResult.reason };
  }
  
  // Fire tool_execution_start
  await this.emit("tool_execution_start", { toolName: tool.name });
  
  try {
    // Execute tool
    const result = await tool.execute(
      toolCall.id,
      toolCall.arguments,
      this.signal,
      this.onUpdate,
      this.ctx
    );
    
    // Fire tool_result
    await this.emit("tool_result", { result });
    
    return result;
  } finally {
    // Fire tool_execution_end
    await this.emit("tool_execution_end");
  }
}
```

**Source**: `$PI_CODING_AGENT_PACKAGE/dist/core/agent-session.js`

---

## TUI Integration

### Interactive Mode

```typescript
// From $PI_CODING_AGENT_PACKAGE/dist/modes/interactive/interactive-mode.js
class InteractiveMode {
  async run() {
    // Initialize TUI
    this.tui = new TUI();
    this.tui.start();
    
    // Create session
    const session = await createAgentSession({...});
    
    // Subscribe to events
    session.subscribe((event) => {
      switch (event.type) {
        case "message_update":
          this.renderMessage(event);
          break;
        case "tool_execution_start":
          this.renderToolCall(event);
          break;
      }
    });
    
    // Main loop
    while (true) {
      const input = await this.tui.prompt();
      await session.prompt(input);
    }
  }
}
```

### Extension UI API

```typescript
// From extension-runtime.js
class ExtensionUI {
  async custom<T>(factory: ComponentFactory, options?: OverlayOptions) {
    // Create component
    const component = factory(this.tui, this.theme, this.keybindings, done);
    
    // Show overlay or replace UI
    if (options?.overlay) {
      return this.showOverlay(component, options);
    } else {
      return this.showCustom(component);
    }
  }
  
  async confirm(title: string, message: string) {
    return this.custom<boolean>((tui, theme, kb, done) => {
      return new ConfirmDialog(title, message, done);
    });
  }
  
  async select(title: string, items: string[]) {
    return this.custom<string>((tui, theme, kb, done) => {
      return new SelectDialog(title, items, done);
    });
  }
}
```

**Source**: `$PI_CODING_AGENT_PACKAGE/dist/modes/interactive/tui.js`

---

## Model Registry

### Provider Registration

```typescript
// From $PI_CODING_AGENT_PACKAGE/dist/core/model-registry.js
class ModelRegistry {
  registerProvider(name: string, config: ProviderConfig) {
    this.providers.set(name, {
      ...config,
      models: config.models.map(m => ({
        ...m,
        provider: name
      }))
    });
  }
  
  async getApiKeyForProvider(provider: string) {
    // Check runtime key
    const runtimeKey = this.authStorage.getRuntimeApiKey(provider);
    if (runtimeKey) return runtimeKey;
    
    // Check env var
    const config = this.providers.get(provider);
    if (config?.apiKey) {
      return process.env[config.apiKey];
    }
    
    // Check OAuth
    const oauth = this.authStorage.getOAuth(provider);
    if (oauth && oauth.expires > Date.now()) {
      return oauth.access;
    }
    
    return undefined;
  }
}
```

**Source**: `$PI_CODING_AGENT_PACKAGE/dist/core/model-registry.js`

---

## SDK Architecture

### Service Creation

```typescript
// From $PI_CODING_AGENT_PACKAGE/dist/sdk/services.js
async function createAgentSessionServices(options: CreateAgentSessionOptions) {
  // Create auth storage
  const authStorage = options.authStorage || AuthStorage.create();
  
  // Create model registry
  const modelRegistry = options.modelRegistry || ModelRegistry.create(authStorage);
  
  // Create resource loader
  const resourceLoader = options.resourceLoader || new DefaultResourceLoader();
  await resourceLoader.reload();
  
  // Create session manager
  const sessionManager = options.sessionManager || SessionManager.create(options.cwd);
  
  // Create settings manager
  const settingsManager = options.settingsManager || SettingsManager.create(
    options.cwd,
    options.agentDir
  );
  
  // Create tools
  const tools = options.tools || codingTools;
  
  return {
    authStorage,
    modelRegistry,
    resourceLoader,
    sessionManager,
    settingsManager,
    tools,
    customTools: options.customTools || []
  };
}
```

### Session Factory

```typescript
// From $PI_CODING_AGENT_PACKAGE/dist/sdk/agent-session-factory.js
async function createAgentSession(options: CreateAgentSessionOptions) {
  const services = await createAgentSessionServices(options);
  
  const session = await createAgentSessionFromServices({
    services,
    sessionManager: services.sessionManager,
    sessionStartEvent: {
      type: "session_start",
      reason: "new",
      sessionFile: services.sessionManager.getSessionFile()
    }
  });
  
  return { session, services };
}
```

---

## Key Source Files

### Core Runtime

| File | Purpose | Read when... |
|------|---------|--------------|
| `$PI_CODING_AGENT_PACKAGE/dist/core/agent-session.js` | AgentSession, event flow | Understanding event ordering |
| `$PI_CODING_AGENT_PACKAGE/dist/core/extension-runtime.js` | Extension loading, API | Debugging extension issues |
| `$PI_CODING_AGENT_PACKAGE/dist/core/resource-loader.js` | Resource discovery | Custom resource paths |
| `$PI_CODING_AGENT_PACKAGE/dist/core/session-manager.js` | Session persistence | State management |
| `$PI_CODING_AGENT_PACKAGE/dist/core/model-registry.js` | Model registry, auth | Custom providers |

### Tools

| File | Purpose | Read when... |
|------|---------|--------------|
| `$PI_CODING_AGENT_PACKAGE/dist/core/tools/read-tool.js` | Read implementation | Overriding read |
| `$PI_CODING_AGENT_PACKAGE/dist/core/tools/bash-tool.js` | Bash implementation | Overriding bash |
| `$PI_CODING_AGENT_PACKAGE/dist/core/tools/edit-tool.js` | Edit implementation | Overriding edit |
| `$PI_CODING_AGENT_PACKAGE/dist/core/tools/write-tool.js` | Write implementation | Overriding write |
| `$PI_CODING_AGENT_PACKAGE/dist/types/tool.js` | ToolDefinition type | Defining tools |

### TUI

| File | Purpose | Read when... |
|------|---------|--------------|
| `$PI_CODING_AGENT_PACKAGE/node_modules/@mariozechner/pi-tui/dist/index.js` | TUI components | Custom components |
| `$PI_CODING_AGENT_PACKAGE/dist/modes/interactive/tui.js` | TUI integration | TUI lifecycle |
| `$PI_CODING_AGENT_PACKAGE/dist/modes/interactive/interactive-mode.js` | Interactive mode | Understanding flow |

### SDK

| File | Purpose | Read when... |
|------|---------|--------------|
| `$PI_CODING_AGENT_PACKAGE/dist/sdk/agent-session-factory.js` | createAgentSession() | Programmatic usage |
| `$PI_CODING_AGENT_PACKAGE/dist/sdk/agent-session-runtime.js` | AgentSessionRuntime | Dynamic sessions |
| `$PI_CODING_AGENT_PACKAGE/dist/sdk/services.js` | Service creation | Full control |

---

## Extension API Surface

### Available Methods

```typescript
interface ExtensionAPI {
  // Events
  on(event: string, handler: EventHandler): void;
  
  // Tools
  registerTool(tool: ToolDefinition): void;
  getAllTools(): ToolInfo[];
  setActiveTools(names: string[]): void;
  
  // Commands
  registerCommand(name: string, config: CommandConfig): void;
  getCommands(): SlashCommandInfo[];
  
  // Shortcuts
  registerShortcut(key: string, config: ShortcutConfig): void;
  
  // Providers
  registerProvider(name: string, config: ProviderConfig): void;
  
  // Messages
  registerMessageRenderer(type: string, renderer: MessageRenderer): void;
  sendMessage(msg: CustomMessage, options?: MessageOptions): void;
  sendUserMessage(content: string | ContentBlock[], options?: UserMessageOptions): void;
  
  // Models
  setModel(model: Model): Promise<boolean>;
  setThinkingLevel(level: ThinkingLevel): void;
  
  // Shell
  exec(cmd: string, args: string[], options?: ExecOptions): Promise<ExecResult>;
  
  // Flags
  getFlag(name: string): any;
  
  // State
  appendEntry(type: string, data: any): void;
  getSessionName(): string | undefined;
  setSessionName(name: string): void;
  setLabel(entryId: string, label: string | undefined): void;
  
  // UI (via ctx)
  // ctx.ui.notify(), ctx.ui.confirm(), ctx.ui.custom(), etc.
}
```

---

## Performance Considerations

### Extension Loading

- Extensions are loaded **sequentially** at startup
- Each extension's `session_start` handler runs sequentially
- Heavy initialization should be async and deferred

### Event Handling

- Event handlers run **sequentially** in registration order
- Slow handlers block the agent loop
- Use async handlers and avoid blocking operations

### Memory

- Extensions persist for session lifetime
- Clean up intervals, listeners on `session_shutdown`
- Don't store large data in module scope

---

**Next Steps**:
- Read [PI-DEV-EVENTS.md](./PI-DEV-EVENTS.md) for event reference
- Read [PI-DEV-SDK.md](./PI-DEV-SDK.md) for programmatic usage
- Browse source files referenced above


---

## Extension Loading in Detail

### How Pi Loads Extensions

Pi uses **jiti** (a TypeScript-aware module loader) to load extensions at runtime:

1. **jiti loads `.ts` files directly** — no extension build step required
2. **Module resolution** follows standard Node.js rules — imports resolve from `node_modules/` (hoisted by Bun), plus jiti aliases for Pi framework packages
3. **`tsconfig.json` paths are for TypeScript type-checking only** — jiti does **not** use them. If an import works in `tsc` but fails at runtime, the module is not resolvable via normal runtime resolution
4. **Each jiti load creates a separate module scope** — module-level state is not shared between extensions. Use `pi.events` for cross-extension communication

### jiti Aliases

Pi's extension loader configures jiti with aliases for known packages:

- `@mariozechner/pi-coding-agent`
- `@mariozechner/pi-tui`
- `@mariozechner/pi-ai`
- `@sinclair/typebox`

All other imports resolve via standard `node_modules/` resolution.

### `/reload` Limitations

The `/reload` command reloads resources, but:
- **New cross-package exports** may require a full agent restart
- **Module dependency graph** is not fully re-resolved for the active session
- **Already-loaded modules** stay cached in jiti's module cache

If you add a new module to a workspace package and re-export it, expect to need a full restart (not just `/reload`).

### Sandpiper-Specific Notes

In Sandpiper:
- Extensions load from source `.ts` files (no build step)
- `postinstall.sh` preserves extension `src/` trees in `dist/` so `pi.extensions` entries resolve
- Multi-file extensions (like `shell-relay`) use `package.json` with `pi.extensions` pointing to `./src/index.ts`
- npm dependencies resolve from hoisted root `node_modules/`

See [Sandpiper Patterns](./PI-DEV-SANDPIPER-PATTERNS.md) for Sandpiper-specific build workflow.

