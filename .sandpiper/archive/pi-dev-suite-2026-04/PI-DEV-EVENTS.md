# Pi Extension Events Reference

**Target**: Extension developers implementing event handlers  
**Related**: [PI-DEV-ARCHITECTURE.md](./PI-DEV-ARCHITECTURE.md), [PI-DEV-QUICKSTART.md](./PI-DEV-QUICKSTART.md)

---

## Event System Overview

Pi uses a **publish-subscribe event system** for extension integration. Extensions subscribe to events and can:
- **Observe** agent behavior (read-only)
- **Modify** inputs/outputs (transform)
- **Block** operations (prevent execution)
- **Inject** new content (messages, prompts)

### Event Flow

```
session_start
  ↓
resources_discover
  ↓
[user prompt]
  ↓
input (text transformation)
  ↓
before_agent_start (prompt modification)
  ↓
agent_start
  ↓
turn_start
  ↓
context (message filtering)
  ↓
[LLM processing]
  ↓
tool_call (intercept/blocks)
  ↓
tool_execution_start
  ↓
tool_result (modify results)
  ↓
tool_execution_end
  ↓
turn_end
  ↓
[repeat turns...]
  ↓
agent_end
  ↓
[session end or continue]
```

---

## Complete Event Reference

### Session Lifecycle Events

#### `session_start`

