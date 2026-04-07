# Pi Security & Safety Guide

**Target**: Developers building safety features  
**Related**: [PI-DEV-TOOLS.md](./PI-DEV-TOOLS.md), [PI-DEV-PATTERNS.md](./PI-DEV-PATTERNS.md)

---

## Permission Gates

### Dangerous Command Detection

```typescript
const dangerousPatterns = [
  /\brm\s+(-rf?|--recursive)/i,
  /\bsudo\b/i,
  /\b(chmod|chown)\b.*777/i,
  /\bmkfs\b/i,
  /\bdd\b/i,
  />\s*\/dev\//,
  /:\(\)\{\s*\|\|:\s*&\}\s*;/  // Fork bomb
];

pi.on("tool_call", async (event, ctx) => {
  if (event.toolName !== "bash") return undefined;
  
  const command = event.input.command as string;
  const isDangerous = dangerousPatterns.some(p => p.test(command));
  
  if (!isDangerous) return undefined;
  
  // No UI = block by default
  if (!ctx.hasUI) {
    return { block: true, reason: "Dangerous command (no UI)" };
  }
  
  // Show confirmation
  const ok = await ctx.ui.confirm(
    "⚠️ Dangerous Command",
    `This command could be destructive:\n\n  ${command}\n\nAllow?`
  );
  
  if (!ok) {
    return { block: true, reason: "Blocked by user" };
  }
  
  return undefined;  // Allow
});
```

### File Operation Confirmation

```typescript
pi.on("tool_call", async (event, ctx) => {
  if (event.toolName === "write") {
    const path = event.input.path as string;
    const content = event.input.content as string;
    
    // Check for existing file
    if (existsSync(path)) {
      const existing = readFileSync(path, "utf8");
      
      if (!ctx.hasUI) {
        return { block: true, reason: "Would overwrite (no UI)" };
      }
      
      const ok = await ctx.ui.confirm(
        "Overwrite File?",
        `${path} already exists. Overwrite?`
      );
      
      if (!ok) {
        return { block: true, reason: "User cancelled overwrite" };
      }
    }
  }
  
  return undefined;
});
```

---

## Path Protection

### Protected Paths List

```typescript
const protectedPaths = [
  ".env",
  ".env.*",
  ".git/",
  "node_modules/",
  ".ssh/",
  ".aws/",
  ".gnupg/",
  "secrets.",
  "credentials.",
  "*.pem",
  "*.key"
];

function isProtectedPath(path: string): boolean {
  return protectedPaths.some(p => {
    if (p.endsWith("/")) {
      return path.includes(p);
    }
    if (p.startsWith("*")) {
      return path.endsWith(p.slice(1));
    }
    return path.includes(p);
  });
}

pi.on("tool_call", async (event) => {
  if (["write", "edit"].includes(event.toolName)) {
    const path = event.input.path as string;
    
    if (isProtectedPath(path)) {
      return {
        block: true,
        reason: `Protected path: ${path}`
      };
    }
  }
  
  return undefined;
});
```

### Git Repository Protection

```typescript
pi.on("tool_call", async (event, ctx) => {
  if (event.toolName === "bash") {
    const command = event.input.command as string;
    
    // Block git operations that could lose work
    const dangerousGit = [
      /\bgit\s+(push|force)/i,
      /\bgit\s+reset\s+--hard/i,
      /\bgit\s+clean\s+(-fd|--force)/i
    ];
    
    if (dangerousGit.some(p => p.test(command))) {
      return {
        block: true,
        reason: "Potentially destructive git operation"
      };
    }
  }
  
  return undefined;
});
```

---

## OS-Level Sandboxing

### Using @anthropic-ai/sandbox-runtime

