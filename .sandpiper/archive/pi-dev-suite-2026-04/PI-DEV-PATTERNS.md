# Pi Extension Patterns & Best Practices

**Target**: All extension developers  
**Related**: All other docs in this suite

---

## Extension Design Patterns

### Initialization Pattern

```typescript
let state: ExtensionState;

pi.on("session_start", async (_event, ctx) => {
  // Initialize on every session start
  state = initialState();
  
  // Restore from session if resuming
  if (ctx.sessionManager.getLeafEntry()) {
    state = restoreFromSession(ctx);
  }
  
  ctx.ui.notify("Extension loaded", "info");
});

pi.on("session_shutdown", async () => {
  // Cleanup on session end
  if (this.interval) clearInterval(this.interval);
});
```

### State Persistence Pattern

```typescript
// Store in tool result details
return {
  content: [{ type: "text", text: "Done" }],
  details: { todos, nextId }  // Persisted in session
};

// Reconstruct from branch
function restoreFromSession(ctx: ExtensionContext) {
  const branch = ctx.sessionManager.getBranch();
  let state = initialState();
  
  for (const entry of branch) {
    if (entry.type === "message" && entry.message.toolName === "todo") {
      state = {
        todos: entry.message.details.todos,
        nextId: entry.message.details.nextId
      };
    }
  }
  
  return state;
}
```

### Command + Tool Pattern

```typescript
// Tool for LLM
pi.registerTool({
  name: "todo",
  label: "Todo",
  description: "Manage todos (LLM calls this)",
  // ...
});

// Command for user
pi.registerCommand("todos", {
  description: "Show todos (user types /todos)",
  handler: async (_args, ctx) => {
    await ctx.ui.custom((tui, theme, _kb, done) => {
      return new TodoListComponent(todos, theme, done);
    });
  }
});
```

---

## Tool Design Patterns

### Truncation Pattern

```typescript
import { truncateHead, DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES } from "@mariozechner/pi-coding-agent";

async execute(_toolCallId, params) {
  const output = await runCommand(params);
  
  const truncation = truncateHead(output, {
    maxLines: DEFAULT_MAX_LINES,
    maxBytes: DEFAULT_MAX_BYTES
  });
  
  let text = truncation.content;
  
  if (truncation.truncated) {
    const tempFile = await saveFullOutput(output);
    text += `\n\n[Truncated: ${truncation.outputLines}/${truncation.totalLines} lines. Full: ${tempFile}]`;
  }
  
  return {
    content: [{ type: "text", text }],
    details: { truncation, fullOutputPath: tempFile }
  };
}
```

### Override Built-in Pattern

```typescript
const originalRead = createReadTool(cwd);

pi.registerTool({
  ...originalRead,
  name: "read",  // Same name = override
  label: "read (audited)",
  
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // Add behavior
    await logAccess(params.path);
    
    // Delegate to original
    return originalRead.execute(toolCallId, params, signal, onUpdate);
  }
  
  // No renderCall/renderResult = uses built-in renderer
});
```

### Streaming Updates Pattern

```typescript
async execute(_toolCallId, params, signal, onUpdate) {
  for (let i = 0; i < params.steps; i++) {
    if (signal.aborted) {
      return { content: [{ type: "text", text: "Aborted" }], details: { completed: i } };
    }
    
    onUpdate?.({
      content: [{ type: "text", text: `Step ${i + 1}/${params.steps}...` }],
      details: { progress: (i + 1) / params.steps }
    });
    
    await doWork(i);
  }
  
  return { content: [{ type: "text", text: "Done!" }], details: { completed: params.steps } };
}
```

---

## UI Design Patterns

### Caching Pattern

```typescript
class MyComponent {
  private cachedWidth?: number;
  private cachedLines?: string[];
  private version = 0;
  
  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;  // Cache hit
    }
    
    // Expensive render logic
    this.cachedLines = this.doRender(width);
    this.cachedWidth = width;
    return this.cachedLines;
  }
  
  invalidate() {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
  
  updateState(newState: State) {
    this.state = newState;
    this.version++;
    this.invalidate();
  }
}
```

### Theme Integration Pattern

```typescript
render(width: number): string[] {
  const lines: string[] = [];
  
  // Use theme colors
  lines.push(theme.fg("accent", "Title"));
  lines.push(theme.fg("muted", "Subtitle"));
  lines.push(theme.fg("success", "✓ Success"));
  lines.push(theme.fg("error", "✗ Error"));
  
  // Use theme backgrounds
  const box = new Box(1, 1, (s) => theme.bg("customMessageBg", s));
  
  return lines;
}
```

### Dialog Pattern