**When**: Session initialized (new, resume, switch, fork)  
**Handler**: `async (event: SessionStartEvent, ctx: ExtensionContext) => void`  
**Return**: `void`  
**Use cases**: Initialize extension state, scan resources, restore from session

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function(pi: ExtensionAPI) {
  pi.on("session_start", async (event, ctx) => {
    // event.reason: "new" | "resume" | "switch" | "fork"
    // event.sessionFile: path to session file
    
    ctx.ui.notify(`Session ${event.reason}: ${ctx.cwd}`, "info");
    
    // Restore state from session entries
    const entries = ctx.sessionManager.getEntries();
    const stateEntry = entries.find(
      e => e.type === "custom" && e.customType === "my-extension"
    );
    if (stateEntry) {
      // Restore state
    }
  });
}
```

**Source**: `$PI_CODING_AGENT_PACKAGE/dist/core/agent-session.js`

---

#### `session_shutdown`

**When**: Session is closing (quit, switch, error)  
**Handler**: `async (event: SessionShutdownEvent, ctx: ExtensionContext) => void`  
**Return**: `void`  
**Use cases**: Cleanup, save state, close connections

```typescript
pi.on("session_shutdown", async (event, ctx) => {
  // event.reason: "quit" | "switch" | "error"
  
  // Clear intervals
  if (this.interval) {
    clearInterval(this.interval);
  }
  
  // Save final state
  pi.appendEntry("my-extension", { finalState: this.state });
});
```

---

#### `session_before_switch`

**When**: Before switching sessions (new, resume)  
**Handler**: `async (event: SessionBeforeSwitchEvent, ctx: ExtensionContext) => Promise<{ cancel?: boolean } | undefined>`  
**Return**: `{ cancel: true }` to cancel, `undefined` to allow  
**Use cases**: Confirm destructive actions, check for unsaved work

```typescript
pi.on("session_before_switch", async (event, ctx) => {
  // event.reason: "new" | "resume"
  // event.targetSession: target session path
  
  if (event.reason === "new") {
    const confirmed = await ctx.ui.confirm(
      "Clear session?",
      "This will delete all messages."
    );
    
    if (!confirmed) {
      return { cancel: true };
    }
  }
  
  // Check for uncommitted git changes
  const { stdout } = await pi.exec("git", ["status", "--porcelain"]);
  if (stdout.trim()) {
    const choice = await ctx.ui.select(
      "Uncommitted changes",
      ["Proceed anyway", "Cancel"]
    );
    
    if (choice !== "Proceed anyway") {
      return { cancel: true };
    }
  }
  
  return undefined;  // Allow
});
```

**Source**: `$PI_CODING_AGENT_PACKAGE/dist/core/session-manager.js`

---

#### `session_before_fork`

**When**: Before forking session from an entry  
**Handler**: `async (event: SessionBeforeForkEvent, ctx: ExtensionContext) => Promise<{ cancel?: boolean } | undefined>`  
**Return**: `{ cancel: true }` to cancel, `undefined` to allow  
**Use cases**: Confirm fork, restore code state from checkpoint

```typescript
pi.on("session_before_fork", async (event, ctx) => {
  // event.entryId: entry to fork from
  // event.reason: "fork"
  
  const choice = await ctx.ui.select(
    `Fork from entry ${event.entryId.slice(0, 8)}?`,
    ["Yes, create fork", "No, stay"]
  );
  
  if (choice !== "Yes, create fork") {
    return { cancel: true };
  }
  
  return undefined;
});
```

---

#### `session_tree`

**When**: After navigating session tree (`/tree` command)  
**Handler**: `async (event: SessionTreeEvent, ctx: ExtensionContext) => void`  
**Return**: `void`  
**Use cases**: Restore state for new branch position

```typescript
pi.on("session_tree", async (event, ctx) => {
  // event.newLeafId: new position in tree
  // event.oldLeafId: previous position
  // event.summaryEntry: optional branch summary
  
  // Restore state from new branch
  const branch = ctx.sessionManager.getBranch();
  this.state = reconstructState(branch);
});
```

---

### Turn Lifecycle Events

#### `turn_start`

**When**: Before each LLM turn  
**Handler**: `async (event: TurnStartEvent, ctx: ExtensionContext) => void`  
**Return**: `void`  
**Use cases**: Create checkpoints, update status, increment counters

```typescript
pi.on("turn_start", async (event, ctx) => {
  // event.turnNumber: current turn number
  
  // Update status
  ctx.ui.setStatus("turn", `Turn ${event.turnNumber}...`);
  
  // Create git checkpoint
  await pi.exec("git", ["stash", "create"]);
  
  // Persist state
  pi.appendEntry("my-extension", { turn: event.turnNumber });
});
```

---

#### `turn_end`

**When**: After LLM turn completes  
**Handler**: `async (event: TurnEndEvent, ctx: ExtensionContext) => void`  
**Return**: `void`  
**Use cases**: Extract progress, check context usage, trigger compaction

```typescript
pi.on("turn_end", async (event, ctx) => {
  // event.message: assistant message
  // event.usage: token usage
  
  // Check context usage
  const usage = ctx.getContextUsage();
  if (usage.tokens > 100_000) {
    ctx.ui.notify("Context usage high, consider compaction", "warning");
  }
  
  // Extract [DONE:n] markers from plan mode
  const text = event.message.content
    .filter(c => c.type === "text")
    .map(c => c.text)
    .join("\n");
  
  const doneSteps = text.match(/\[DONE:(\d+)\]/g);
  if (doneSteps) {
    markStepsComplete(doneSteps);
  }
});
```

---

#### `agent_start`

**When**: Before agent begins processing (all turns)  
**Handler**: `async (event: AgentStartEvent, ctx: ExtensionContext) => void`  
**Return**: `void`  
**Use cases**: Start animations, update title, log start

```typescript
pi.on("agent_start", async (event, ctx) => {
  // Start title spinner
  startTitleSpinner(ctx);
  
  // Log to file
  logAgentStart(new Date());
});
```

---

#### `agent_end`

**When**: After agent completes all turns  
**Handler**: `async (event: AgentEndEvent, ctx: ExtensionContext) => void`  
**Return**: `void`  
**Use cases**: Stop animations, send notifications, auto-commit

```typescript
pi.on("agent_end", async (event, ctx) => {
  // event.messages: all messages in conversation
  
  // Stop spinner
  stopTitleSpinner();
  
  // Send notification
  if (ctx.hasUI) {
    ctx.ui.notify("Agent done, ready for input", "info");
  }
  
  // Auto-commit on exit
  const { stdout } = await pi.exec("git", ["status", "--porcelain"]);
  if (stdout.trim()) {
    const lastMessage = event.messages
      .filter(m => m.role === "assistant")
      .pop();
    
    if (lastMessage) {
      await pi.exec("git", ["add", "-A"]);
      await pi.exec("git", ["commit", "-m", "[pi] Work in progress"]);
    }
  }
});
```

---

### Tool Events

#### `tool_call`

**When**: Before tool execution  
**Handler**: `async (event: ToolCallEvent, ctx: ExtensionContext) => Promise<{ block?: boolean, reason?: string } | undefined>`  
**Return**: `{ block: true, reason: "..." }` to block, `undefined` to allow  
**Use cases**: Permission gates, input validation, access control

```typescript
pi.on("tool_call", async (event, ctx) => {
  // event.toolName: "read" | "bash" | "edit" | "write" | ...
  // event.input: tool parameters
  // event.toolCallId: unique ID
  
  if (event.toolName === "bash") {
    const command = event.input.command as string;
    
    // Block dangerous commands
    if (/\brm\s+(-rf?|--recursive)/i.test(command)) {
      if (!ctx.hasUI) {
        return { block: true, reason: "Dangerous (no UI)" };
      }
      
      const ok = await ctx.ui.confirm(
        "⚠️ Dangerous Command",
        `Allow?\n\n  ${command}`
      );
      
      if (!ok) {
        return { block: true, reason: "Blocked by user" };
      }
    }
  }
  
  if (event.toolName === "write") {
    const path = event.input.path as string;
    
    // Block protected paths
    if (path.includes(".env") || path.includes("node_modules/")) {
      return { block: true, reason: `Protected path: ${path}` };
    }
  }
  
  return undefined;  // Allow
});
```

**Source**: `$PI_CODING_AGENT_PACKAGE/dist/core/agent-session.js`

---

#### `tool_result`

**When**: After tool execution completes  
**Handler**: `async (event: ToolResultEvent, ctx: ExtensionContext) => Promise<{ modify?: ToolResult } | undefined>`  
**Return**: `{ modify: newResult }` to change result, `undefined` to keep original  
**Use cases**: Result filtering, output augmentation, logging

```typescript
pi.on("tool_result", async (event, ctx) => {
  // event.toolName: tool that executed
  // event.result: tool result
  // event.toolCallId: matching call ID
  
  // Log all file reads
  if (event.toolName === "read") {
    logFileAccess(event.input.path, event.result);
  }
  
  // Augment bash output with timestamp
  if (event.toolName === "bash") {
    const text = event.result.content
      .filter(c => c.type === "text")
      .map(c => c.text)
      .join("\n");
    
    return {
      modify: {
        ...event.result,
        content: [{
          type: "text",
          text: `[${new Date().toISOString()}]\n${text}`
        }]
      }
    };
  }
  
  return undefined;
});
```

---

#### `tool_execution_start`

**When**: Tool execution begins  
**Handler**: `async (event: ToolExecutionStartEvent, ctx: ExtensionContext) => void`  
**Return**: `void`  
**Use cases**: Progress indicators, logging

```typescript
pi.on("tool_execution_start", async (event, ctx) => {
  ctx.ui.setStatus("tool", `Running ${event.toolName}...`);
});
```

---

#### `tool_execution_end`

**When**: Tool execution completes  
**Handler**: `async (event: ToolExecutionEndEvent, ctx: ExtensionContext) => void`  
**Return**: `void`  
**Use cases**: Clear status, update metrics

```typescript
pi.on("tool_execution_end", async (event, ctx) => {
  ctx.ui.setStatus("tool", undefined);
});
```

---

### Message Events

#### `input`

**When**: User submits input (before processing)  
**Handler**: `async (event: InputEvent, ctx: ExtensionContext) => Promise<{ action: "transform" | "continue", text?: string, images?: ImageContent[] } | undefined>`  
**Return**: `{ action: "transform", text: "..." }` to modify, `{ action: "continue" }` to proceed  
**Use cases**: Inline command expansion, text transformation

```typescript
pi.on("input", async (event, ctx) => {
  const text = event.text;
  
  // Skip whole-line bash commands
  if (text.trimStart().startsWith("!")) {
    return { action: "continue" };
  }
  
  // Expand !{command} patterns
  const PATTERN = /!\{([^}]+)\}/g;
  if (!PATTERN.test(text)) {
    return { action: "continue" };
  }
  
  let result = text;
  for (const match of text.matchAll(PATTERN)) {
    const command = match[1];
    const { stdout } = await pi.exec("bash", ["-c", command]);
    result = result.replace(match[0], stdout.trim());
  }
  
  ctx.ui.notify(`Expanded: ${result}`, "info");
  
  return {
    action: "transform",
    text: result,
    images: event.images
  };
});
```

---

#### `context`

**When**: Building context for LLM  
**Handler**: `async (event: ContextEvent, ctx: ExtensionContext) => Promise<{ messages: Message[] } | undefined>`  
**Return**: `{ messages: filteredMessages }` to modify, `undefined` to keep original  
**Use cases**: Filter stale messages, inject context

```typescript
pi.on("context", async (event) => {
  // event.messages: all messages
  
  // Remove stale plan mode context
  return {
    messages: event.messages.filter(m => {
      const msg = m as any;
      if (msg.customType === "plan-mode-context") {
        return false;
      }
      return true;
    })
  };
});
```

---

#### `before_agent_start`

**When**: Before each agent turn (can modify prompt)  
**Handler**: `async (event: BeforeAgentStartEvent, ctx: ExtensionContext) => Promise<{ systemPrompt?: string, message?: CustomMessage } | undefined>`  
**Return**: Modified prompt and/or injected message  
**Use cases**: Dynamic personality, mode injection, context-specific guidance

```typescript
pi.on("before_agent_start", async (event, ctx) => {
  // event.systemPrompt: current prompt
  
  // Add mode-specific instructions
  if (this.formalMode) {
    return {
      systemPrompt: event.systemPrompt + `

FORMAL MODE: Use professional language, complete sentences, technical precision.`
    };
  }
  
  // Inject context message
  if (this.currentTask) {
    return {
      message: {
        customType: "task-context",
        content: `Current task: ${this.currentTask}`,
        display: false  // Don't show in chat
      }
    };
  }
  
  return undefined;
});
```

**Source**: `$PI_CODING_AGENT_PACKAGE/dist/core/agent-session.js`

---

### Model Events

#### `model_select`

**When**: Model changes (command, cycling, restore)  
**Handler**: `async (event: ModelSelectEvent, ctx: ExtensionContext) => void`  
**Return**: `void`  
**Use cases**: Status updates, logging, model-specific configuration

```typescript
pi.on("model_select", async (event, ctx) => {
  // event.model: new model
  // event.previousModel: old model (or undefined)
  // event.source: "command" | "cycle" | "restore" | "preset"
  
  ctx.ui.setStatus("model", `🤖 ${event.model.id}`);
  
  if (event.source !== "restore") {
    ctx.ui.notify(`Model: ${event.model.provider}/${event.model.id}`, "info");
  }
  
  // Model-specific configuration
  if (event.model.id.includes("opus")) {
    this.highReasoningMode = true;
  }
});
```

---

### Compaction Events

#### `session_before_compact`

**When**: Before context compaction  
**Handler**: `async (event: SessionBeforeCompactEvent, ctx: ExtensionContext) => Promise<{ compaction?: { summary: string, firstKeptEntryId: string, tokensBefore: number } } | undefined>`  
**Return**: Custom compaction or `undefined` for default  
**Use cases**: Custom summarization, different model for summary

```typescript
import { complete } from "@mariozechner/pi-ai";
import { convertToLlm, serializeConversation } from "@mariozechner/pi-coding-agent";

