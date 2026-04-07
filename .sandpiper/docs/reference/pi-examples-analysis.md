# Pi Examples - Comprehensive Analysis

**Date**: 2026-04-16  
**Files Analyzed**: 113 example files (70+ extensions, 13 SDK examples, supporting files)  
**Purpose**: Extract patterns, best practices, and architectural insights from Pi's example code

---

## Example Organization

### Extension Examples (70+ files)

Organized by capability/pattern:

#### Lifecycle & Safety (8 examples)
| File | Pattern | Key Insight |
|------|---------|-------------|
| `permission-gate.ts` | `tool_call` interception | Block dangerous commands with `ctx.ui.confirm()` |
| `protected-paths.ts` | `tool_call` blocking | Block writes to `.env`, `.git/`, `node_modules/` |
| `confirm-destructive.ts` | `session_before_*` events | Cancel session actions (clear, switch, fork) |
| `dirty-repo-guard.ts` | `session_before_switch`, `session_before_fork` | Check git status before context changes |
| `sandbox/` | OS-level sandboxing | Uses `@anthropic-ai/sandbox-runtime` (bubblewrap/sandbox-exec) |
| `inline-bash.ts` | `input` transformation | Expand `!{command}` patterns before agent sees prompt |
| `interactive-shell.ts` | `user_bash` hook | Run vim/htop/git rebase with full terminal access |
| `git-checkpoint.ts` | `turn_start` stashing | Create git stash at each turn for `/fork` restoration |

#### Custom Tools (15 examples)
| File | Pattern | Key Insight |
|------|---------|-------------|
| `hello.ts` | Minimal tool | Basic `defineTool()` pattern |
| `todo.ts` | State persistence | Store state in `details`, reconstruct from session branch |
| `question.ts` | Custom UI | `ctx.ui.custom()` with options list + inline editor |
| `questionnaire.ts` | Multi-question UI | Tab bar navigation between questions |
| `tool-override.ts` | Built-in override | Replace `read` with auditing/logging version |
| `built-in-tool-renderer.ts` | Custom rendering | Override renderCall/renderResult, delegate execute |
| `minimal-mode.ts` | Collapsed view | Show only tool call in collapsed, full output expanded |
| `truncated-tool.ts` | Output truncation | Use `truncateHead()`, save full output to temp file |
| `antigravity-image-gen.ts` | Image generation | Google Antigravity integration, save modes |
| `ssh.ts` | Remote delegation | All tools (read/write/edit/bash) run via SSH |
| `subagent/` | Subagent delegation | Spawn `pi` subprocesses with isolated context |
| `dynamic-tools.ts` | Runtime registration | Register tools in `session_start` and via commands |
| `tools.ts` | Tool configuration | `/tools` command with `SettingsList` UI |
| `handoff.ts` | Context transfer | Extract conversation, generate focused prompt for new session |
| `with-deps/` | External dependencies | Extension with own `package.json`, jiti resolution |

#### Commands & UI (20 examples)
| File | Pattern | Key Insight |
|------|---------|-------------|
| `preset.ts` | Named configurations | Model, thinking, tools, instructions via JSON config |
| `plan-mode/` | Read-only mode | Bash allowlist, plan extraction, `[DONE:n]` markers |
| `commands.ts` | `pi.getCommands()` | List all slash commands with source filtering |
| `status-line.ts` | `ctx.ui.setStatus()` | Turn progress in footer with themed colors |
| `widget-placement.ts` | `ctx.ui.setWidget()` | Widgets above/below editor |
| `hidden-thinking-label.ts` | `ctx.ui.setHiddenThinkingLabel()` | Customize collapsed thinking label |
| `model-status.ts` | `model_select` hook | Show model changes in status bar |
| `snake.ts` | Real-time game | `setInterval` game loop, state persistence via session entries |
| `send-user-message.ts` | `pi.sendUserMessage()` | Send as user with `deliverAs: "steer"` or `"followUp"` |
| `timed-confirm.ts` | AbortSignal timeout | Auto-dismiss dialogs with countdown |
| `rpc-demo.ts` | RPC UI methods | Exercise all RPC-supported extension UI methods |
| `modal-editor.ts` | `CustomEditor` | vim-like modal editing (normal/insert modes) |
| `rainbow-editor.ts` | Animated editor | Highlight "ultrathink" with cycling RGB shine |
| `notify.ts` | Native notifications | OSC 777 (Ghostty/iTerm2), OSC 99 (Kitty), Windows toast |
| `titlebar-spinner.ts` | `ctx.ui.setTitle()` | Braille spinner in terminal title |
| `summarize.ts` | Conversation summary | GPT-5.2 summary in custom UI with markdown |
| `shutdown-command.ts` | `ctx.shutdown()` | Clean exit via `/quit` command or tool |
| `overlay-test.ts` | Overlay with inputs | IME support via `Focusable` interface, `CURSOR_MARKER` |
| `overlay-qa-tests.ts` | Overlay positioning | 9 anchors, margins, stacking, responsive visibility |
| `reload-runtime.ts` | `ctx.reload()` | Reload extensions/skills/prompts/themes |

