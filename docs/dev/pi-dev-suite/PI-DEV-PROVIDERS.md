# Pi Custom Provider Guide

**Target**: Developers integrating new LLM providers  
**Related**: [PI-DEV-SDK.md](./PI-DEV-SDK.md), [PI-DEV-ADVANCED.md](./PI-DEV-ADVANCED.md)

---

## Provider Registration

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

pi.registerProvider("my-provider", {
  baseUrl: "https://api.example.com",
  apiKey: "MY_API_KEY",  // Environment variable name
  api: "my-api",         // Custom API identifier
  models: [
    {
      id: "model-v1",
      name: "Model V1",
      reasoning: true,
      input: ["text", "image"],
      cost: { input: 0.001, output: 0.003, cacheRead: 0.0001, cacheWrite: 0.0001 },
      contextWindow: 128000,
      maxTokens: 16384
    }
  ],
  oauth: {
    name: "My Provider",
    login: loginMyProvider,
    refreshToken: refreshMyProvider,
    getApiKey: (cred) => cred.access
  },
  streamSimple: streamMyProvider
});
```

---

## OAuth Implementation

### PKCE Flow

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
  
  // Direct user to authorization URL
  callbacks.onAuth({
    url: `https://auth.example.com/oauth/authorize?` +
      `client_id=xxx&` +
      `redirect_uri=http://localhost:8080/callback&` +
      `response_type=code&` +
      `scope=read+write&` +
      `code_challenge=${challenge}&` +
      `code_challenge_method=S256`,
    instructions: "Complete authorization in your browser"
  });
  
  // Get authorization code from user
  const callbackUrl = await callbacks.onPrompt({
    message: "Paste the callback URL:"
  });
  
  const code = new URL(callbackUrl).searchParams.get("code");
  if (!code) throw new Error("No authorization code");
  
  // Exchange code for tokens
  const response = await fetch("https://auth.example.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      client_id: "xxx",
      redirect_uri: "http://localhost:8080/callback"
    })
  });
  
  if (!response.ok) {
    throw new Error(`Token exchange failed: ${await response.text()}`);
  }
  
  const data = await response.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  
  return {
    access: data.access_token,
    refresh: data.refresh_token,
    expires: Date.now() + data.expires_in * 1000 - 5 * 60 * 1000  // 5 min buffer
  };
}

async function refreshMyProvider(credentials: OAuthCredentials): Promise<OAuthCredentials> {
  const response = await fetch("https://auth.example.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: credentials.refresh,
      client_id: "xxx"
    })
  });
  
  if (!response.ok) {
    throw new Error(`Token refresh failed: ${await response.text()}`);
  }
  
  const data = await response.json();
  
  return {
    access: data.access_token,
    refresh: data.refresh_token || credentials.refresh,
    expires: Date.now() + data.expires_in * 1000 - 5 * 60 * 1000
  };
}
```

### Device Code Flow

```typescript
async function loginDeviceFlow(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
  // Request device code
  const deviceResponse = await fetch("https://auth.example.com/device/code", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: "xxx",
      scope: "read+write"
    })
  });
  
  const device = await deviceResponse.json() as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
  };
  
  // Show user code and URL
  callbacks.onAuth({
    url: device.verification_uri,
    instructions: `Enter code: ${device.user_code}`
  });
  
  // Poll for token
  const deadline = Date.now() + device.expires_in * 1000;
  
  while (Date.now() < deadline) {
    if (callbacks.signal?.aborted) {
      throw new Error("Login cancelled");
    }
    
    const tokenResponse = await fetch("https://auth.example.com/device/token", {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: device.device_code,
        client_id: "xxx"
      })
    });
    
    const data = await tokenResponse.json();
    
    if (data.error === "authorization_pending") {
      await sleep(device.interval * 1000);
      continue;
    }
    
    if (data.error) {
      throw new Error(`Device flow failed: ${data.error}`);
    }
    
    return {
      access: data.access_token,
      refresh: data.refresh_token,
      expires: Date.now() + data.expires_in * 1000 - 5 * 60 * 1000
    };
  }
  
  throw new Error("Device code expired");
}
```

---

## Custom Streaming

### SSE-Based Streaming

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
  options?: { apiKey?: string; headers?: Record<string, string>; signal?: AbortSignal }
): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();
  
  (async () => {
    const output: AssistantMessage = {
      role: "assistant",
      content: [],
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
      },
      stopReason: "stop",
      timestamp: Date.now()
    };
    
    try {
      const response = await fetch(model.baseUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${options?.apiKey}`,
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
          ...options?.headers
        },
        body: JSON.stringify({
          model: model.id,
          messages: context.messages,
          stream: true
        }),
        signal: options?.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      
      for await (const chunk of response.body!) {
        const text = new TextDecoder().decode(chunk);
        
        for (const line of text.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          
          const data = JSON.parse(line.slice(6));
          
          // Handle text deltas
          if (data.choices?.[0]?.delta?.content) {
            stream.push({
              type: "text_delta",
              contentIndex: 0,
              delta: data.choices[0].delta.content,
              partial: output
            });
          }
          
          // Handle finish reason
          if (data.choices?.[0]?.finish_reason) {
            output.stopReason = mapStopReason(data.choices[0].finish_reason);
          }
          
          // Handle usage
          if (data.usage) {
            output.usage.input = data.usage.prompt_tokens;
            output.usage.output = data.usage.completion_tokens;
            output.usage.totalTokens = output.usage.input + output.usage.output;
          }
        }
      }
      
      stream.push({ type: "done", reason: output.stopReason, message: output });
      stream.end();
    } catch (error) {
      output.stopReason = options?.signal?.aborted ? "aborted" : "error";
      output.errorMessage = error instanceof Error ? error.message : String(error);
      
      stream.push({
        type: "error",
        reason: output.stopReason,
        error: output
      });
      stream.end();
    }
  })();
  
  return stream;
}