```typescript
const result = await ctx.ui.custom<T | null>((tui, theme, _kb, done) => {
  const component = new MyDialog(tui, theme, done);
  
  component.onConfirm = (value) => done(value);
  component.onCancel = () => done(null);
  
  return {
    render(width) { return component.render(width); },
    invalidate() { component.invalidate(); },
    handleInput(data) {
      component.handleInput(data);
      tui.requestRender();
    }
  };
});

if (result !== null) {
  // User confirmed
} else {
  // User cancelled
}
```

---

## State Management Patterns

### Branch-Aware State

```typescript
// ✅ Correct
pi.on("session_start", async (_event, ctx) => {
  state = restoreFrom(ctx.sessionManager.getBranch());
});

pi.on("session_tree", async (_event, ctx) => {
  state = restoreFrom(ctx.sessionManager.getBranch());
});

// ❌ Wrong
pi.on("session_start", async (_event, ctx) => {
  state = restoreFrom(ctx.sessionManager.getEntries());  // Includes all branches!
});
```

### Module State Anti-Pattern

```typescript
// ❌ Wrong - breaks on reload/branching
let counter = 0;

export default function(pi: ExtensionAPI) {
  pi.registerTool({
    name: "increment",
    async execute() {
      counter++;  // Resets on reload!
      return { content: [...], details: { counter } };
    }
  });
}

// ✅ Correct - session state
export default function(pi: ExtensionAPI) {
  let counter = 0;
  
  pi.on("session_start", async () => {
    counter = 0;  // Reset on new session
  });
  
  pi.registerTool({
    name: "increment",
    async execute() {
      counter++;
      return {
        content: [{ type: "text", text: `Count: ${counter}` }],
        details: { counter }  // Persisted
      };
    }
  });
}
```

---

## Token Efficiency Patterns

### Collapsed/Expanded Rendering

```typescript
renderResult(result, { expanded }, theme) {
  if (!expanded) {
    // Collapsed: minimal
    return new Text(theme.fg("success", "✓ Done"), 0, 0);
  }
  
  // Expanded: full details
  return new Text(result.content[0].text, 0, 0);
}
```

### Progressive Disclosure

```typescript
renderResult(result, { expanded }, theme) {
  const details = result.details as MyDetails;
  
  if (!expanded) {
    // Show first 5 items
    const display = details.items.slice(0, 5);
    let text = display.map(item => theme.fg("muted", `  ${item}`)).join("\n");
    
    if (details.items.length > 5) {
      text += `\n${theme.fg("dim", `... ${details.items.length - 5} more`)}`;
    }
    
    return new Text(text, 0, 0);
  }
  
  // Show all items
  return new Text(
    details.items.map(item => theme.fg("muted", `  ${item}`)).join("\n"),
    0, 0
  );
}
```

### Summary Instead of Full Context

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  const { preparation } = event;
  const allMessages = [...preparation.messagesToSummarize, ...preparation.turnPrefixMessages];
  
  const summary = await generateSummary(allMessages);
  
  return {
    compaction: {
      summary,  // 2K tokens instead of 50K
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore
    }
  };
});
```

---

## Security Patterns

### Input Validation

```typescript
const dangerousPatterns = [
  /\brm\s+(-rf?|--recursive)/i,
  /\bsudo\b/i,
  /\b(chmod|chown)\b.*777/i
];

pi.on("tool_call", async (event, ctx) => {
  if (event.toolName !== "bash") return undefined;
  
  const command = event.input.command as string;
  const isDangerous = dangerousPatterns.some(p => p.test(command));
  
  if (!isDangerous) return undefined;
  
  if (!ctx.hasUI) {
    return { block: true, reason: "Dangerous (no UI)" };
  }
  
  const ok = await ctx.ui.confirm("⚠️ Dangerous", "Allow?");
  if (!ok) return { block: true, reason: "Blocked" };
  
  return undefined;
});
```

### Path Protection

```typescript
const protectedPaths = [".env", ".git/", "node_modules/"];