```typescript
import { SandboxManager } from "@anthropic-ai/sandbox-runtime";
import { createBashTool } from "@mariozechner/pi-coding-agent";

interface SandboxConfig {
  enabled: boolean;
  network: {
    allowedDomains: string[];
    deniedDomains: string[];
  };
  filesystem: {
    denyRead: string[];
    allowWrite: string[];
    denyWrite: string[];
  };
}

const config: SandboxConfig = {
  enabled: true,
  network: {
    allowedDomains: ["github.com", "*.github.com", "registry.npmjs.org"],
    deniedDomains: []
  },
  filesystem: {
    denyRead: ["~/.ssh", "~/.aws", "~/.gnupg"],
    allowWrite: [".", "/tmp"],
    denyWrite: [".env", "*.pem", "*.key"]
  }
};

pi.on("session_start", async (_event, ctx) => {
  try {
    await SandboxManager.initialize({
      network: config.network,
      filesystem: config.filesystem
    });
    
    ctx.ui.notify("Sandbox initialized", "info");
  } catch (error) {
    ctx.ui.notify(`Sandbox init failed: ${error}`, "error");
  }
});

// Override bash tool with sandboxing
const originalBash = createBashTool(cwd);

pi.registerTool({
  ...originalBash,
  label: "bash (sandboxed)",
  async execute(id, params, signal, onUpdate, ctx) {
    if (!sandboxEnabled) {
      return originalBash.execute(id, params, signal, onUpdate);
    }
    
    const wrappedCommand = await SandboxManager.wrapWithSandbox(params.command);
    
    return originalBash.execute(
      id,
      { ...params, command: wrappedCommand },
      signal,
      onUpdate
    );
  }
});
```

---

## Subagent Security

### Project-Local Agent Confirmation

```typescript
pi.registerTool({
  name: "subagent",
  label: "Subagent",
  description: "Delegate to specialized agents",
  parameters: Type.Object({
    agent: Type.String(),
    task: Type.String(),
    agentScope: Type.Optional(Type.Union([
      Type.Literal("user"),
      Type.Literal("project"),
      Type.Literal("both")
    ]))
  }),
  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
    const agentScope = params.agentScope ?? "user";
    
    // Check if requesting project-local agents
    if (agentScope === "project" || agentScope === "both") {
      const agent = discoverAgent(params.agent, agentScope);
      
      if (agent?.source === "project") {
        if (!ctx.hasUI) {
          return {
            content: [{ type: "text", text: "Project agents require UI" }],
            isError: true
          };
        }
        
        const ok = await ctx.ui.confirm(
          "Run Project-Local Agent?",
          `Agent: ${agent.name}\nSource: ${agent.path}\n\nProject agents are repo-controlled. Only run for trusted repositories.`
        );
        
        if (!ok) {
          return {
            content: [{ type: "text", text: "Cancelled: project agent not approved" }],
            isError: true
          };
        }
      }
    }
    
    // Run subagent...
  }
});
```

---

## Input Sanitization

### Command Injection Prevention

```typescript
// ❌ Wrong - vulnerable to injection
const filename = userInput;
const command = `cat ${filename}`;  // Dangerous!

// ✅ Correct - use proper escaping
import { execSync } from "child_process";

const filename = userInput;
const command = `cat ${JSON.stringify(filename)}`;  // Safe

// Or better - avoid shell entirely
import { readFile } from "fs/promises";
const content = await readFile(filename, "utf8");
```

### Path Traversal Prevention

```typescript
import { resolve, normalize } from "node:path";

function sanitizePath(input: string, baseDir: string): string {
  // Resolve to absolute path
  const absolute = resolve(baseDir, input);
  
  // Normalize and check for traversal
  const normalized = normalize(absolute);
  
  if (!normalized.startsWith(baseDir)) {
    throw new Error("Path traversal detected");
  }
  
  return normalized;
}

// Usage
const safePath = sanitizePath(userInput, cwd);
const content = await readFile(safePath, "utf8");
```

---

## Credential Handling

### Secure Storage

```typescript
import { AuthStorage } from "@mariozechner/pi-coding-agent";

// Store credentials securely
const auth = AuthStorage.create();

// Set API key (not persisted, runtime only)
auth.setRuntimeApiKey("anthropic", process.env.ANTHROPIC_API_KEY!);

// OAuth credentials are stored encrypted
auth.setOAuth("my-provider", {
  access: accessToken,
  refresh: refreshToken,
  expires: expiresAt
});

// Retrieve for provider
const apiKey = await auth.getApiKeyForProvider("anthropic");
```

### Never Log Credentials

```typescript
// ❌ Wrong - logs sensitive data
console.log("Auth config:", config);

// ✅ Correct - redact sensitive fields
function redactConfig(config: any) {
  const redacted = { ...config };
  if (redacted.apiKey) redacted.apiKey = "****";
  if (redacted.access) redacted.access = "****";
  if (redacted.refresh) redacted.refresh = "****";
  return redacted;
}

console.log("Auth config:", redactConfig(config));
```

---

## Session Safety

### Unsaved Work Detection

