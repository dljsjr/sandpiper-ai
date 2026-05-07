# Pi Extension Developer Quickstart

**Target**: First-time extension developers  
**Prerequisites**: TypeScript knowledge, Node.js/Bun runtime  
**Time**: 15-30 minutes to first working extension

---

## What is a Pi Extension?

A Pi extension is a TypeScript file that extends Pi's capabilities by:
- **Registering custom tools** for the LLM to use
- **Subscribing to events** (tool calls, session lifecycle, turns)
- **Registering commands** (`/command-name`)
- **Creating custom UI** (dialogs, overlays, widgets)
- **Modifying the system prompt** dynamically
- **Integrating external services** (APIs, databases, remote systems)

Extensions are loaded at session start and can interact with every aspect of Pi's operation.

---

## Extension Anatomy

Every extension has the same basic structure:

```typescript
// my-extension.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export default function myExtension(pi: ExtensionAPI) {
  // 1. Subscribe to events
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Extension loaded!", "info");
  });

  // 2. Register custom tools
  pi.registerTool({
    name: "greet",
    label: "Greeting",
    description: "Generate a greeting message",
    parameters: Type.Object({
      name: Type.String({ description: "Name to greet" }),
    }),
    async execute(_toolCallId, params) {
      return {
        content: [{ type: "text", text: `Hello, ${params.name}!` }],
        details: { greeted: params.name }
      };
    }
  });

  // 3. Register commands
  pi.registerCommand("hello", {
    description: "Say hello",
    handler: async (args, ctx) => {
      ctx.ui.notify("Hello!", "info");
    }
  });
}
```

### Key Components

| Component | Purpose | Required |
|-----------|---------|----------|
| **Default export** | Extension entry point | ✅ Yes |
| **ExtensionAPI parameter** | Access to Pi's APIs | ✅ Yes |
| Event subscriptions | React to lifecycle events | ❌ Optional |
| Tool registration | Add capabilities for LLM | ❌ Optional |
| Command registration | Add user slash commands | ❌ Optional |

---

## Minimal Working Extension

Here's the absolute minimum viable extension:

```typescript
// hello.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function helloExtension(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Hello from my extension!", "info");
  });
}
```

**What this does**:
- Loads at session start
- Shows a notification to the user

**Save this file** as `~/.pi/agent/extensions/hello.ts` (global) or `<project>/.pi/extensions/hello.ts` (project-local).

---

## Loading Extensions

### Method 1: Discovery (Automatic)

Pi automatically discovers extensions from:

| Location | Scope |
|----------|-------|
| `~/.pi/agent/extensions/` | Global (all sessions) |
| `<cwd>/.pi/extensions/` | Project-local |
| `<cwd>/.pi/agent/extensions/` | Project-local (legacy) |

**Just copy your extension file** to one of these directories and restart Pi.

### Method 2: CLI Flag (One-time)

```bash
pi --extension /path/to/my-extension.ts
```

You can specify multiple extensions:

```bash
pi --extension ./ext1.ts --extension ./ext2.ts
```

### Method 3: Settings Configuration

Add to `~/.pi/agent/settings.json` or `<cwd>/.pi/settings.json`:

```json
{
  "extensions": [
    "./extensions/my-extension.ts",
    "./extensions/another-extension.ts"
  ]
}
```

Paths are relative to the settings file location.

### Method 4: Package Configuration

If you're distributing a Pi package, add to `package.json`:

```json
{
  "pi": {
    "extensions": ["./extensions/index.ts"]
  }
}
```

---

## Testing Workflow

### 1. Create Extension File

```typescript
// ~/.pi/agent/extensions/test-ext.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function testExtension(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Test extension loaded!", "info");
  });

  pi.registerCommand("test", {
    description: "Test command",
    handler: async (args, ctx) => {
      ctx.ui.notify(`Test received args: ${args}`, "info");
    }
  });
}
```

### 2. Restart Pi

```bash
# Exit current session
/quit

# Start new session
pi
```

### 3. Verify Loading

You should see the notification "Test extension loaded!" in the chat.

### 4. Test Command

Type in the chat:

```
/test hello world
```

You should see: "Test received args: hello world"

### 5. Hot Reload (Optional)

