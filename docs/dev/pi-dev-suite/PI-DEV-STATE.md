# Pi State Persistence Guide

**Target**: Developers building stateful extensions  
**Related**: [PI-DEV-EVENTS.md](./PI-DEV-EVENTS.md), [PI-DEV-TOOLS.md](./PI-DEV-TOOLS.md)

---

## Session Entry Types

```typescript
interface SessionEntry {
  id: string;
  parentId: string | null;
  type: SessionEntryType;
  timestamp: number;
}

type SessionEntryType =
  | "session"           // Session header
  | "message"           // User/assistant/toolResult
  | "compaction"        // Compaction summary
  | "branch_summary"    // Branch navigation summary
  | "custom"            // Extension state
  | "custom_message"    // Extension messages (in context)
  | "label"             // User bookmarks
  | "model_change"      // Model switch
  | "thinking_level_change";  // Thinking level change
```

---

## Storing State in Tool Details

```typescript
interface TodoDetails {
  todos: Todo[];
  nextId: number;
}

pi.registerTool({
  name: "todo",
  async execute(_toolCallId, params) {
    // Modify state
    todos.push({ id: nextId++, text: params.text, done: false });
    
    return {
      content: [{ type: "text", text: "Added todo" }],
      details: { todos: [...todos], nextId } as TodoDetails  // Persisted
    };
  }
});

// Reconstruct from session
pi.on("session_start", async (_event, ctx) => {
  todos = [];
  nextId = 1;
  
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

## Custom Entry Types

```typescript
// Store extension config
pi.appendEntry("tools-config", {
  enabledTools: ["read", "bash", "edit"]
});

// Store game state
pi.appendEntry("snake-save", gameState);

// Store user preferences
pi.appendEntry("user-prefs", {
  theme: "dark",
  formalMode: false
});
```

### Retrieving Custom Entries

```typescript
pi.on("session_start", async (_event, ctx) => {
  const entries = ctx.sessionManager.getEntries();
  
  // Find by customType
  const configEntry = entries.find(
    e => e.type === "custom" && e.customType === "tools-config"
  );
  
  if (configEntry) {
    const data = configEntry.data as { enabledTools: string[] };
    enabledTools = new Set(data.enabledTools);
  }
  
  // Get last entry of type
  const lastEntry = entries
    .filter(e => e.type === "custom" && e.customType === "user-prefs")
    .pop();
  
  if (lastEntry) {
    userPrefs = lastEntry.data as UserPrefs;
  }
});
```

---

## Branch-Aware State

Sessions are **trees**, not linear. State must be branch-aware:

```
Root
├─ Branch A: todos = [1, 2, 3]
│  └─ Continue: todos = [1, 2, 3, 4]
└─ Branch B: todos = [1, 2]  ← Forked earlier
   └─ Continue: todos = [1, 2, 5]
```

### Use `getBranch()` Not `getEntries()`

```typescript
// ✅ Correct - branch-aware
pi.on("session_start", async (_event, ctx) => {
  const branch = ctx.sessionManager.getBranch();
  state = reconstructFrom(branch);
});

// ❌ Wrong - includes all branches
pi.on("session_start", async (_event, ctx) => {
  const entries = ctx.sessionManager.getEntries();
  state = reconstructFrom(entries);  // Wrong!
});
```

### Handle `session_tree` Event

```typescript
pi.on("session_tree", async (_event, ctx) => {
  // User navigated to different branch
  const branch = ctx.sessionManager.getBranch();
  state = reconstructFrom(branch);
  
  ctx.ui.notify(`Restored state from branch`, "info");
});
```

---

## State Reconstruction Pattern

```typescript
interface ExtensionState {
  counter: number;
  items: string[];
  config: Config;
}

let state: ExtensionState = {
  counter: 0,
  items: [],
  config: { mode: "normal" }
};

function reconstructState(branch: SessionEntry[]): ExtensionState {
  const newState: ExtensionState = {
    counter: 0,
    items: [],
    config: { mode: "normal" }
  };
  
  for (const entry of branch) {
    // From tool result details
    if (entry.type === "message" && entry.message.toolName === "my_tool") {
      const details = entry.message.details as any;
      if (details.counter !== undefined) newState.counter = details.counter;
      if (details.items) newState.items = details.items;
    }
    
    // From custom entries
    if (entry.type === "custom") {
      if (entry.customType === "my-extension-config") {
        newState.config = entry.data as Config;
      }
    }
  }
  
  return newState;
}