#### Git Integration (2 examples)
| File | Pattern | Key Insight |
|------|---------|-------------|
| `git-checkpoint.ts` | Turn-based stashing | `git stash create` at `turn_start`, restore on `/fork` |
| `auto-commit-on-exit.ts` | `session_shutdown` hook | Auto-commit with last assistant message as commit message |

#### System Prompt & Compaction (4 examples)
| File | Pattern | Key Insight |
|------|---------|-------------|
| `pirate.ts` | `before_agent_start` append | Dynamic personality injection via command toggle |
| `claude-rules.ts` | `session_start` scanning | Scan `.claude/rules/`, list in system prompt |
| `custom-compaction.ts` | `session_before_compact` | Full conversation summary with different model |
| `trigger-compact.ts` | `turn_end` monitoring | Auto-compact when context > 100k tokens |

#### System Integration (3 examples)
| File | Pattern | Key Insight |
|------|---------|-------------|
| `mac-system-theme.ts` | macOS integration | Poll `osascript` for dark mode, `ctx.ui.setTheme()` |
| `message-renderer.ts` | `registerMessageRenderer` | Custom rendering for "status-update" messages |
| `event-bus.ts` | `pi.events` | Inter-extension communication via event emitter |

#### Session Metadata (2 examples)
| File | Pattern | Key Insight |
|------|---------|-------------|
| `session-name.ts` | `setSessionName()` | Friendly names for session selector |
| `bookmark.ts` | `setLabel()` | Mark entries for `/tree` navigation |

#### Custom Providers (4 examples)
| File | Pattern | Key Insight |
|------|---------|-------------|
| `custom-provider-anthropic/` | OAuth + custom streaming | Full Anthropic SDK integration, PKCE OAuth |
| `custom-provider-gitlab-duo/` | Proxy delegation | GitLab AI Gateway → Anthropic/OpenAI streaming |
| `custom-provider-qwen-cli/` | Device code flow | Qwen OAuth with device code authentication |
| `provider-payload.ts` | Debug tool | Show exact provider API payload |

#### Advanced TUI (10 examples)
| File | Pattern | Key Insight |
|------|---------|-------------|
| `doom-overlay/` | Real-time game overlay | DOOM at 35 FPS via WASM, half-block rendering |
| `space-invaders.ts` | (Not read yet) | Another game example |
| `overlay-test.ts` | Input handling | Inline text inputs with cursor tracking |
| `overlay-qa-tests.ts` | Positioning tests | Comprehensive overlay positioning QA |
| `modal-editor.ts` | Custom editor | vim-like modal editing |
| `rainbow-editor.ts` | Animated text | RGB color cycling on keywords |
| `question.ts` | Custom component | Options list with "Type something..." escape hatch |
| `questionnaire.ts` | Tab navigation | Multi-question UI with progress tracking |
| `snake.ts` | Game state | Session persistence for in-progress games |
| `rpc-extension-ui.ts` | (Not read yet) | RPC UI protocol demonstration |

