# Pi SDK Developer Guide

**Target**: Developers using Pi programmatically  
**Related**: [PI-DEV-ARCHITECTURE.md](./PI-DEV-ARCHITECTURE.md), [PI-DEV-PROVIDERS.md](./PI-DEV-PROVIDERS.md)

---

## Quick Start

### Minimal Usage

```typescript
import { createAgentSession } from "@mariozechner/pi-coding-agent";

const { session } = await createAgentSession();

// Subscribe to events
session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

// Run a prompt
await session.prompt("What files are in the current directory?");

// Access messages
console.log(session.state.messages);
```

---

## Session Creation

### Default Configuration

```typescript
import { createAgentSession } from "@mariozechner/pi-coding-agent";

const { session, services } = await createAgentSession();

// services includes:
// - authStorage
// - modelRegistry
// - resourceLoader
// - sessionManager
// - settingsManager
// - tools
```

### Custom Model

```typescript
import { createAgentSession, getModel } from "@mariozechner/pi-coding-agent";

const model = getModel("anthropic", "claude-sonnet-4-20250514");

const { session } = await createAgentSession({
  model,
  thinkingLevel: "high"  // "off" | "minimal" | "low" | "medium" | "high" | "xhigh"
});
```

### Custom Tools

```typescript
import { createAgentSession, createReadTool, createBashTool } from "@mariozechner/pi-coding-agent";

const cwd = process.cwd();

const { session } = await createAgentSession({
  tools: [
    createReadTool(cwd),
    createBashTool(cwd)
  ]
});
```

### In-Memory Session

```typescript
import { createAgentSession, SessionManager } from "@mariozechner/pi-coding-agent";

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory()
});
```

### Full Control (No Discovery)

```typescript
import {
  createAgentSession,
  AuthStorage,
  ModelRegistry,
  SessionManager,
  SettingsManager
} from "@mariozechner/pi-coding-agent";

const authStorage = AuthStorage.create("/custom/path/auth.json");
authStorage.setRuntimeApiKey("anthropic", process.env.ANTHROPIC_API_KEY!);

const modelRegistry = ModelRegistry.inMemory(authStorage);
const model = getModel("anthropic", "claude-sonnet-4-20250514");

const { session } = await createAgentSession({
  cwd: "/custom/cwd",
  agentDir: "/custom/agent",
  model,
  thinkingLevel: "off",
  authStorage,
  modelRegistry,
  tools: [createReadTool(cwd), createBashTool(cwd)],
  sessionManager: SessionManager.inMemory(),
  settingsManager: SettingsManager.inMemory({
    compaction: { enabled: false }
  })
});
```

---

## Event Subscription

### Basic Subscription

```typescript
session.subscribe((event) => {
  switch (event.type) {
    case "message_update":
      if (event.assistantMessageEvent.type === "text_delta") {
        process.stdout.write(event.assistantMessageEvent.delta);
      }
      break;
    
    case "tool_execution_start":
      console.log(`Tool: ${event.toolName}`);
      break;
    
    case "tool_execution_end":
      console.log(`Result: ${event.result}`);
      break;
    
    case "agent_end":
      console.log("Done!");
      break;
  }
});
```

### Streaming Output

```typescript
session.subscribe((event) => {
  if (event.type === "message_update") {
    const ae = event.assistantMessageEvent;
    
    switch (ae.type) {
      case "text_start":
        process.stdout.write("\n[Text]");
        break;
      case "text_delta":
        process.stdout.write(ae.delta);
        break;
      case "thinking_start":
        process.stdout.write("\n[Thinking]");
        break;
      case "thinking_delta":
        process.stdout.write(ae.delta);
        break;
      case "toolcall_start":
        process.stdout.write(`\n[Tool: ${ae.toolCall.name}]`);
        break;
      case "toolcall_delta":
        // Partial JSON arguments
        break;
    }
  }
});
```

### Unsubscribe

```typescript
const unsubscribe = session.subscribe((event) => {
  // Handle events
});

// Later
unsubscribe();
```

---

## Session Management

### New Session

```typescript
import { createAgentSessionRuntime } from "@mariozechner/pi-coding-agent";

const runtime = await createAgentSessionRuntime(createRuntime, {
  cwd: process.cwd(),
  sessionManager: SessionManager.create(process.cwd())
});

// Create new session
await runtime.newSession();

// Subscribe to new session
const unsubscribe = runtime.session.subscribe(handleEvent);
```