pi.on("tool_call", async (event) => {
  if (event.toolName === "write" || event.toolName === "edit") {
    const path = event.input.path as string;
    
    if (protectedPaths.some(p => path.includes(p))) {
      return { block: true, reason: `Protected: ${path}` };
    }
  }
  
  return undefined;
});
```

### Non-Interactive Mode Handling

```typescript
pi.on("tool_call", async (event, ctx) => {
  if (!ctx.hasUI) {
    // Can't show dialogs in RPC mode
    return { block: true, reason: "Requires UI" };
  }
  
  // Safe to use ctx.ui.confirm()
  const ok = await ctx.ui.confirm("Sure?", "Really?");
  // ...
});
```

---

## Error Handling Patterns

### Graceful Degradation

```typescript
pi.on("session_start", async (_event, ctx) => {
  try {
    await initializeExtension(ctx);
  } catch (error) {
    ctx.ui.notify(`Init failed: ${error.message}`, "error");
    // Extension won't work, but session continues
  }
});
```

### Abort Signal Handling

```typescript
async execute(_toolCallId, params, signal, onUpdate) {
  try {
    const result = await doWork({
      signal,  // Honor cancellation
      onProgress: (p) => onUpdate?.({ content: [{ type: "text", text: `${p}%` }], details: { progress: p } })
    });
    
    return { content: [{ type: "text", text: "Done" }], details: result };
  } catch (error) {
    if (signal.aborted) {
      return { content: [{ type: "text", text: "Aborted" }], details: {} };
    }
    throw error;  // Re-throw non-abort errors
  }
}
```

---

## Code Organization Patterns

### File Structure

```
my-extension/
├── index.ts          # Extension entry point
├── types.ts          # TypeScript types
├── utils.ts          # Helper functions
├── component.ts      # Custom TUI component
└── SKILL.md          # Optional skill definition
```

### Export Pattern

```typescript
// index.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { MyComponent } from "./component";
import { restoreState } from "./utils";
import type { ExtensionState } from "./types";

export default function myExtension(pi: ExtensionAPI) {
  // Implementation
}
```

---

## Anti-Patterns to Avoid

### ❌ Blocking Event Loop

```typescript
// Wrong
pi.on("session_start", () => {
  const data = fs.readFileSync("large.json");  // Blocks!
});

// Correct
pi.on("session_start", async () => {
  const data = await fs.promises.readFile("large.json");
});
```

### ❌ Throwing Unhandled Errors

```typescript
// Wrong
pi.on("tool_call", async () => {
  throw new Error("Oops!");  // Crashes extension
});

// Correct
pi.on("tool_call", async () => {
  try {
    // ...
  } catch (error) {
    console.error("Extension error:", error);
    return undefined;  // Allow to proceed
  }
});
```

### ❌ Assuming UI Exists

```typescript
// Wrong
pi.registerCommand("my-command", {
  handler: async () => {
    await ctx.ui.confirm("Sure?", "Really?");  // Crashes in RPC!
  }
});

// Correct
pi.registerCommand("my-command", {
  handler: async (_args, ctx) => {
    if (!ctx.hasUI) {
      ctx.ui.notify("Requires interactive mode", "error");
      return;
    }
    await ctx.ui.confirm("Sure?", "Really?");
  }
});
```

### ❌ Forgetting Return Values

```typescript
// Wrong
pi.on("tool_call", async (event) => {
  if (shouldBlock(event)) {
    { block: true, reason: "Blocked" };  // Missing return!
  }
});

// Correct
pi.on("tool_call", async (event) => {
  if (shouldBlock(event)) {
    return { block: true, reason: "Blocked" };
  }
  return undefined;
});
```

---

## Testing Patterns

### Manual Testing Extension

```typescript
export default function testExtension(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Test extension loaded!", "info");
  });
  
  pi.registerCommand("test-notify", {
    handler: async (_args, ctx) => {
      ctx.ui.notify("Notification test", "info");
    }
  });
  
  pi.registerCommand("test-confirm", {
    handler: async (_args, ctx) => {
      const ok = await ctx.ui.confirm("Test", "Confirm?");
      ctx.ui.notify(ok ? "Confirmed" : "Cancelled", "info");
    }
  });
}
```

### Debug Logging

```typescript
export default function debugExtension(pi: ExtensionAPI) {
  const events = ["session_start", "tool_call", "turn_start", "agent_end"];
  
  for (const event of events) {
    pi.on(event as any, async (...args) => {
      console.log(`[${event}]`, args);
    });
  }
}
```

---

## Performance Patterns

### Lazy Initialization

```typescript
let expensiveResource: Resource | undefined;

function getResource(): Resource {
  if (!expensiveResource) {
    expensiveResource = createExpensiveResource();
  }
  return expensiveResource;
}

pi.registerTool({
  name: "use_resource",
  async execute() {
    const resource = getResource();  // Only created on first use
    // ...
  }
});
```

### Debounced Updates

```typescript
class StatusComponent {
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  
  updateStatus(text: string) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      this.text = text;
      this.invalidate();
    }, 100);  // Debounce 100ms
  }
}
```

---

**Next Steps**:
- Read [PI-DEV-SECURITY.md](./PI-DEV-SECURITY.md) for security patterns
- Read [PI-DEV-ADVANCED.md](./PI-DEV-ADVANCED.md) for advanced techniques
- Browse `$PI_CODING_AGENT_PACKAGE/examples/extensions/` for real-world examples