#### Special Patterns (5 examples)
| File | Pattern | Key Insight |
|------|---------|-------------|
| `dynamic-resources/` | `resources_discover` | Load skills, prompts, themes dynamically |
| `file-trigger.ts` | File watching | Watch trigger file, inject contents into conversation |
| `bash-spawn-hook.ts` | (Not read yet) | Custom bash spawning |
| `hidden-thinking-label.ts` | UI customization | Change collapsed thinking block label |
| `system-prompt-header.ts` | `ctx.getSystemPrompt()` | Display system prompt length in status |

### SDK Examples (13 files)

| File | Purpose | Key Pattern |
|------|---------|-------------|
| `01-minimal.ts` | Simplest usage | `createAgentSession()` with all defaults |
| `02-custom-model.ts` | Model selection | Pass `model` and `thinkingLevel` |
| `03-custom-prompt.ts` | Prompt modification | `systemPromptOverride` in `DefaultResourceLoader` |
| `04-skills.ts` | Skills configuration | Filter or replace discovered skills |
| `05-tools.ts` | Tool configuration | Built-in tools + custom tools |
| `06-extensions.ts` | Extensions | Inline extension factories + file paths |
| `07-context-files.ts` | Context files | AGENTS.md loading configuration |
| `08-prompt-templates.ts` | Prompt templates | File-based prompt template loading |
| `09-api-keys-and-oauth.ts` | Authentication | API key resolution, OAuth configuration |
| `10-settings.ts` | Settings overrides | Compaction, retry, terminal settings |
| `11-sessions.ts` | Session management | In-memory, persistent, continue, list |
| `12-full-control.ts` | Complete replacement | No discovery, explicit everything |
| `13-session-runtime.ts` | Runtime management | Replace active session, rebind subscriptions |

---

## Key Patterns Extracted

### 1. Extension Event Patterns

#### Tool Interception
```typescript
pi.on("tool_call", async (event, ctx) => {
  if (event.toolName === "bash" && isDangerous(event.input.command)) {
    const ok = await ctx.ui.confirm("Dangerous!", "Allow?");
    if (!ok) return { block: true, reason: "Blocked by user" };
  }
  return undefined; // Allow to proceed
});
```

#### Session Lifecycle
```typescript
pi.on("session_start", async (event, ctx) => {
  // Initialize extension state
  // Scan for resources
  // Restore from session entries
});

pi.on("session_before_switch", async (event, ctx) => {
  // Can cancel with { cancel: true }
  // Check for uncommitted changes, unsaved work
});

pi.on("session_shutdown", async (event, ctx) => {
  // Cleanup (clear intervals, save state)
});
```

#### Turn Lifecycle
```typescript
pi.on("turn_start", async (event, ctx) => {
  // Create checkpoints, update status
});

pi.on("turn_end", async (event, ctx) => {
  // Extract progress, mark completed steps
  // Check context usage, trigger compaction
});

pi.on("agent_start", async (event, ctx) => {
  // Start animations, update title
});

pi.on("agent_end", async (event, ctx) => {
  // Stop animations, send notifications
});
```

#### Input Transformation
```typescript
pi.on("input", async (event, ctx) => {
  const text = expandInlineCommands(event.text);
  return { action: "transform", text, images: event.images };
});
```

#### User Bash Hook
```typescript
pi.on("user_bash", async (event, ctx) => {
  if (isInteractive(event.command)) {
    const exitCode = await runInteractive(event.command);
    return { result: { output: "...", exitCode } };
  }
  // Return undefined for normal handling
});
```

#### Context Modification
```typescript
pi.on("context", async (event) => {
  return {
    messages: event.messages.filter(m => !isStale(m))
  };
});

pi.on("before_agent_start", async (event) => {
  return {
    systemPrompt: event.systemPrompt + "\n\nAdditional instructions...",
    message: {
      customType: "injection",
      content: "Context-specific guidance",
      display: false
    }
  };
});
```

### 2. State Persistence Patterns

#### Session Entries for Extension State
```typescript
// Store state in tool result details
return {
  content: [{ type: "text", text: "Done" }],
  details: { todos: [...todos], nextId }  // Persisted in session
};

// Reconstruct on session events
pi.on("session_start", async (_event, ctx) => {
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "message" && entry.message.toolName === "todo") {
      const details = entry.message.details;
      todos = details.todos;
      nextId = details.nextId;
    }
  }
});
```