pi.on("session_before_compact", async (event, ctx) => {
  const { preparation, signal } = event;
  const { messagesToSummarize, turnPrefixMessages, tokensBefore, firstKeptEntryId } = preparation;
  
  // Use cheaper model for summarization
  const model = ctx.modelRegistry.find("google", "gemini-2.5-flash");
  if (!model) return undefined;
  
  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
  if (!auth.ok || !auth.apiKey) return undefined;
  
  // Combine all messages
  const allMessages = [...messagesToSummarize, ...turnPrefixMessages];
  const conversationText = serializeConversation(convertToLlm(allMessages));
  
  // Generate comprehensive summary
  const response = await complete(
    model,
    {
      messages: [{
        role: "user",
        content: [{
          type: "text",
          text: `Summarize this conversation:

1. Main goals and objectives
2. Key decisions and rationale
3. Important code changes
4. Current state of work
5. Open questions
6. Next steps

<conversation>
${conversationText}
</conversation>`
        }]
      }]
    },
    { apiKey: auth.apiKey, headers: auth.headers, maxTokens: 8192, signal }
  );
  
  const summary = response.content
    .filter((c): c is { type: "text", text: string } => c.type === "text")
    .map(c => c.text)
    .join("\n");
  
  if (!summary.trim()) return undefined;
  
  return {
    compaction: {
      summary,
      firstKeptEntryId,
      tokensBefore
    }
  };
});
```

**Source**: `$PI_CODING_AGENT_PACKAGE/dist/core/session-manager.js`

---

### Resource Events

#### `resources_discover`

**When**: Discovering resources (extensions, skills, prompts, themes)  
**Handler**: `async (event: ResourcesDiscoverEvent, ctx: ExtensionContext) => Promise<{ skillPaths?: string[], promptPaths?: string[], themePaths?: string[] } | undefined>`  
**Return**: Additional resource paths or `undefined`  
**Use cases**: Dynamic resource loading

```typescript
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const baseDir = dirname(fileURLToPath(import.meta.url));

