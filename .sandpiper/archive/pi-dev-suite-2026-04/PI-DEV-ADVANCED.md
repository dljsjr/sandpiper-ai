# Pi Advanced Extension Techniques

**Target**: Experienced extension developers  
**Related**: [PI-DEV-UI.md](./PI-DEV-UI.md), [PI-DEV-PROVIDERS.md](./PI-DEV-PROVIDERS.md)

---

## Subagent Delegation

### Spawning Pi Subprocesses

```typescript
import { spawn } from "node:child_process";
import { type Message } from "@mariozechner/pi-ai";

interface SubagentResult {
  exitCode: number;
  messages: Message[];
  stderr: string;
  usage: { input: number; output: number; cost: number };
}

async function runSubagent(
  agentName: string,
  task: string,
  cwd: string,
  signal?: AbortSignal
): Promise<SubagentResult> {
  const args = [
    "--mode", "json",      // Structured output
    "-p", task,            // Prompt
    "--no-session"         // Isolated context
  ];
  
  const result: SubagentResult = {
    exitCode: 0,
    messages: [],
    stderr: "",
    usage: { input: 0, output: 0, cost: 0 }
  };
  
  return new Promise((resolve, reject) => {
    const proc = spawn("pi", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"]
    });
    
    let buffer = "";
    
    proc.stdout.on("data", (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const event = JSON.parse(line);
          
          if (event.type === "message_end" && event.message) {
            result.messages.push(event.message);
            
            if (event.message.role === "assistant") {
              result.usage.input += event.message.usage?.input || 0;
              result.usage.output += event.message.usage?.output || 0;
              result.usage.cost += event.message.usage?.cost?.total || 0;
            }
          }
        } catch {
          // Ignore parse errors
        }
      }
    });
    
    proc.stderr.on("data", (data) => {
      result.stderr += data.toString();
    });
    
    proc.on("close", (code) => {
      result.exitCode = code ?? 0;
      resolve(result);
    });
    
    proc.on("error", reject);
    
    // Handle abort
    if (signal) {
      signal.addEventListener("abort", () => {
        proc.kill("SIGTERM");
        setTimeout(() => proc.kill("SIGKILL"), 5000);
      }, { once: true });
    }
  });
}
```

### Parallel Subagents

```typescript
async function runParallelSubagents(
  tasks: Array<{ agent: string; task: string }>,
  maxConcurrency = 4
) {
  const results: SubagentResult[] = new Array(tasks.length);
  let nextIndex = 0;
  
  const workers = new Array(maxConcurrency).fill(null).map(async () => {
    while (true) {
      const current = nextIndex++;
      if (current >= tasks.length) return;
      
      results[current] = await runSubagent(
        tasks[current].agent,
        tasks[current].task,
        cwd
      );
    }
  });
  
  await Promise.all(workers);
  return results;
}

// Usage
const results = await runParallelSubagents([
  { agent: "scout", task: "Find all auth code" },
  { agent: "scout", task: "Find all API endpoints" },
  { agent: "reviewer", task: "Review security practices" }
], 3);
```

### Chained Subagents

```typescript
async function runSubagentChain(
  steps: Array<{ agent: string; task: string }>
) {
  let previousOutput = "";
  const results: SubagentResult[] = [];
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const taskWithContext = step.task.replace("{previous}", previousOutput);
    
    const result = await runSubagent(step.agent, taskWithContext, cwd);
    results.push(result);
    
    if (result.exitCode !== 0) {
      // Stop at first failure
      return {
        success: false,
        failedAt: i,
        results,
        error: result.stderr
      };
    }
    
    // Extract final output for next step
    previousOutput = extractFinalOutput(result.messages);
  }
  
  return { success: true, results };
}

// Usage
const chain = await runSubagentChain([
  { agent: "scout", task: "Explore the codebase structure" },
  { agent: "planner", task: "Create implementation plan based on: {previous}" },
  { agent: "worker", task: "Implement the plan: {previous}" }
]);
```

---

## Real-Time Rendering

### Game Loop Pattern