```typescript
pi.on("session_before_switch", async (event, ctx) => {
  if (event.reason === "new") {
    // Check for unsaved work (user messages without assistant response)
    const entries = ctx.sessionManager.getEntries();
    const hasUnsavedWork = entries.some(
      e => e.type === "message" && e.message.role === "user"
    );
    
    if (hasUnsavedWork && ctx.hasUI) {
      const ok = await ctx.ui.confirm(
        "Unsaved Work",
        "You have messages in the current session. Clear anyway?"
      );
      
      if (!ok) {
        return { cancel: true };
      }
    }
  }
  
  return undefined;
});
```

### Dirty Repository Check

```typescript
pi.on("session_before_switch", async (event, ctx) => {
  const { stdout, code } = await pi.exec("git", ["status", "--porcelain"]);
  
  if (code !== 0) {
    return;  // Not a git repo, allow
  }
  
  const hasChanges = stdout.trim().length > 0;
  if (!hasChanges) {
    return;  // No changes, allow
  }
  
  const changedFiles = stdout.trim().split("\n").filter(Boolean).length;
  
  if (!ctx.hasUI) {
    return { cancel: true };  // Block in non-interactive mode
  }
  
  const choice = await ctx.ui.select(
    `You have ${changedFiles} uncommitted file(s). Switch session anyway?`,
    ["Yes, proceed", "No, commit first"]
  );
  
  if (choice !== "Yes, proceed") {
    ctx.ui.notify("Commit your changes first", "warning");
    return { cancel: true };
  }
  
  return undefined;
});
```

---

## Tool Call Interception

### Audit Logging

```typescript
pi.on("tool_call", async (event, ctx) => {
  // Log all tool calls
  const logEntry = {
    timestamp: new Date().toISOString(),
    tool: event.toolName,
    input: event.input,
    callId: event.toolCallId
  };
  
  await appendFile("tool-audit.log", JSON.stringify(logEntry) + "\n");
  
  return undefined;  // Allow
});
```

### Rate Limiting

```typescript
const callCounts = new Map<string, { count: number, resetAt: number }>();

pi.on("tool_call", async (event) => {
  const now = Date.now();
  const toolKey = event.toolName;
  
  const record = callCounts.get(toolKey);
  
  if (!record || now > record.resetAt) {
    callCounts.set(toolKey, { count: 1, resetAt: now + 60000 });
    return undefined;
  }
  
  record.count++;
  
  if (record.count > 10) {  // 10 calls per minute
    return {
      block: true,
      reason: `Rate limit exceeded for ${toolName}`
    };
  }
  
  return undefined;
});
```

---

## Error Handling

### Graceful Degradation

```typescript
pi.on("tool_call", async (event, ctx) => {
  try {
    // Safety check that might fail
    await performSafetyCheck(event);
  } catch (error) {
    // On error, block by default
    ctx.ui.notify(`Safety check failed: ${error}`, "error");
    return { block: true, reason: "Safety check error" };
  }
  
  return undefined;
});
```

### Non-Interactive Mode

```typescript
pi.on("tool_call", async (event, ctx) => {
  if (isDangerous(event) && !ctx.hasUI) {
    // Can't show confirmation dialog
    return {
      block: true,
      reason: "Requires interactive mode for confirmation"
    };
  }
  
  // Safe to use ctx.ui.confirm()
  const ok = await ctx.ui.confirm("Dangerous!", "Allow?");
  return ok ? undefined : { block: true, reason: "Blocked" };
});
```

---

## Security Checklist

### Before Deploying Extension

- [ ] All user input is sanitized
- [ ] No credentials logged or exposed
- [ ] Path traversal prevented
- [ ] Command injection prevented
- [ ] Dangerous operations require confirmation
- [ ] Non-interactive mode handled gracefully
- [ ] Errors don't leak sensitive information
- [ ] Rate limiting for expensive operations
- [ ] Audit logging for sensitive operations
- [ ] Protected paths configured

### Common Vulnerabilities

| Vulnerability | Prevention |
|---------------|------------|
| Command injection | Use `JSON.stringify()` for shell args, or avoid shell |
| Path traversal | Use `resolve()` + check prefix |
| Credential leakage | Never log, use AuthStorage |
| Privilege escalation | Confirm dangerous operations |
| DoS via rate limiting | Implement call limits |
| Information disclosure | Redact sensitive data in logs |

---

**Next Steps**:
- Read [PI-DEV-TOOLS.md](./PI-DEV-TOOLS.md) for tool implementation
- Read [PI-DEV-PATTERNS.md](./PI-DEV-PATTERNS.md) for security patterns
- Review `$PI_CODING_AGENT_PACKAGE/examples/extensions/permission-gate.ts`
- Review `$PI_CODING_AGENT_PACKAGE/examples/extensions/sandbox/`