pi.on("resources_discover", () => {
  return {
    skillPaths: [join(baseDir, "SKILL.md")],
    promptPaths: [join(baseDir, "dynamic.md")],
    themePaths: [join(baseDir, "dynamic.json")]
  };
});
```

---

### User Bash Event

#### `user_bash`

**When**: User runs `!command` (before execution)  
**Handler**: `async (event: UserBashEvent, ctx: ExtensionContext) => Promise<{ result?: BashResult, operations?: BashOperations } | undefined>`  
**Return**: Custom result or operations, or `undefined` for normal handling  
**Use cases**: Interactive commands, SSH delegation, sandboxing

```typescript
import { spawnSync } from "node:child_process";

pi.on("user_bash", async (event, ctx) => {
  const command = event.command;
  
  // Check for interactive command
  if (isInteractiveCommand(command)) {
    if (!ctx.hasUI) {
      return {
        result: {
          output: "(requires TUI)",
          exitCode: 1,
          cancelled: false,
          truncated: false
        }
      };
    }
    
    // Run with full terminal access
    const exitCode = await ctx.ui.custom<number>((tui, _theme, _kb, done) => {
      tui.stop();  // Suspend TUI
      process.stdout.write("\x1b[2J\x1b[H");  // Clear screen
      
      const result = spawnSync(process.env.SHELL || "/bin/sh", ["-c", command], {
        stdio: "inherit"
      });
      
      tui.start();  // Resume TUI
      tui.requestRender(true);
      
      done(result.status);
      return { render: () => [], invalidate: () => {} };
    });
    
    return {
      result: {
        output: `(completed with exit ${exitCode})`,
        exitCode,
        cancelled: false,
        truncated: false
      }
    };
  }
  
  return undefined;  // Normal handling
});
```

---

## Event Ordering

### Full Session Flow

```
1. session_start
2. resources_discover
3. [User types prompt]
4. input (transformation)
5. before_agent_start (prompt modification)
6. agent_start
7. turn_start
8. context (message filtering)
9. [LLM processes]
10. tool_call (for each tool)
    - tool_execution_start
    - [Tool executes]
    - tool_result
    - tool_execution_end