```typescript
class SnakeGame {
  private tui: TUI;
  private interval: ReturnType<typeof setInterval> | null = null;
  private version = 0;
  private cachedLines: string[] = [];
  private cachedWidth = 0;
  
  private state: GameState = {
    snake: [{ x: 10, y: 10 }],
    food: { x: 20, y: 10 },
    direction: "right",
    score: 0
  };
  
  constructor(tui: TUI) {
    this.tui = tui;
    this.startGame();
  }
  
  private startGame() {
    this.interval = setInterval(() => {
      this.tick();
      this.version++;
      this.tui.requestRender();
    }, 100);  // 10 FPS
  }
  
  private tick() {
    // Update game state
    const head = { ...this.state.snake[0] };
    
    switch (this.state.direction) {
      case "up": head.y--; break;
      case "down": head.y++; break;
      case "left": head.x--; break;
      case "right": head.x++; break;
    }
    
    // Check collisions
    if (this.checkCollision(head)) {
      this.gameOver();
      return;
    }
    
    this.state.snake.unshift(head);
    
    // Check food
    if (head.x === this.state.food.x && head.y === this.state.food.y) {
      this.state.score += 10;
      this.state.food = this.spawnFood();
    } else {
      this.state.snake.pop();
    }
  }
  
  render(width: number): string[] {
    if (this.cachedWidth === width && this.cachedLines.length > 0) {
      return this.cachedLines;
    }
    
    const lines: string[] = [];
    const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
    const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
    const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
    
    // Header
    lines.push(`Score: ${yellow(this.state.score.toString())}`);
    lines.push("");
    
    // Game grid
    for (let y = 0; y < 20; y++) {
      let row = "";
      for (let x = 0; x < 40; x++) {
        const isHead = this.state.snake[0].x === x && this.state.snake[0].y === y;
        const isBody = this.state.snake.slice(1).some(s => s.x === x && s.y === y);
        const isFood = this.state.food.x === x && this.state.food.y === y;
        
        if (isHead) row += green("██");
        else if (isBody) row += green("▓▓");
        else if (isFood) row += red("◆ ");
        else row += "  ";
      }
      lines.push(row);
    }
    
    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  }
  
  handleInput(data: string) {
    if (data === "w" || data === "\x1b[A") this.state.direction = "up";
    if (data === "s" || data === "\x1b[B") this.state.direction = "down";
    if (data === "a" || data === "\x1b[D") this.state.direction = "left";
    if (data === "d" || data === "\x1b[C") this.state.direction = "right";
  }
  
  invalidate() {
    this.cachedLines = [];
  }
  
  dispose() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
```

### DOOM-Style Overlay (35 FPS)