Some changes can be hot-reloaded without restarting:

```
/reload
```

This reloads extensions, skills, prompts, and themes.

**Note**: Not all changes support hot reload. Stateful extensions may need a full restart.

---

## Your First Custom Tool

Let's build a useful tool that the LLM can call:

```typescript
// ~/.pi/agent/extensions/todo.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

export default function todoExtension(pi: ExtensionAPI) {
  let todos: Todo[] = [];
  let nextId = 1;

  pi.registerTool({
    name: "todo",
    label: "Todo",
    description: "Manage a todo list. Actions: add, list, toggle, clear",
    parameters: Type.Object({
      action: Type.Union([
        Type.Literal("add"),
        Type.Literal("list"),
        Type.Literal("toggle"),
        Type.Literal("clear")
      ]),
      text: Type.Optional(Type.String({ description: "Todo text (for add)" })),
      id: Type.Optional(Type.Number({ description: "Todo ID (for toggle)" }))
    }),
    async execute(_toolCallId, params) {
      switch (params.action) {
        case "list":
          return {
            content: [{
              type: "text",
              text: todos.length
                ? todos.map(t => `[${t.done ? "x" : " "}] #${t.id}: ${t.text}`).join("\n")
                : "No todos"
            }],
            details: { todos: [...todos], nextId }
          };

        case "add":
          if (!params.text) {
            return {
              content: [{ type: "text", text: "Error: text required" }],
              details: { error: "text required" }
            };
          }
          const newTodo: Todo = { id: nextId++, text: params.text, done: false };
          todos.push(newTodo);
          return {
            content: [{ type: "text", text: `Added todo #${newTodo.id}: ${newTodo.text}` }],
            details: { todos: [...todos], nextId }
          };

        case "toggle":
          if (params.id === undefined) {
            return {
              content: [{ type: "text", text: "Error: id required" }],
              details: { error: "id required" }
            };
          }
          const todo = todos.find(t => t.id === params.id);
          if (!todo) {
            return {
              content: [{ type: "text", text: `Todo #${params.id} not found` }],
              details: { error: "not found" }
            };
          }
          todo.done = !todo.done;
          return {
            content: [{ type: "text", text: `Todo #${todo.id} ${todo.done ? "completed" : "uncompleted"}` }],
            details: { todos: [...todos], nextId }
          };

        case "clear":
          todos = [];
          nextId = 1;
          return {
            content: [{ type: "text", text: "Cleared all todos" }],
            details: { todos: [], nextId: 1 }
          };

        default:
          return {
            content: [{ type: "text", text: `Unknown action: ${params.action}` }],
            details: { error: "unknown action" }
          };
      }
    }
  });
}
```

### Testing the Tool

1. **Restart Pi** or run `/reload`
2. **Ask the LLM** to use the tool:

```
Can you add a todo to buy groceries?
```

The LLM should call the `todo` tool with:
```json
{ "action": "add", "text": "Buy groceries" }
```

3. **Verify** by asking:

```
What todos do I have?
```

The LLM should call `todo` with `{ "action": "list" }` and show you the list.

---

## Your First Event Handler

Event handlers let you intercept and modify Pi's behavior:

### Intercepting Tool Calls

```typescript
// ~/.pi/agent/extensions/permission-gate.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function permissionGateExtension(pi: ExtensionAPI) {
  const dangerousPatterns = [/\brm\s+(-rf?|--recursive)/i, /\bsudo\b/i];

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return undefined;

    const command = event.input.command as string;
    const isDangerous = dangerousPatterns.some(p => p.test(command));

    if (!isDangerous) return undefined;

    // Block if no UI
    if (!ctx.hasUI) {
      return { block: true, reason: "Dangerous command (no UI)" };
    }

    // Ask for confirmation
    const ok = await ctx.ui.confirm(
      "⚠️ Dangerous Command",
      `Allow this command?\n\n  ${command}`
    );

    if (!ok) {
      return { block: true, reason: "Blocked by user" };
    }

    return undefined; // Allow
  });
}
```

**What this does**:
- Intercepts all `bash` tool calls
- Checks for dangerous patterns (`rm -rf`, `sudo`)
- Shows a confirmation dialog
- Blocks the command if user declines

### Modifying the System Prompt

```typescript
// ~/.pi/agent/extensions/personality.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function personalityExtension(pi: ExtensionAPI) {
  let formalMode = false;

  pi.registerCommand("formal", {
    description: "Toggle formal mode",
    handler: async (_args, ctx) => {
      formalMode = !formalMode;
      ctx.ui.notify(`Formal mode ${formalMode ? "enabled" : "disabled"}`, "info");
    }
  });

  pi.on("before_agent_start", async (event) => {
    if (formalMode) {
      return {
        systemPrompt: event.systemPrompt + `

IMPORTANT: You are in FORMAL MODE. Use:
- Formal, professional language
- Complete sentences with proper grammar
- Technical precision
- No slang or casual expressions`
      };
    }
    return undefined;
  });
}
```

**What this does**:
- Adds a `/formal` command to toggle mode
- Modifies the system prompt before each agent turn
- Changes the LLM's personality dynamically

---

## Your First Custom UI

Custom UI lets you build interactive dialogs:

### Simple Selector

```typescript
// ~/.pi/agent/extensions/quick-pick.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { SelectList, type SelectItem } from "@mariozechner/pi-tui";