### Switch Session

```typescript
// Switch to existing session
await runtime.switchSession("/path/to/session.jsonl");

// Rebind subscriptions after switch
unsubscribe();
const newUnsubscribe = runtime.session.subscribe(handleEvent);
```

### Fork Session

```typescript
// Fork from a specific entry
await runtime.forkSession(entryId);
```

### List Sessions

```typescript
import { SessionManager } from "@mariozechner/pi-coding-agent";

const sessionManager = SessionManager.create(process.cwd());
const sessions = sessionManager.listSessions();

for (const session of sessions) {
  console.log(`${session.file} - ${session.lastModified}`);
}
```

---

## AgentSessionRuntime

### Creating Runtime

```typescript
import {
  createAgentSessionRuntime,
  createAgentSessionServices,
  createAgentSessionFromServices,
  type CreateAgentSessionRuntimeFactory
} from "@mariozechner/pi-coding-agent";

const createRuntime: CreateAgentSessionRuntimeFactory = async ({
  cwd,
  sessionManager,
  sessionStartEvent
}) => {
  const services = await createAgentSessionServices({ cwd });
  
  return {
    ...(await createAgentSessionFromServices({
      services,
      sessionManager,
      sessionStartEvent
    })),
    services,
    diagnostics: services.diagnostics
  };
};

const runtime = await createAgentSessionRuntime(createRuntime, {
  cwd: process.cwd(),
  sessionManager: SessionManager.create(process.cwd())
});
```

### Binding Extensions

```typescript
let unsubscribe: (() => void) | undefined;

async function bindSession() {
  // Unsubscribe from previous session
  unsubscribe?.();
  
  // Bind extensions to new session
  await runtime.session.bindExtensions({});
  
  // Subscribe to new session
  unsubscribe = runtime.session.subscribe((event) => {
    // Handle events
  });
  
  return runtime.session;
}

// Initial bind
let session = await bindSession();

// After newSession()
await runtime.newSession();
session = await bindSession();  // Rebind!

// After switchSession()
await runtime.switchSession(sessionFile);
session = await bindSession();  // Rebind!
```

### Disposing Runtime

```typescript
// Cleanup
unsubscribe?.();
await runtime.dispose();
```

---

## Prompts

### Simple Prompt

```typescript
await session.prompt("Hello, can you help me?");
```

### Prompt with Images

```typescript
import { ImageContent } from "@mariozechner/pi-ai";

const image: ImageContent = {
  type: "image",
  data: base64Data,
  mimeType: "image/png"
};

await session.prompt({
  content: [
    { type: "text", text: "What's in this image?" },
    image
  ]
});
```

### Prompt Templates

```typescript
import { PromptTemplate } from "@mariozechner/pi-coding-agent";

const template = new PromptTemplate("implement.md", {
  fileName: "src/index.ts",
  feature: "user authentication"
});

await session.prompt(template.render());
```

---

## Tools

### Custom Tools

```typescript
import { Type } from "@sinclair/typebox";

session.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "What it does",
  parameters: Type.Object({
    input: Type.String({ description: "Input value" })
  }),
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    return {
      content: [{ type: "text", text: `Processed: ${params.input}` }],
      details: {}
    };
  }
});
```

### Tool Execution

```typescript
// Tools are executed by the LLM automatically
await session.prompt("Use my_tool to process 'hello'");

// Or call directly (advanced)
const result = await session.executeTool("my_tool", {
  input: "hello"
});
```

---

## Settings

### Override Settings

```typescript
import { SettingsManager } from "@mariozechner/pi-coding-agent";

const settingsManager = SettingsManager.inMemory({
  compaction: { enabled: false },
  retry: { enabled: true, maxRetries: 2 },
  theme: "dark"
});

const { session } = await createAgentSession({
  settingsManager
});
```

### Get/Set Settings

```typescript
// Get current settings
const settings = session.settingsManager.getSettings();

// Update settings
session.settingsManager.setSetting("compaction.enabled", false);
```

---

## Models

### Get Available Models

```typescript
const models = session.modelRegistry.getModels();

for (const model of models) {
  console.log(`${model.provider}/${model.id} - ${model.name}`);
}
```