pi.on("session_start", async (_event, ctx) => {
  state = reconstructState(ctx.sessionManager.getBranch());
});

pi.on("session_tree", async (_event, ctx) => {
  state = reconstructState(ctx.sessionManager.getBranch());
});
```

---

## State Persistence Best Practices

### ✅ DO: Store in Session

```typescript
// Persist in tool result details
return {
  content: [{ type: "text", text: "Done" }],
  details: { state: {...} }
};

// Or use custom entries
pi.appendEntry("my-extension", { state: {...} });
```

### ✅ DO: Reconstruct from Branch

```typescript
const branch = ctx.sessionManager.getBranch();
state = reconstructFrom(branch);
```

### ✅ DO: Handle Branch Navigation

```typescript
pi.on("session_tree", async (_event, ctx) => {
  state = reconstructFrom(ctx.sessionManager.getBranch());
});
```

### ❌ DON'T: Module-Level State

```typescript
// Wrong - breaks on reload and branching
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
```

### ❌ DON'T: External Files

```typescript
// Wrong - breaks branching semantics
const STATE_FILE = "/tmp/my-extension-state.json";

async function loadState() {
  return JSON.parse(await readFile(STATE_FILE, "utf8"));
}

async function saveState(state: any) {
  await writeFile(STATE_FILE, JSON.stringify(state));
}
```

---

## State Migration

When changing state schema:

```typescript
interface StateV1 {
  counter: number;
}

interface StateV2 {
  counter: number;
  items: string[];  // New field
  version: number;  // Schema version
}

function migrateState(state: any): StateV2 {
  if (!state.version) {
    // Migrate from V1 to V2
    return {
      ...state,
      items: [],
      version: 2
    };
  }
  return state as StateV2;
}

pi.on("session_start", async (_event, ctx) => {
  const entries = ctx.sessionManager.getBranch();
  const stateEntry = entries.find(
    e => e.type === "custom" && e.customType === "my-extension"
  );
  
  if (stateEntry) {
    state = migrateState(stateEntry.data);
  }
});
```

---

## Example: Stateful Game

```typescript
interface GameState {
  snake: Point[];
  food: Point;
  score: number;
  highScore: number;
  gameOver: boolean;
}

const SNAKE_SAVE_TYPE = "snake-save";

pi.registerCommand("snake", {
  handler: async (_args, ctx) => {
    // Load saved state
    const entries = ctx.sessionManager.getEntries();
    let savedState: GameState | undefined;
    
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (entry.type === "custom" && entry.customType === SNAKE_SAVE_TYPE) {
        savedState = entry.data as GameState;
        break;
      }
    }
    
    await ctx.ui.custom((tui, _theme, _kb, done) => {
      return new SnakeComponent(
        tui,
        () => done(undefined),
        (state) => {
          // Save or clear state
          pi.appendEntry(SNAKE_SAVE_TYPE, state);
        },
        savedState
      );
    });
  }
});
```

---

## Debugging State

### Log State Reconstruction

```typescript
pi.on("session_start", async (_event, ctx) => {
  const branch = ctx.sessionManager.getBranch();
  console.log("[session_start] Branch length:", branch.length);
  
  state = reconstructFrom(branch);
  console.log("[session_start] Reconstructed state:", state);
});
```

### Inspect Session Entries

```typescript
pi.registerCommand("debug-state", {
  handler: async (_args, ctx) => {
    const entries = ctx.sessionManager.getEntries();
    const customEntries = entries.filter(e => e.type === "custom");
    
    ctx.ui.notify(
      `Custom entries:\n${customEntries.map(e => 
        `- ${e.customType}: ${JSON.stringify(e.data)}`
      ).join("\n")}`,
      "info"
    );
  }
});
```

---

**Next Steps**:
- Read [PI-DEV-EVENTS.md](./PI-DEV-EVENTS.md) for session events
- Read [PI-DEV-TOOLS.md](./PI-DEV-TOOLS.md) for tool state patterns
- Browse `$PI_CODING_AGENT_PACKAGE/examples/extensions/todo.ts`