function mapStopReason(reason: string): "stop" | "length" | "toolUse" | "error" {
  switch (reason) {
    case "stop":
    case "end_turn":
      return "stop";
    case "length":
    case "max_tokens":
      return "length";
    case "tool_calls":
    case "tool_use":
      return "toolUse";
    default:
      return "error";
  }
}
```

### Delegating to Built-in Streaming

```typescript
import {
  streamSimpleAnthropic,
  streamSimpleOpenAI
} from "@mariozechner/pi-ai";

function streamMyProvider(
  model: Model<"my-api">,
  context: Context,
  options?: SimpleStreamOptions
): AssistantMessageEventStream {
  // My provider is OpenAI-compatible
  return streamSimpleOpenAI(
    { ...model, api: "openai-completions" as const },
    context,
    options
  );
}
```

---

## Model Definitions

### Basic Model

```typescript
{
  id: "claude-sonnet-4-20250514",
  name: "Claude Sonnet 4",
  reasoning: true,
  input: ["text", "image"],
  cost: {
    input: 0.003,
    output: 0.015,
    cacheRead: 0.0003,
    cacheWrite: 0.00375
  },
  contextWindow: 200000,
  maxTokens: 64000
}
```

### Model with Compatibility Flags

```typescript
{
  id: "qwen-3-coder",
  name: "Qwen 3 Coder",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 256000,
  maxTokens: 65536,
  compat: {
    supportsDeveloperRole: false,  // Use "user" instead of "developer"
    thinkingFormat: "qwen"         // Special thinking format
  }
}
```

---

## Complete Provider Example

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { OAuthCredentials, OAuthLoginCallbacks } from "@mariozechner/pi-ai";

export default function(pi: ExtensionAPI) {
  pi.registerProvider("gitlab-duo", {
    baseUrl: "https://cloud.gitlab.com/ai/v1/proxy",
    apiKey: "GITLAB_TOKEN",
    api: "gitlab-duo-api",
    
    models: [
      {
        id: "claude-sonnet-4-5-20250929",
        name: "Claude Sonnet 4.5",
        reasoning: true,
        input: ["text", "image"],
        cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
        contextWindow: 200000,
        maxTokens: 16384
      },
      {
        id: "gpt-5-codex",
        name: "GPT-5 Codex",
        reasoning: true,
        input: ["text", "image"],
        cost: { input: 2.5, output: 10, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 16384
      }
    ],
    
    oauth: {
      name: "GitLab Duo",
      login: loginGitLab,
      refreshToken: refreshGitLab,
      getApiKey: (cred) => cred.access
    },
    
    streamSimple: streamGitLabDuo
  });
}

async function loginGitLab(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
  // PKCE flow implementation
  // ...
}

async function refreshGitLab(credentials: OAuthCredentials): Promise<OAuthCredentials> {
  // Token refresh implementation
  // ...
}

function streamGitLabDuo(
  model: Model<"gitlab-duo-api">,
  context: Context,
  options?: SimpleStreamOptions
): AssistantMessageEventStream {
  // Delegate to Anthropic or OpenAI based on model
  if (model.id.includes("claude")) {
    return streamSimpleAnthropic(
      { ...model, api: "anthropic-messages" as const },
      context,
      options
    );
  } else {
    return streamSimpleOpenAI(
      { ...model, api: "openai-responses" as const },
      context,
      options
    );
  }
}
```

---

**Next Steps**:
- Browse `$PI_CODING_AGENT_PACKAGE/examples/extensions/custom-provider-*/` for examples
- Read `$PI_CODING_AGENT_PACKAGE/node_modules/@mariozechner/pi-ai/dist/providers/` for reference implementations
- Check `$PI_CODING_AGENT_PACKAGE/node_modules/@mariozechner/pi-ai/dist/utils/oauth/` for OAuth utilities