export default function quickPickExtension(pi: ExtensionAPI) {
  pi.registerCommand("pick", {
    description: "Pick an option",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("Requires interactive mode", "error");
        return;
      }

      const items: SelectItem[] = [
        { value: "option1", label: "Option 1", description: "First choice" },
        { value: "option2", label: "Option 2", description: "Second choice" },
        { value: "option3", label: "Option 3", description: "Third choice" }
      ];

      const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
        const selectList = new SelectList(items, 5);
        selectList.onSelect = (item) => done(item.value);
        selectList.onCancel = () => done(null);

        return {
          render(width) { return selectList.render(width); },
          invalidate() { selectList.invalidate(); },
          handleInput(data) {
            selectList.handleInput(data);
            tui.requestRender();
          }
        };
      });

      if (result) {
        ctx.ui.notify(`You picked: ${result}`, "info");
      }
    }
  });
}
```

**Test it**:

```
/pick
```

You'll see an interactive selector with arrow key navigation.

### Simple Confirmation

```typescript
pi.registerCommand("confirm-test", {
  description: "Test confirmation dialog",
  handler: async (_args, ctx) => {
    const ok = await ctx.ui.confirm(
      "Confirm Action",
      "Are you sure you want to proceed?"
    );

    if (ok) {
      ctx.ui.notify("Confirmed!", "success");
    } else {
      ctx.ui.notify("Cancelled", "warning");
    }
  }
});
```

---

## Common First Mistakes

### ❌ Mistake 1: Forgetting the Default Export

```typescript
// Wrong - no export
function myExtension(pi: ExtensionAPI) {
  // ...
}

// Correct
export default function myExtension(pi: ExtensionAPI) {
  // ...
}
```

### ❌ Mistake 2: Using Module-Level State

```typescript
// Wrong - breaks on reload and branching
let counter = 0;

export default function counterExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "increment",
    // ...
    async execute() {
      counter++;  // Will reset on reload!
      return { content: [{ type: "text", text: `Count: ${counter}` }] };
    }
  });
}

// Correct - use session state
export default function counterExtension(pi: ExtensionAPI) {
  let counter = 0;

  pi.on("session_start", async () => {
    // Restore from session if needed
    counter = 0;
  });

  pi.registerTool({
    name: "increment",
    // ...
    async execute() {
      counter++;
      return {
        content: [{ type: "text", text: `Count: ${counter}` }],
        details: { counter }  // Persist in details
      };
    }
  });
}
```

### ❌ Mistake 3: Not Handling Non-Interactive Mode

```typescript
// Wrong - assumes UI always exists
pi.registerCommand("my-command", {
  handler: async (_args, ctx) => {
    await ctx.ui.confirm("Sure?", "Really?");  // Crashes in RPC mode!
  }
});

// Correct - check for UI
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

### ❌ Mistake 4: Forgetting to Return from Event Handlers

```typescript
// Wrong - return value ignored
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
  return undefined;  // Explicit allow
});
```

