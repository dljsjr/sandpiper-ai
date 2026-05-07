# Pi Custom Tools Developer Guide

**Target**: Developers building custom tools  
**Related**: [PI-DEV-QUICKSTART.md](./PI-DEV-QUICKSTART.md), [PI-DEV-STATE.md](./PI-DEV-STATE.md)

---

## Tool Definition

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "What this tool does (shown to LLM)",
  promptSnippet: "Brief description for tools section",
  promptGuidelines: ["When to use", "Best practices"],
  parameters: Type.Object({
    input: Type.String({ description: "Input value" })
  }),
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // Implementation
    return {
      content: [{ type: "text", text: "Result" }],
      details: { persisted: "state" }
    };
  },
  renderCall(args, theme, context) {
    // Custom call rendering
  },
  renderResult(result, { expanded, isPartial }, theme, context) {
    // Custom result rendering
  },
  renderShell: "self"  // Or "default"
});
```

---

## Minimal Tool

```typescript
import { Type } from "@sinclair/typebox";

pi.registerTool({
  name: "hello",
  label: "Hello",
  description: "Generate a greeting",
  parameters: Type.Object({
    name: Type.String({ description: "Name to greet" })
  }),
  async execute(_toolCallId, params) {
    return {
      content: [{ type: "text", text: `Hello, ${params.name}!` }],
      details: { greeted: params.name }
    };
  }
});
```

---

## Tool with Custom Rendering

```typescript
pi.registerTool({
  name: "todo",
  label: "Todo",
  description: "Manage todos",
  parameters: Type.Object({
    action: Type.Union([
      Type.Literal("list"),
      Type.Literal("add"),
      Type.Literal("toggle"),
      Type.Literal("clear")
    ]),
    text: Type.Optional(Type.String()),
    id: Type.Optional(Type.Number())
  }),
  async execute(_toolCallId, params) {
    // Implementation
  },
  
  renderCall(args, theme, _context) {
    let text = theme.fg("toolTitle", theme.bold("todo "));
    text += theme.fg("muted", args.action);
    if (args.text) text += ` "${args.text}"`;
    if (args.id !== undefined) text += ` #${args.id}`;
    return new Text(text, 0, 0);
  },
  
  renderResult(result, { expanded }, theme, _context) {
    const details = result.details as TodoDetails;
    
    if (!expanded) {
      // Collapsed: minimal info
      return new Text(theme.fg("success", "✓ Done"), 0, 0);
    }
    
    // Expanded: full details
    return new Text(result.content[0].text, 0, 0);
  }
});
```

---

## Overriding Built-in Tools

```typescript
import { createReadTool } from "@mariozechner/pi-coding-agent";

const originalRead = createReadTool(cwd);

pi.registerTool({
  ...originalRead,
  name: "read",  // Same name = override
  label: "read (audited)",
  description: "Read with access logging",
  
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // Add auditing
    await logAccess(params.path);
    
    // Block sensitive paths
    if (isBlockedPath(params.path)) {
      return {
        content: [{ type: "text", text: "Access denied" }],
        details: { blocked: true }
      };
    }
    
    // Delegate to original
    return originalRead.execute(toolCallId, params, signal, onUpdate);
  }
  
  // No renderCall/renderResult = uses built-in renderer
});
```

---

## Output Truncation

```typescript
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  truncateHead,
  withFileMutationQueue
} from "@mariozechner/pi-coding-agent";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";