11. turn_end
12. [Repeat 7-11 for each turn]
13. agent_end
14. [User types next prompt OR session ends]
15. session_shutdown (on quit/switch)
```

### Event Timing Diagram

```
Session Lifetime
├─ session_start
├─ resources_discover
│
├─ Turn 1
│  ├─ before_agent_start
│  ├─ agent_start
│  ├─ turn_start
│  ├─ context
│  ├─ tool_call → tool_result (×N)
│  └─ turn_end
│
├─ Turn 2
│  ├─ before_agent_start
│  ├─ agent_start
│  ├─ turn_start
│  ├─ context
│  ├─ tool_call → tool_result (×N)
│  └─ turn_end
│
├─ agent_end
│
└─ session_shutdown (on quit/switch/fork)
```

---

## Handler Best Practices

### ✅ DO: Return Explicit Values

```typescript
// Good - explicit return
pi.on("tool_call", async (event) => {
  if (shouldBlock(event)) {
    return { block: true, reason: "Blocked" };
  }
  return undefined;  // Explicit allow
});
```

### ✅ DO: Handle Errors Gracefully

```typescript
pi.on("session_start", async (event, ctx) => {
  try {
    await initializeExtension(ctx);
  } catch (error) {
    ctx.ui.notify(`Extension init failed: ${error.message}`, "error");
    // Don't throw - won't crash session but extension won't work
  }
});
```

### ✅ DO: Check for UI Availability

```typescript
pi.on("tool_call", async (event, ctx) => {
  if (!ctx.hasUI) {
    // Can't show dialogs in RPC/non-interactive mode
    return { block: true, reason: "No UI for confirmation" };
  }
  // Safe to use ctx.ui.confirm()
});
```

### ✅ DO: Use Abort Signals

```typescript
pi.on("tool_call", async (event, ctx) => {
  const result = await someAsyncOperation({
    signal: event.signal  // Honor cancellation
  });
  // ...
});
```

### ❌ DON'T: Block the Event Loop

```typescript
// Bad - synchronous blocking
pi.on("session_start", () => {
  const data = fs.readFileSync("large-file.json");  // Blocks!
});