### Switch Model

```typescript
const model = session.modelRegistry.find("anthropic", "claude-sonnet-4-20250514");

if (model) {
  const success = await session.setModel(model);
  if (success) {
    console.log("Model switched");
  } else {
    console.log("No API key for this model");
  }
}
```

### Set Thinking Level

```typescript
session.setThinkingLevel("high");
```

---

## Auth & OAuth

### API Keys

```typescript
import { AuthStorage } from "@mariozechner/pi-coding-agent";

const authStorage = AuthStorage.create();

// Set runtime key (not persisted)
authStorage.setRuntimeApiKey("anthropic", process.env.ANTHROPIC_API_KEY!);

// Get key for provider
const apiKey = await authStorage.getApiKeyForProvider("anthropic");
```

### OAuth Login

```typescript
// In interactive mode, user runs /login provider
// For programmatic OAuth:

const credentials = await session.modelRegistry.oauthLogin("my-provider");

// Credentials stored in authStorage automatically
```

---

## Context Files

### Load Context Files

```typescript
import { DefaultResourceLoader } from "@mariozechner/pi-coding-agent";

const loader = new DefaultResourceLoader({
  additionalContextPaths: ["./AGENTS.md", "./docs/CONTRIBUTING.md"]
});

await loader.reload();

const { session } = await createAgentSession({
  resourceLoader: loader
});
```

---

## Error Handling

### Session Errors

```typescript
session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.stopReason === "error") {
    console.error("LLM error:", event.assistantMessageEvent.errorMessage);
  }
});
```

### Tool Errors

```typescript
session.subscribe((event) => {
  if (event.type === "tool_execution_end" && event.result.isError) {
    console.error("Tool error:", event.result.content);
  }
});
```

### Abort Handling

```typescript
const controller = new AbortController();

session.subscribe((event) => {
  if (event.type === "message_update") {
    // Check for abort
    if (controller.signal.aborted) {
      session.abort();
    }
  }
});
```

---

## Complete Example

```typescript
import {
  createAgentSession,
  SessionManager,
  getModel
} from "@mariozechner/pi-coding-agent";

async function main() {
  // Create session with custom config
  const { session } = await createAgentSession({
    model: getModel("anthropic", "claude-sonnet-4-20250514"),
    thinkingLevel: "medium",
    sessionManager: SessionManager.inMemory()
  });
  
  // Subscribe to events
  session.subscribe((event) => {
    if (event.type === "message_update") {
      const ae = event.assistantMessageEvent;
      
      if (ae.type === "text_delta") {
        process.stdout.write(ae.delta);
      }
      
      if (ae.type === "text_end") {
        console.log();  // Newline
      }
    }
    
    if (event.type === "tool_execution_start") {
      console.log(`\n[Tool: ${event.toolName}]`);
    }
  });
  
  // Run prompts
  await session.prompt("What's in the current directory?");
  await session.prompt("Now create a file called hello.txt with 'Hello, World!'");
  
  // Access final state
  console.log("\n=== Session Summary ===");
  console.log(`Messages: ${session.state.messages.length}`);
  console.log(`Tools used: ${session.state.toolsUsed.size}`);
}

main().catch(console.error);
```

---

**Next Steps**:
- Read [PI-DEV-ARCHITECTURE.md](./PI-DEV-ARCHITECTURE.md) for internals
- Browse `$PI_CODING_AGENT_PACKAGE/examples/sdk/` for more examples
- Check `$PI_CODING_AGENT_PACKAGE/dist/sdk/` for type definitions


---

## New in Pi 0.67.4

### `--no-context-files` Flag

**When to use**: You need a clean run without automatic `AGENTS.md` / `CLAUDE.md` context file injection.

**CLI usage**:
```bash
pi --no-context-files -p "Your prompt here"
# or
pi -nc -p "Your prompt here"
```

**Programmatic usage**:
```typescript
import { loadProjectContextFiles } from "@mariozechner/pi-coding-agent";

// Inspect what would be loaded
const contextFiles = await loadProjectContextFiles(cwd);
console.log(contextFiles);  // Array of { path, content }

// But don't load them automatically
const { session } = await createAgentSession({
  // contextFiles: []  // Empty array = no context files
});
```