pi.registerTool({
  name: "rg",
  label: "ripgrep",
  description: `Search with ripgrep. Output truncated to ${DEFAULT_MAX_LINES} lines or ${DEFAULT_MAX_BYTES} bytes.`,
  parameters: Type.Object({
    pattern: Type.String({ description: "Search pattern" }),
    path: Type.Optional(Type.String())
  }),
  
  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
    // Execute ripgrep
    const output = await runRipgrep(params.pattern, params.path);
    
    // Apply truncation
    const truncation = truncateHead(output, {
      maxLines: DEFAULT_MAX_LINES,
      maxBytes: DEFAULT_MAX_BYTES
    });
    
    let resultText = truncation.content;
    
    if (truncation.truncated) {
      // Save full output to temp file
      const tempDir = await mkdtemp(join(tmpdir(), "pi-rg-"));
      const tempFile = join(tempDir, "output.txt");
      await withFileMutationQueue(tempFile, async () => {
        await writeFile(tempFile, output, "utf8");
      });
      
      const truncatedLines = truncation.totalLines - truncation.outputLines;
      resultText += `\n\n[Output truncated: ${truncation.outputLines}/${truncation.totalLines} lines. Full output: ${tempFile}]`;
    }
    
    return {
      content: [{ type: "text", text: resultText }],
      details: {
        pattern: params.pattern,
        matchCount: countMatches(output),
        truncation,
        fullOutputPath: truncation.truncated ? tempFile : undefined
      }
    };
  }
});
```

---

## Tool Result Details for State

```typescript
interface TodoDetails {
  action: "list" | "add" | "toggle" | "clear";
  todos: Todo[];
  nextId: number;
}

pi.registerTool({
  name: "todo",
  // ...
  async execute(_toolCallId, params) {
    switch (params.action) {
      case "add":
        todos.push({ id: nextId++, text: params.text, done: false });
        return {
          content: [{ type: "text", text: "Added" }],
          details: { action: "add", todos: [...todos], nextId }
        };
      
      case "list":
        return {
          content: [{ type: "text", text: formatTodos(todos) }],
          details: { action: "list", todos: [...todos], nextId }
        };
    }
  }
});

// Reconstruct state from session
pi.on("session_start", async (_event, ctx) => {
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "message" && entry.message.toolName === "todo") {
      const details = entry.message.details as TodoDetails;
      todos = details.todos;
      nextId = details.nextId;
    }
  }
});
```

---

## Prompt Snippets and Guidelines

```typescript
pi.registerTool({
  name: "generate_image",
  label: "Generate image",
  description: "Generate images via DALL-E 3",
  promptSnippet: "Generate images from text descriptions using DALL-E 3",
  promptGuidelines: [
    "Use when user asks for an image, illustration, or visual",
    "Be specific in the prompt - include style, colors, composition",
    "Images are returned as attachments in the response"
  ],
  parameters: Type.Object({
    prompt: Type.String({ description: "Detailed image description" }),
    style: Type.Optional(Type.String())
  }),
  // ...
});
```

These appear in the system prompt:

```
Available tools:
- generate_image: Generate images from text descriptions using DALL-E 3

Guidelines:
- Use generate_image when user asks for an image, illustration, or visual
- Be specific in the prompt - include style, colors, composition
```

---

## Tool with Streaming Updates

```typescript
pi.registerTool({
  name: "long_process",
  label: "Long Process",
  description: "Run a long process with progress updates",
  parameters: Type.Object({
    steps: Type.Number({ description: "Number of steps" })
  }),
  
  async execute(_toolCallId, params, signal, onUpdate, ctx) {
    for (let i = 0; i < params.steps; i++) {
      // Check for abort
      if (signal.aborted) {
        return {
          content: [{ type: "text", text: "Aborted" }],
          details: { completed: i }
        };
      }
      
      // Send progress update
      onUpdate?.({
        content: [{ type: "text", text: `Step ${i + 1}/${params.steps}...` }],
        details: { progress: (i + 1) / params.steps }
      });
      
      await doWork(i);
    }
    
    return {
      content: [{ type: "text", text: "Complete!" }],
      details: { completed: params.steps }
    };
  }
});
```

---

## Tool with Custom Shell Rendering

```typescript
pi.registerTool({
  name: "edit",
  label: "edit",
  description: "Edit files",
  parameters: Type.Object({
    path: Type.String(),
    oldText: Type.String(),
    newText: Type.String()
  }),
  renderShell: "self",  // Tool renders its own shell
  
  async execute(toolCallId, params) {
    // Edit implementation
  },
  
  renderCall(args, theme, context) {
    return new Text(
      theme.fg("toolTitle", theme.bold("edit ")) +
      theme.fg("accent", args.path),
      0, 0
    );
  },
  
  renderResult(result, { expanded }, theme, context) {
    if (!expanded) {
      return new Text(theme.fg("success", "✓ Applied"), 0, 0);
    }
    
    // Show diff in expanded view
    const details = result.details as EditToolDetails;
    return new Text(formatDiff(details.diff), 0, 0);
  }
});
```

---

## Tool Parameter Validation

```typescript
import { Type, Static } from "@sinclair/typebox";