// Good - async
pi.on("session_start", async () => {
  const data = await fs.promises.readFile("large-file.json");
});
```

### ❌ DON'T: Throw Unhandled Errors

```typescript
// Bad - unhandled error
pi.on("tool_call", async () => {
  throw new Error("Oops!");  // Crashes extension
});

// Good - handled
pi.on("tool_call", async () => {
  try {
    // ...
  } catch (error) {
    console.error("Extension error:", error);
    return undefined;  // Allow to proceed
  }
});
```

---

## Debugging Events

### Enable Event Logging

```bash
PI_DEBUG=extensions pi
```

Logs all events and handlers.

### Log Event Details

```typescript
pi.on("tool_call", async (event, ctx) => {
  console.log("[tool_call]", {
    tool: event.toolName,
    input: event.input,
    callId: event.toolCallId
  });
});
```

### Test Event Handlers

```typescript
// Minimal test extension
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function testExtension(pi: ExtensionAPI) {
  const events = ["session_start", "tool_call", "turn_start", "agent_end"];
  
  for (const event of events) {
    pi.on(event as any, async (...args) => {
      console.log(`[${event}]`, args);
      ctx.ui.notify(`${event} fired`, "info");
    });
  }
}
```

---

**Next Steps**: 
- Read [PI-DEV-TOOLS.md](./PI-DEV-TOOLS.md) for tool-specific patterns
- Read [PI-DEV-STATE.md](./PI-DEV-STATE.md) for state persistence
- Browse examples at `$PI_CODING_AGENT_PACKAGE/examples/extensions/`

---

## New in Pi 0.67.4

### `after_provider_response` Hook

**When to read**: You need to inspect HTTP status codes or headers from provider responses before stream consumption

**Event signature**:
```typescript
pi.on("after_provider_response", async (event, ctx) => {
  // event.statusCode: number
  // event.headers: Headers
  // event.provider: string
  // event.model: string
  
  // Log rate limit headers
  if (event.headers.has("x-ratelimit-remaining")) {
    console.log(`Rate limit remaining: ${event.headers.get("x-ratelimit-remaining")}`);
  }
  
  // No return value expected - this is a notification hook
});
```

**Use cases**:
- Rate limit monitoring and alerting
- Custom retry logic based on response headers
- Logging response metadata for debugging
- Provider-specific error handling

**Related**: [PI-DEV-TOOLS.md](./PI-DEV-TOOLS.md) for tool-level error handling

---

## Event Reference Updates

### `session_start` Event (Updated in 0.65.0+)

**Event reason values**:
- `"startup"` - Initial session start
- `"reload"` - Extension reload via `/reload`
- `"new"` - New session via `/new` or `--new`
- `"resume"` - Resumed existing session
- `"fork"` - Forked from existing session

**For `"new"`, `"resume"`, and `"fork"`**:
- `event.previousSessionFile` is set to the source session path

**Migration from removed events**:
```typescript
// ❌ Old (removed in 0.65.0)
pi.on("session_switch", handler);
pi.on("session_fork", handler);
pi.on("session_directory", handler);

// ✅ New
pi.on("session_start", async (event, ctx) => {
  switch (event.reason) {
    case "new":
    case "resume":
    case "fork":
      console.log(`From: ${event.previousSessionFile}`);
      break;
  }
});
```