**Use cases**:
- Testing without project context influence
- Running with custom context loading logic
- Avoiding context file conflicts in automated workflows

---

### `loadProjectContextFiles()` Utility

**When to use**: Your extension or SDK integration needs to inspect the same context-file resolution order used by the CLI.

**Usage**:
```typescript
import { loadProjectContextFiles } from "@mariozechner/pi-coding-agent";

const cwd = process.cwd();
const contextFiles = await loadProjectContextFiles(cwd);

// contextFiles is an array of:
// [{ path: string, content: string }]

// Resolution order:
// 1. AGENTS.md in cwd
// 2. CLAUDE.md in cwd
// 3. .agents/AGENTS.md (if exists)
// 4. .agents/CLAUDE.md (if exists)

for (const file of contextFiles) {
  console.log(`Loaded: ${file.path}`);
  console.log(`Content: ${file.content.substring(0, 100)}...`);
}
```

**Integration with custom context loading**:
```typescript
const { session } = await createAgentSession({
  resourceLoader: new DefaultResourceLoader({
    additionalContextPaths: [
      ... (await loadProjectContextFiles(cwd)).map(f => f.path),
      "./docs/CONTRIBUTING.md"  // Add your own
    ]
  })
});
```

---

## New in Pi 0.65.0

### `AgentSessionRuntime` for Session Replacement

**When to use**: You need to programmatically switch sessions (`/new`, `/resume`, `/fork`) in SDK usage.

**Before** (removed in 0.65.0):
```typescript
// ❌ No longer available
await session.newSession();
await session.switchSession("/path/to/session.jsonl");
```

**After** (using runtime):
```typescript
import {
  createAgentSessionRuntime,
  createAgentSessionServices,
  createAgentSessionFromServices,
  SessionManager,
  type CreateAgentSessionRuntimeFactory
} from "@mariozechner/pi-coding-agent";

// Create runtime factory
const createRuntime: CreateAgentSessionRuntimeFactory = async ({
  cwd,
  sessionManager,
  sessionStartEvent
}) => {
  const services = await createAgentSessionServices({ cwd });
  
  return {
    ...(await createAgentSessionFromServices({
      services,
      sessionManager,
      sessionStartEvent
    })),
    services,
    diagnostics: services.diagnostics
  };
};

// Initialize runtime
const runtime = await createAgentSessionRuntime(createRuntime, {
  cwd: process.cwd(),
  sessionManager: SessionManager.create(process.cwd())
});

// Use runtime for session operations
await runtime.newSession();
await runtime.switchSession("/path/to/session.jsonl");
await runtime.fork("entry-id");

// Rebind subscriptions after session replacement
let unsubscribe = runtime.session.subscribe(handleEvent);

// After switching sessions
await runtime.switchSession(newSessionFile);
unsubscribe();  // Clean up old subscription
unsubscribe = runtime.session.subscribe(handleEvent);  // Subscribe to new session
```

**Key points**:
- Runtime recreates cwd-bound services on every session switch
- All session operations (`new`, `resume`, `fork`, `import`) use the same creation path
- Must rebind subscriptions after session replacement
- `runtime.session` is the new live session after replacement

**Related**: `$PI_CODING_AGENT_PACKAGE/examples/sdk/13-session-runtime.ts` for complete example

---

### `ctx.signal` for Cancellation (New in 0.63.1)

**When to use**: Your extension needs to forward cancellation into nested async operations.

**Usage**:
```typescript
pi.on("tool_call", async (event, ctx) => {
  try {
    const result = await doWork({
      signal: ctx.signal,  // Forward cancellation
      onProgress: (p) => onUpdate?.({ progress: p })
    });
    
    return { content: [{ type: "text", text: result }] };
  } catch (error) {
    if (ctx.signal.aborted) {
      return { content: [{ type: "text", text: "Cancelled" }], isError: true };
    }
    throw error;
  }
});

// Nested model calls
async function callNestedModel(messages: Message[]) {
  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
  const stream = streamSimple(model, messages, {
    apiKey: auth.apiKey,
    headers: auth.headers,
    signal: ctx.signal  // Forward cancellation
  });
  
  // Process stream...
}
```

**Benefits**:
- Extension handlers respect user cancellation (Ctrl+C)
- Prevents wasted work on cancelled operations
- Cleaner shutdown behavior