const ImageSize = Type.Union([
  Type.Literal("1024x1024"),
  Type.Literal("1024x1792"),
  Type.Literal("1792x1024")
]);

const ImageParams = Type.Object({
  prompt: Type.String({ 
    description: "Image description",
    minLength: 1,
    maxLength: 4000
  }),
  size: Type.Optional(ImageSize),
  n: Type.Optional(Type.Number({ 
    minimum: 1, 
    maximum: 4,
    default: 1
  }))
});

type ImageParamsType = Static<typeof ImageParams>;

pi.registerTool({
  name: "dalle",
  // ...
  parameters: ImageParams,
  
  async execute(_toolCallId, params) {
    const typedParams = params as ImageParamsType;
    // Type-safe access
    const size = typedParams.size || "1024x1024";
    // ...
  }
});
```

---

## Common Tool Patterns

### Read-Only Tool

```typescript
pi.registerTool({
  name: "count_lines",
  label: "Count Lines",
  description: "Count lines in a file",
  parameters: Type.Object({
    path: Type.String({ description: "File path" })
  }),
  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
    const content = await readFile(params.path, "utf8");
    const count = content.split("\n").length;
    
    return {
      content: [{ type: "text", text: `${count} lines` }],
      details: { path: params.path, count }
    };
  }
});
```

### Write Tool

```typescript
pi.registerTool({
  name: "save_note",
  label: "Save Note",
  description: "Save a note to disk",
  parameters: Type.Object({
    filename: Type.String({ description: "Note filename" }),
    content: Type.String({ description: "Note content" })
  }),
  async execute(_toolCallId, params) {
    await writeFile(params.filename, params.content, "utf8");
    
    return {
      content: [{ type: "text", text: `Saved to ${params.filename}` }],
      details: { filename: params.filename, bytes: params.content.length }
    };
  }
});
```

### Tool with File Output

```typescript
pi.registerTool({
  name: "export_report",
  label: "Export Report",
  description: "Generate and export a report",
  parameters: Type.Object({
    format: Type.Union([
      Type.Literal("pdf"),
      Type.Literal("markdown"),
      Type.Literal("json")
    ])
  }),
  async execute(_toolCallId, params) {
    const report = await generateReport();
    const filename = `report-${Date.now()}.${params.format}`;
    
    await writeFile(filename, report.content);
    
    return {
      content: [
        { type: "text", text: `Report exported to ${filename}` },
        { type: "file", path: filename }  // File attachment
      ],
      details: { filename, format: params.format }
    };
  }
});
```

---

## Testing Tools

### Manual Testing

```typescript
// Test extension
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function testExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "test_echo",
    label: "Test Echo",
    description: "Echo back input for testing",
    parameters: Type.Object({
      message: Type.String({ description: "Message to echo" })
    }),
    async execute(_toolCallId, params) {
      return {
        content: [{ type: "text", text: `Echo: ${params.message}` }],
        details: { echoed: params.message }
      };
    }
  });
}
```

Test with:

```
Can you use test_echo to say "hello world"?
```

### Unit Testing Tools

```typescript
// tool.test.ts
import { describe, it, expect } from "vitest";
import { createTestTool } from "./test-utils";