```typescript
class DoomOverlay {
  private tui: TUI;
  private engine: DoomEngine;
  private animationFrame: number | null = null;
  private version = 0;
  
  constructor(tui: TUI, wadPath: string) {
    this.tui = tui;
    this.engine = new DoomEngine(wadPath);
  }
  
  async init() {
    await this.engine.init();
    this.gameLoop();
  }
  
  private gameLoop() {
    if (this.engine.isRunning()) {
      this.engine.tick();  // Update game state
      this.version++;
      this.tui.requestRender();
      this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }
  }
  
  render(width: number): string[] {
    const frame = this.engine.getFrame();  // 320x200 RGB pixels
    
    // Convert to half-block characters with 24-bit color
    const lines: string[] = [];
    
    for (let y = 0; y < 100; y++) {  // 200 pixels → 100 lines (2 pixels per line)
      let line = "";
      
      for (let x = 0; x < 320; x++) {
        const topPixel = frame[y * 2][x];
        const bottomPixel = frame[y * 2 + 1][x];
        
        // Half-block: foreground = top, background = bottom
        line += `\x1b[38;2;${topPixel.r};${topPixel.g};${topPixel.b}m`;
        line += `\x1b[48;2;${bottomPixel.r};${bottomPixel.g};${bottomPixel.b}m`;
        line += "▀";
      }
      
      lines.push(line + "\x1b[0m");
    }
    
    return lines;
  }
  
  handleInput(data: string) {
    // Forward to game engine
    this.engine.handleInput(data);
  }
  
  invalidate() {
    this.version++;
  }
  
  dispose() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.engine.dispose();
  }
}

// Usage
pi.registerCommand("doom", {
  handler: async (_args, ctx) => {
    await ctx.ui.custom(
      (tui, _theme, _kb, done) => {
        const doom = new DoomOverlay(tui, "doom.wad");
        doom.init();
        
        return {
          render: (w) => doom.render(w),
          handleInput: (d) => {
            if (d === "q") {
              doom.dispose();
              done(undefined);
            } else {
              doom.handleInput(d);
              tui.requestRender();
            }
          },
          invalidate: () => doom.invalidate()
        };
      },
      {
        overlay: true,
        overlayOptions: {
          width: "75%",
          maxHeight: "95%",
          anchor: "center"
        }
      }
    );
  }
});
```

---

## SSH Tool Delegation

### Remote Operations Interface

```typescript
import { spawn } from "node:child_process";

interface RemoteOperations {
  readFile(path: string): Promise<Buffer>;
  writeFile(path: string, content: string): Promise<void>;
  exec(command: string, cwd: string): Promise<{ stdout: string; stderr: string; code: number }>;
}

function createRemoteOps(host: string): RemoteOperations {
  function sshExec(command: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const child = spawn("ssh", [host, command], {
        stdio: ["ignore", "pipe", "pipe"]
      });
      
      const chunks: Buffer[] = [];
      child.stdout.on("data", (d) => chunks.push(d));
      child.on("error", reject);
      child.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`SSH failed (${code})`));
        } else {
          resolve(Buffer.concat(chunks));
        }
      });
    });
  }
  
  return {
    readFile: (path) => sshExec(`cat ${JSON.stringify(path)}`),
    
    writeFile: async (path, content) => {
      const b64 = Buffer.from(content).toString("base64");
      await sshExec(`echo ${JSON.stringify(b64)} | base64 -d > ${JSON.stringify(path)}`);
    },
    
    exec: async (command, cwd) => {
      const result = await sshExec(`cd ${JSON.stringify(cwd)} && ${command}`);
      return {
        stdout: result.toString(),
        stderr: "",
        code: 0
      };
    }
  };
}
```

### Override All Tools for Remote

```typescript
const localCwd = process.cwd();
const remote = "user@host";
const remoteOps = createRemoteOps(remote);

// Override read
const localRead = createReadTool(localCwd);
pi.registerTool({
  ...localRead,
  async execute(id, params, signal, onUpdate) {
    const content = await remoteOps.readFile(params.path);
    return {
      content: [{ type: "text", text: content.toString() }],
      details: { remote: true }
    };
  }
});

// Override write
const localWrite = createWriteTool(localCwd);
pi.registerTool({
  ...localWrite,
  async execute(id, params, signal, onUpdate) {
    await remoteOps.writeFile(params.path, params.content);
    return {
      content: [{ type: "text", text: "Written" }],
      details: { remote: true }
    };
  }
});

// Override bash
const localBash = createBashTool(localCwd);
pi.registerTool({
  ...localBash,
  async execute(id, params, signal, onUpdate) {
    const result = await remoteOps.exec(params.command, params.cwd || localCwd);
    return {
      content: [{ type: "text", text: result.stdout + result.stderr }],
      details: { remote: true, code: result.code }
    };
  }
});
```

---

## File Watching

### Watch Trigger File

```typescript
import { watch } from "node:fs";

pi.on("session_start", async (_event, ctx) => {
  const triggerPath = "/tmp/pi-trigger.txt";
  
  watch(triggerPath, async (eventType) => {
    if (eventType === "change") {
      const content = await readFile(triggerPath, "utf8");
      
      // Inject into conversation
      pi.sendUserMessage(`[TRIGGER FILE UPDATED]\n\n${content}`, {
        deliverAs: ctx.isIdle() ? undefined : "followUp"
      });
      
      ctx.ui.notify("Trigger file updated", "info");
    }
  });
});
```

---

## System Integration

### macOS Dark Mode Sync

```typescript
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

async function isDarkMode(): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      "osascript -e 'tell application \"System Events\" to return dark mode'"
    );
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

pi.on("session_start", async (_event, ctx) => {
  let currentTheme = (await isDarkMode()) ? "dark" : "light";
  ctx.ui.setTheme(currentTheme);
  
  const interval = setInterval(async () => {
    const newTheme = (await isDarkMode()) ? "dark" : "light";
    if (newTheme !== currentTheme) {
      currentTheme = newTheme;
      ctx.ui.setTheme(currentTheme);
      ctx.ui.notify(`Theme: ${currentTheme}`, "info");
    }
  }, 2000);
  
  ctx.ui.once("shutdown", () => clearInterval(interval));
});
```

### Native Notifications

```typescript
function notify(title: string, body: string) {
  if (process.env.WT_SESSION) {
    // Windows Terminal
    const script = `
      [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
      $xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText01)
      $xml.GetElementsByTagName('text')[0].AppendChild($xml.CreateTextNode('${body}')) > $null
      [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('${title}').Show([Windows.UI.Notifications.ToastNotification]::new($xml))
    `;
    execFile("powershell.exe", ["-NoProfile", "-Command", script]);
  } else if (process.env.KITTY_WINDOW_ID) {
    // Kitty OSC 99
    process.stdout.write(`\x1b]99;i=1:d=0;${title}\x1b\\`);
    process.stdout.write(`\x1b]99;i=1:p=body;${body}\x1b\\`);
  } else {
    // OSC 777 (Ghostty, iTerm2, WezTerm)
    process.stdout.write(`\x1b]777;notify;${title};${body}\x07`);
  }
}

pi.on("agent_end", async () => {
  notify("Pi", "Ready for input");
});
```