#### Custom Entry Types
```typescript
// Persist extension config
pi.appendEntry("tools-config", {
  enabledTools: Array.from(enabledTools)
});

// Persist game state
pi.appendEntry("snake-save", gameState);

// Restore from branch
const entries = ctx.sessionManager.getBranch();
const configEntry = entries
  .filter(e => e.type === "custom" && e.customType === "tools-config")
  .pop();
```

### 3. Custom Tool Patterns

#### Minimal Tool
```typescript
pi.registerTool({
  name: "hello",
  label: "Hello",
  description: "Greet someone",
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

#### Tool with Custom Rendering
```typescript
pi.registerTool({
  name: "todo",
  // ... execute ...
  renderCall(args, theme, _context) {
    return new Text(
      theme.fg("toolTitle", theme.bold("todo ")) +
      theme.fg("muted", args.action),
      0, 0
    );
  },
  renderResult(result, { expanded }, theme, _context) {
    if (!expanded) return new Text("✓ Done", 0, 0);
    return new Text(result.content[0].text, 0, 0);
  }
});
```

#### Override Built-in Tool
```typescript
const originalRead = createReadTool(cwd);
pi.registerTool({
  ...originalRead,
  name: "read",  // Same name = override
  async execute(id, params, signal, onUpdate) {
    // Add auditing, access control, etc.
    await logAccess(params.path);
    return originalRead.execute(id, params, signal, onUpdate);
  }
  // No renderCall/renderResult = uses built-in renderer
});
```

#### Tool with Truncation
```typescript
const truncation = truncateHead(output, {
  maxLines: DEFAULT_MAX_LINES,
  maxBytes: DEFAULT_MAX_BYTES
});

if (truncation.truncated) {
  const tempFile = await saveFullOutput(output);
  resultText += `\n\n[Output truncated. Full output: ${tempFile}]`;
}

return {
  content: [{ type: "text", text: resultText }],
  details: { truncation, fullOutputPath: tempFile }
};
```

### 4. Custom UI Patterns

#### Simple Selector
```typescript
const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
  const selectList = new SelectList(items, visibleCount, theme);
  selectList.onSelect = (item) => done(item.value);
  selectList.onCancel = () => done(null);
  
  return {
    render(width) { return selectList.render(width); },
    invalidate() { selectList.invalidate(); },
    handleInput(data) { selectList.handleInput(data); tui.requestRender(); }
  };
});
```

#### Overlay with Positioning
```typescript
const result = await ctx.ui.custom(
  (tui, theme, _kb, done) => new MyComponent(tui, theme, done),
  {
    overlay: true,
    overlayOptions: {
      anchor: "right-center",  // 9 positions
      width: "50%",            // or number
      margin: 2,               // or { top, right, bottom, left }
      offsetX: -2,
      offsetY: 0,
      visible: (w, h) => w >= 80,  // Responsive
      onHandle: (handle) => {
        // handle.setHidden(true/false) for programmatic control
      }
    }
  }
);
```

#### Custom Editor
```typescript
class ModalEditor extends CustomEditor {
  private mode: "normal" | "insert" = "insert";
  
  handleInput(data: string) {
    if (matchesKey(data, "escape")) {
      this.mode = this.mode === "insert" ? "normal" : super.handleInput(data);
      return;
    }
    if (this.mode === "insert") {
      super.handleInput(data);
    } else {
      // Normal mode: hjkl navigation
      if (data in NORMAL_KEYS) {
        const seq = NORMAL_KEYS[data];
        if (seq) super.handleInput(seq);
      }
    }
  }
  
  render(width: number) {
    const lines = super.render(width);
    // Add mode indicator
    lines[lines.length - 1] += this.mode === "normal" ? " NORMAL" : " INSERT";
    return lines;
  }
}

pi.on("session_start", (_event, ctx) => {
  ctx.ui.setEditorComponent((tui, theme, kb) => new ModalEditor(tui, theme, kb));
});
```

#### Focusable Component (IME Support)
```typescript
import { CURSOR_MARKER, type Focusable } from "@mariozechner/pi-tui";