describe("todo tool", () => {
  it("should add todos", async () => {
    const tool = createTestTool("todo");
    
    const result = await tool.execute("call-1", {
      action: "add",
      text: "Test todo"
    });
    
    expect(result.content[0].text).toContain("Added");
    expect(result.details.todos).toHaveLength(1);
  });
  
  it("should list todos", async () => {
    const tool = createTestTool("todo");
    
    await tool.execute("call-1", { action: "add", text: "Todo 1" });
    await tool.execute("call-2", { action: "add", text: "Todo 2" });
    
    const result = await tool.execute("call-3", { action: "list" });
    
    expect(result.content[0].text).toContain("Todo 1");
    expect(result.content[0].text).toContain("Todo 2");
  });
});
```

---

## Tool Debugging

### Log Tool Calls

```typescript
pi.registerTool({
  name: "my_tool",
  // ...
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    console.log("[my_tool] Called with:", {
      toolCallId,
      params,
      cwd: ctx.cwd
    });
    
    ctx.ui.notify(`Tool called: ${JSON.stringify(params)}`, "info");
    
    // Implementation
  }
});
```

### Enable Debug Logging

```bash
PI_DEBUG=tools pi
```

Logs all tool calls and results.

---

**Next Steps**:
- Read [PI-DEV-STATE.md](./PI-DEV-STATE.md) for state persistence
- Read [PI-DEV-UI.md](./PI-DEV-UI.md) for custom rendering
- Browse `$PI_CODING_AGENT_PACKAGE/examples/extensions/` for examples


---

## New in Pi 0.67.4

### `renderShell: "self"` for Custom Rendering

**When to use**: You want your custom tool renderer to own the outer shell instead of using the default boxed shell. Useful for stable large previews such as edit diffs.

**Usage**:
```typescript
pi.registerTool({
  name: "my_tool",
  // ... other fields ...
  renderShell: "self",  // Own the outer shell
  
  renderResult(result, { expanded }, theme) {
    // You control the entire rendering including borders
    const container = new Container();
    container.addChild(new DynamicBorder((s) => theme.fg("accent", s)));
    container.addChild(new Text("My Custom Tool Result", 1, 0));
    // ... your custom layout ...
    container.addChild(new DynamicBorder((s) => theme.fg("accent", s)));
    return container;
  }
});
```

**Default behavior** (without `renderShell: "self"`):
- Pi wraps your renderer output in a standard boxed shell
- Your renderer only controls the inner content

**With `renderShell: "self"`**:
- Your renderer controls the entire component tree
- No automatic boxing or wrapping
- Useful for:
  - Stable large previews (edit diffs)
  - Custom border styles
  - Complex layouts that don't fit the boxed pattern

**Related**: [PI-DEV-UI.md](./PI-DEV-UI.md) for custom component rendering

---

## Tool Definition Updates

### `defineTool()` Helper (New in 0.65.0)

**When to use**: You want to create standalone custom tool definitions with full TypeScript parameter type inference without manual casts.

**Before** (manual type casting):
```typescript
const myTool = {
  name: "my_tool",
  parameters: Type.Object({ input: Type.String() }),
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    const typedParams = params as { input: string };  // Manual cast
    // ...
  }
} as ToolDefinition;
```

**After** (type inference):
```typescript
import { defineTool, Type } from "@mariozechner/pi-coding-agent";

const myTool = defineTool({
  name: "my_tool",
  parameters: Type.Object({
    input: Type.String({ description: "Input value" })
  }),
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // params is correctly typed as { input: string }
    console.log(params.input);  // No cast needed!
    return {
      content: [{ type: "text", text: `Processed: ${params.input}` }]
    };
  }
});
```

**Benefits**:
- Full TypeScript inference for `params` argument
- No manual type assertions
- Better IDE autocomplete
- Catches parameter type errors at compile time

**Related**: [PI-DEV-SDK.md](./PI-DEV-SDK.md) for SDK usage