### ❌ Mistake 5: Not Using TypeBox for Parameters

```typescript
// Wrong - no schema
pi.registerTool({
  name: "my_tool",
  parameters: {}  // Invalid!
});

// Correct
import { Type } from "@sinclair/typebox";

pi.registerTool({
  name: "my_tool",
  parameters: Type.Object({
    input: Type.String({ description: "Input value" })
  })
});
```

---

## Debugging Extensions

### Enable Debug Logging

```bash
PI_DEBUG=extensions pi
```

This logs extension loading, event firing, and errors.

### Use Notifications for Runtime Debugging

```typescript
pi.registerTool({
  name: "debug_test",
  // ...
  async execute(_toolCallId, params) {
    ctx.ui.notify(`Debug: received params ${JSON.stringify(params)}`, "info");
    // ...
  }
});
```

### Check Extension Load Errors

Extension load errors appear in the startup output:

```
Loading extensions...
✗ Failed to load ~/.pi/agent/extensions/broken.ts
  Error: Cannot find module '@sinclair/typebox'
✓ Loaded ~/.pi/agent/extensions/hello.ts
```

### Test in Isolation

```bash
# Load only your extension
pi --extension ./my-extension.ts --no-extensions

# Test with debug logging
PI_DEBUG=extensions pi --extension ./my-extension.ts
```

---

## Next Steps

Now that you have the basics:

1. **Read [PI-DEV-EVENTS.md](./PI-DEV-EVENTS.md)** for complete event reference
2. **Read [PI-DEV-TOOLS.md](./PI-DEV-TOOLS.md)** for advanced tool patterns
3. **Read [PI-DEV-UI.md](./PI-DEV-UI.md)** for custom UI development
4. **Browse examples** at `$PI_CODING_AGENT_PACKAGE/examples/extensions/`
5. **Read [PI-DEV-STATE.md](./PI-DEV-STATE.md)** for state persistence patterns

---

## Quick Reference

### ExtensionAPI Methods

| Method | Purpose |
|--------|---------|
| `pi.on(event, handler)` | Subscribe to events |
| `pi.registerTool(tool)` | Register custom tool |
| `pi.registerCommand(name, config)` | Register slash command |
| `pi.registerShortcut(key, config)` | Register keyboard shortcut |
| `pi.registerProvider(name, config)` | Register LLM provider |
| `pi.registerMessageRenderer(type, renderer)` | Custom message rendering |
| `pi.getAllTools()` | Get all registered tools |
| `pi.setActiveTools(names)` | Enable/disable tools |
| `pi.setModel(model)` | Switch model |
| `pi.exec(cmd, args)` | Execute shell command |
| `pi.getFlag(name)` | Get CLI flag value |
| `pi.appendEntry(type, data)` | Persist session entry |
| `pi.sendMessage(msg, options)` | Send custom message |
| `pi.sendUserMessage(content, options)` | Send as user |

### ExtensionContext Properties

| Property | Type | Purpose |
|----------|------|---------|
| `ctx.cwd` | `string` | Current working directory |
| `ctx.hasUI` | `boolean` | Interactive mode available |
| `ctx.ui` | `UIAPI` | UI methods (notify, confirm, custom) |
| `ctx.sessionManager` | `SessionManager` | Session access |
| `ctx.modelRegistry` | `ModelRegistry` | Model/auth access |
| `ctx.model` | `Model | undefined` | Current model |
| `ctx.getSystemPrompt()` | `string` | Current system prompt |

### Event Handler Return Types

```typescript
// tool_call event
return { block: true, reason: "Blocked" };  // Block tool
return undefined;  // Allow tool

// before_agent_start event
return { systemPrompt: "Modified prompt" };  // Modify prompt
return { message: { customType: "x", content: "..." } };  // Inject message
return undefined;  // No change

// session_before_switch event
return { cancel: true };  // Cancel switch
return undefined;  // Allow switch

// input event
return { action: "transform", text: "Modified text" };  // Transform
return { action: "continue" };  // Continue with original
```

---

**You're ready to build!** Start with a simple extension, test it, then gradually add complexity. Use the examples at `$PI_CODING_AGENT_PACKAGE/examples/extensions/` as reference implementations.