class MyInput implements Component, Focusable {
  focused: boolean = false;  // Set by TUI when focus changes
  
  render(width: number): string[] {
    const marker = this.focused ? CURSOR_MARKER : "";
    return [`> ${beforeCursor}${marker}\x1b[7m${atCursor}\x1b[27m${afterCursor}`];
  }
}
```

### 5. Custom Provider Patterns

#### OAuth with PKCE
```typescript
async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const verifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return { verifier, challenge };
}

async function loginMyProvider(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
  const { verifier, challenge } = await generatePKCE();
  
  callbacks.onAuth({ 
    url: `https://auth.example.com/authorize?code_challenge=${challenge}&...` 
  });
  
  const code = await callbacks.onPrompt({ message: "Paste authorization code:" });
  
  const response = await fetch("https://auth.example.com/token", {
    method: "POST",
    body: JSON.stringify({ code, code_verifier: verifier, ... })
  });
  
  const data = await response.json();
  return {
    refresh: data.refresh_token,
    access: data.access_token,
    expires: Date.now() + data.expires_in * 1000 - 5 * 60 * 1000
  };
}
```

#### Custom Streaming
```typescript
function streamMyProvider(
  model: Model<Api>,
  context: Context,
  options?: SimpleStreamOptions
): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();
  
  (async () => {
    const output: AssistantMessage = { /* ... */ };
    
    try {
      const response = await fetch(model.baseUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${options?.apiKey}`, ... },
        body: JSON.stringify({ /* ... */ }),
        signal: options?.signal
      });
      
      for await (const chunk of response.body) {
        // Parse SSE, push events to stream
        stream.push({ type: "text_delta", delta: chunk.text, partial: output });
      }
      
      stream.push({ type: "done", reason: "stop", message: output });
      stream.end();
    } catch (error) {
      stream.push({ type: "error", reason: "error", error: { /* ... */ } });
      stream.end();
    }
  })();
  
  return stream;
}

pi.registerProvider("my-provider", {
  baseUrl: "https://api.example.com",
  apiKey: "MY_API_KEY",
  api: "my-api",
  models: [/* ... */],
  oauth: { login: loginMyProvider, refreshToken: refreshMyProvider, getApiKey: ... },
  streamSimple: streamMyProvider
});
```

### 6. SDK Usage Patterns

#### Minimal Session
```typescript
import { createAgentSession } from "@mariozechner/pi-coding-agent";

const { session } = await createAgentSession();

session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await session.prompt("Hello");
```

#### Full Control
```typescript
import {
  AuthStorage,
  ModelRegistry,
  createAgentSession,
  createReadTool,
  createBashTool,
  SessionManager,
  SettingsManager
} from "@mariozechner/pi-coding-agent";

const authStorage = AuthStorage.create("/custom/path/auth.json");
authStorage.setRuntimeApiKey("anthropic", process.env.ANTHROPIC_API_KEY);

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
  settingsManager: SettingsManager.inMemory({ compaction: { enabled: false } })
});
```

#### Session Runtime Management
```typescript
import { createAgentSessionRuntime, createAgentSessionServices } from "@mariozechner/pi-coding-agent";

const runtime = await createAgentSessionRuntime(createRuntime, {
  cwd: process.cwd(),
  sessionManager: SessionManager.create(process.cwd())
});

let unsubscribe: (() => void) | undefined;

async function bindSession() {
  unsubscribe?.();
  const session = runtime.session;
  await session.bindExtensions({});
  unsubscribe = session.subscribe(handleEvent);
  return session;
}

let session = await bindSession();

await runtime.newSession();
session = await bindSession();  // Rebind subscriptions!

await runtime.switchSession(sessionFile);
session = await bindSession();

await runtime.dispose();
```

---

## Advanced Patterns

### 1. Subagent Delegation

The `subagent/` example demonstrates spawning separate `pi` processes:

```typescript
async function runSingleAgent(
  agents: AgentConfig[],
  agentName: string,
  task: string,
  signal?: AbortSignal,
  onUpdate?: OnUpdateCallback
): Promise<SingleResult> {
  const agent = agents.find(a => a.name === agentName);
  
  const args = ["--mode", "json", "-p", "--no-session"];
  if (agent.systemPrompt) {
    const { filePath } = await writePromptToTempFile(agent.systemPrompt);
    args.push("--append-system-prompt", filePath);
  }
  
  const proc = spawn("pi", args, { stdio: ["ignore", "pipe", "pipe"] });
  
  // Parse JSONL output
  for await (const line of proc.stdout) {
    const event = JSON.parse(line);
    if (event.type === "message_end") {
      currentResult.messages.push(event.message);
      onUpdate?.({ content: [...], details: {...} });
    }
  }
  
  return { exitCode, messages, usage, ... };
}
```

**Key insights:**
- Uses `--mode json` for structured output
- `--no-session` for isolated context
- Temp file for system prompt (avoids shell escaping)
- Streaming updates via `onUpdate` callback
- AbortSignal propagation to kill subprocess

### 2. Real-time Game Loop (Snake)

```typescript
class SnakeComponent {
  private interval: ReturnType<typeof setInterval> | null = null;
  private version = 0;  // For cache invalidation
  
  private startGame(): void {
    this.interval = setInterval(() => {
      if (!this.state.gameOver) {
        this.tick();
        this.version++;
        this.tui.requestRender();  // Trigger re-render
      }
    }, TICK_MS);
  }
  
  handleInput(data: string) {
    if (matchesKey(data, "escape")) {
      this.dispose();
      this.onSave(this.state);  // Persist to session
      this.onClose();
      return;
    }
    // Update direction, etc.
  }
  
  render(width: number): string[] {
    if (width === this.cachedWidth && this.cachedVersion === this.version) {
      return this.cachedLines;  // Cache hit
    }
    // Render game grid with ANSI colors
    this.cachedLines = lines;
    this.cachedWidth = width;
    this.cachedVersion = this.version;
    return lines;
  }
}
```

### 3. DOOM Overlay (35 FPS)

The `doom-overlay/` example is the most advanced TUI usage:

```typescript
class DoomOverlayComponent {
  private animationFrame: ReturnType<typeof requestAnimationFrame> | null = null;
  
  constructor(private engine: DoomEngine, ...) {
    this.gameLoop();
  }
  
  private gameLoop(): void {
    if (this.engine.isRunning()) {
      this.engine.tick();  // Update game state
      this.tui.requestRender();  // Request frame render
      this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }
  }
  
  render(width: number): string[] {
    const frame = this.engine.getFrame();  // 320x200 RGB pixels
    return this.renderHalfBlockFrame(frame, width);  // Convert to ANSI
  }
}
```

**Key insights:**
- Uses `requestAnimationFrame` for smooth rendering
- Half-block characters (▀) for 2:1 aspect ratio
- 24-bit color via SGR true color codes
- Overlay with `width: "75%", maxHeight: "95%"`
- WASM DOOM engine (`doomgeneric`)

### 4. SSH Tool Delegation

The `ssh.ts` example shows complete tool override for remote execution:

```typescript
function createRemoteReadOps(remote: string, remoteCwd: string): ReadOperations {
  const toRemote = (p: string) => p.replace(localCwd, remoteCwd);
  return {
    readFile: (p) => sshExec(remote, `cat ${JSON.stringify(toRemote(p))}`),
    access: (p) => sshExec(remote, `test -r ${JSON.stringify(toRemote(p))}`),
    detectImageMimeType: async (p) => {
      const r = await sshExec(remote, `file --mime-type -b ${JSON.stringify(toRemote(p))}`);
      return r.toString().trim();
    }
  };
}

pi.registerTool({
  ...localRead,
  async execute(id, params, signal, onUpdate, _ctx) {
    const ssh = getSsh();
    if (ssh) {
      const tool = createReadTool(localCwd, {
        operations: createRemoteReadOps(ssh.remote, ssh.remoteCwd, localCwd)
      });
      return tool.execute(id, params, signal, onUpdate);
    }
    return localRead.execute(id, params, signal, onUpdate);
  }
});
```

**Key insights:**
- Override built-in tools by spreading and replacing `execute`
- Custom operations interface for file/bash/edit/write
- SSH command construction with proper escaping
- Fallback to local execution when SSH not configured
- `user_bash` hook for `!` command delegation

---

## Best Practices Extracted

### 1. Extension Design

✅ **DO:**
- Use `session_start` for initialization
- Persist state in session entries (not external files)
- Provide both command and tool interfaces when useful
- Use `ctx.ui.notify()` for user feedback
- Handle non-interactive mode (`ctx.hasUI` checks)
- Clean up on `session_shutdown` (clear intervals, etc.)

❌ **DON'T:**
- Store state in external files (breaks branching)
- Assume UI is available
- Forget to handle abort signals
- Block the event loop with synchronous operations

### 2. Tool Design

✅ **DO:**
- Document truncation limits in tool description
- Use `details` for state persistence
- Provide `renderCall` for informative pending display
- Use `renderResult` with `expanded` flag for collapsed/expanded views
- Save full output to temp file when truncated
- Include `isPartial` handling for streaming tools

❌ **DON'T:**
- Return unbounded output (will overwhelm context)
- Forget to handle `signal.aborted`
- Use `any` for parameters (use TypeBox schemas)
- Block the main thread with sync operations

### 3. Custom UI

✅ **DO:**
- Cache rendered output with `cachedWidth`/`cachedLines`
- Implement `invalidate()` for theme changes
- Use `truncateToWidth()` for all output lines
- Implement `Focusable` for components with text cursors
- Use `CURSOR_MARKER` for IME support
- Handle both keyboard and mouse input when practical

❌ **DON'T:**
- Return lines exceeding `width` parameter
- Forget to call `tui.requestRender()` on state changes
- Pre-bake theme colors into cached strings
- Assume terminal supports true color (provide fallbacks)

### 4. State Management

✅ **DO:**
- Store state in tool result `details`
- Reconstruct from `ctx.sessionManager.getBranch()`
- Handle branch navigation (`session_tree` event)
- Use `pi.appendEntry()` for non-tool state
- Filter entries by `customType` for restoration

❌ **DON'T:**
- Store state in module-level variables (breaks on reload)
- Write to external files (breaks branching)
- Assume linear session history (sessions are trees!)
- Forget to handle session resume

---

## Token Efficiency Patterns

From the examples, several token optimization strategies emerge:

### 1. Collapsed Tool Output
```typescript
renderResult(result, { expanded }, theme) {
  if (!expanded) {
    // Minimal: just status
    return new Text(theme.fg("success", "✓ Done"), 0, 0);
  }
  // Expanded: full output
  return new Text(result.content[0].text, 0, 0);
}
```

### 2. Truncated Output with Escape Hatch
```typescript
if (truncation.truncated) {
  resultText += `\n\n[Output truncated: ${truncation.outputLines}/${truncation.totalLines} lines. Full output: ${tempFile}]`;
}
```

### 3. Progressive Disclosure (Skills)
```yaml
# SKILL.md frontmatter - only description in prompt
---
name: pdf-tools
description: Extract text and tables from PDF files, fills PDF forms, and merges multiple PDFs. Use when working with PDF documents.
---
# Full content loaded on-demand when skill is used
```

### 4. Summary Instead of Full Context
```typescript
// custom-compaction.ts - summarize entire conversation
const summary = await complete(model, {
  messages: [{
    role: "user",
    content: [{
      type: "text",
      text: `Summarize this conversation: ${conversationText}`
    }]
  }]
});

return { compaction: { summary, firstKeptEntryId, tokensBefore } };
```

---

## Security Patterns

### 1. Input Validation
```typescript
// permission-gate.ts - dangerous command detection
const dangerousPatterns = [
  /\brm\s+(-rf?|--recursive)/i,
  /\bsudo\b/i,
  /\b(chmod|chown)\b.*777/i
];

if (dangerousPatterns.some(p => p.test(command))) {
  const ok = await ctx.ui.confirm("Dangerous!", "Allow?");
  if (!ok) return { block: true, reason: "Blocked" };
}
```

### 2. Path Protection
```typescript
// protected-paths.ts
const protectedPaths = [".env", ".git/", "node_modules/"];

if (protectedPaths.some(p => path.includes(p))) {
  return { block: true, reason: `Path "${path}" is protected` };
}
```

### 3. OS-level Sandboxing
```typescript
// sandbox/ - uses @anthropic-ai/sandbox-runtime
await SandboxManager.initialize({
  network: { allowedDomains: ["github.com", "*.github.com"] },
  filesystem: {
    denyRead: ["~/.ssh", "~/.aws"],
    allowWrite: [".", "/tmp"]
  }
});

const wrappedCommand = await SandboxManager.wrapWithSandbox(command);
```

### 4. Subagent Security
```typescript
// subagent/ - project-local agent confirmation
if (agentScope === "project" || agentScope === "both") {
  const ok = await ctx.ui.confirm(
    "Run project-local agents?",
    `Agents: ${names}\nSource: ${dir}\n\nProject agents are repo-controlled.`
  );
  if (!ok) return { content: [{ type: "text", text: "Canceled" }] };
}
```

---

## Integration Patterns

### 1. Git Integration
```typescript
// git-checkpoint.ts - stash at each turn
pi.on("turn_start", async () => {
  const { stdout } = await pi.exec("git", ["stash", "create"]);
  if (stdout.trim() && currentEntryId) {
    checkpoints.set(currentEntryId, stdout.trim());
  }
});

pi.on("session_before_fork", async (event, ctx) => {
  const ref = checkpoints.get(event.entryId);
  if (ref && ctx.hasUI) {
    const choice = await ctx.ui.select("Restore code state?", [...]);
    if (choice?.startsWith("Yes")) {
      await pi.exec("git", ["stash", "apply", ref]);
    }
  }
});
```

### 2. System Integration
```typescript
// mac-system-theme.ts - sync with macOS dark mode
async function isDarkMode(): Promise<boolean> {
  const { stdout } = await execAsync(
    "osascript -e 'tell application \"System Events\" to return dark mode'"
  );
  return stdout.trim() === "true";
}

pi.on("session_start", async (_event, ctx) => {
  let currentTheme = (await isDarkMode()) ? "dark" : "light";
  ctx.ui.setTheme(currentTheme);
  
  intervalId = setInterval(async () => {
    const newTheme = (await isDarkMode()) ? "dark" : "light";
    if (newTheme !== currentTheme) {
      currentTheme = newTheme;
      ctx.ui.setTheme(currentTheme);
    }
  }, 2000);
});
```

### 3. Notification Integration
```typescript
// notify.ts - native terminal notifications
function notify(title: string, body: string): void {
  if (process.env.WT_SESSION) {
    // Windows Terminal toast
    notifyWindows(title, body);
  } else if (process.env.KITTY_WINDOW_ID) {
    // Kitty OSC 99
    notifyOSC99(title, body);
  } else {
    // OSC 777 (Ghostty, iTerm2, WezTerm)
    notifyOSC777(title, body);
  }
}

pi.on("agent_end", async () => {
  notify("Pi", "Ready for input");
});
```

---

## Conclusion

The Pi examples demonstrate a remarkably consistent and well-designed extension system. Key takeaways:

1. **Event-driven architecture**: Everything flows through events (`session_start`, `tool_call`, `turn_end`, etc.)

2. **State in session**: Extension state lives in session entries, not external files, enabling proper branching

3. **Progressive disclosure**: Skills, tools, and UI all use collapsed views with expand-on-demand

4. **Composable tools**: Built-in tools can be overridden, wrapped, or delegated (SSH, sandbox)

5. **Rich TUI**: Custom components, overlays, games at 35 FPS, IME support

6. **Security first**: Permission gates, path protection, OS sandboxing, subagent confirmation

7. **SDK completeness**: Programmatic control over every aspect (models, tools, extensions, sessions)

8. **Real-world patterns**: Git integration, system theme sync, native notifications, OAuth providers

The examples are production-quality, not toy demos. They show how to build:
- Safety layers (permission gates, protected paths, sandboxing)
- Workflow enhancements (plan mode, presets, handoff)
- System integrations (Git, macOS, notifications)
- Advanced UI (games, overlays, custom editors)
- Provider integrations (custom OAuth, streaming implementations)

This is a mature, extensible platform with thoughtful design throughout.