---

## Custom Provider Implementation

### OAuth with PKCE

```typescript
import type { OAuthCredentials, OAuthLoginCallbacks } from "@mariozechner/pi-ai";

async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  
  const verifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  
  return { verifier, challenge };
}

async function loginMyProvider(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
  const { verifier, challenge } = await generatePKCE();
  
  callbacks.onAuth({
    url: `https://auth.example.com/authorize?client_id=xxx&code_challenge=${challenge}&response_type=code`
  });
  
  const code = await callbacks.onPrompt({ message: "Paste authorization code:" });
  
  const response = await fetch("https://auth.example.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      client_id: "xxx",
      redirect_uri: "http://localhost:8080/callback"
    })
  });
  
  const data = await response.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  
  return {
    access: data.access_token,
    refresh: data.refresh_token,
    expires: Date.now() + data.expires_in * 1000 - 5 * 60 * 1000
  };
}

async function refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
  const response = await fetch("https://auth.example.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: credentials.refresh,
      client_id: "xxx"
    })
  });
  
  const data = await response.json();
  
  return {
    access: data.access_token,
    refresh: data.refresh_token || credentials.refresh,
    expires: Date.now() + data.expires_in * 1000 - 5 * 60 * 1000
  };
}
```

### Custom Streaming

```typescript
import {
  createAssistantMessageEventStream,
  type AssistantMessageEventStream,
  type Model,
  type Context
} from "@mariozechner/pi-ai";

function streamMyProvider(
  model: Model<"my-api">,
  context: Context,
  options?: { apiKey?: string; signal?: AbortSignal }
): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();
  
  (async () => {
    const output: AssistantMessage = { /* ... */ };
    
    try {
      const response = await fetch(model.baseUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${options?.apiKey}`,
          "Content-Type": "application/json",
          "Accept": "text/event-stream"
        },
        body: JSON.stringify({
          model: model.id,
          messages: context.messages,
          stream: true
        }),
        signal: options?.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      for await (const chunk of response.body!) {
        const text = new TextDecoder().decode(chunk);
        
        // Parse SSE
        for (const line of text.split("\n")) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            
            if (data.choices?.[0]?.delta?.content) {
              stream.push({
                type: "text_delta",
                contentIndex: 0,
                delta: data.choices[0].delta.content,
                partial: output
              });
            }
            
            if (data.choices?.[0]?.finish_reason) {
              output.stopReason = mapStopReason(data.choices[0].finish_reason);
            }
          }
        }
      }
      
      stream.push({ type: "done", reason: output.stopReason, message: output });
      stream.end();
    } catch (error) {
      stream.push({
        type: "error",
        reason: "error",
        error: { ...output, errorMessage: error.message }
      });
      stream.end();
    }
  })();
  
  return stream;
}
```

---

**Next Steps**:
- Browse `$PI_CODING_AGENT_PACKAGE/examples/extensions/` for complete examples
- Read [PI-DEV-PROVIDERS.md](./PI-DEV-PROVIDERS.md) for provider details
- Read [PI-DEV-SDK.md](./PI-DEV-SDK.md) for programmatic usage

