# Sandpiper-Specific Pi Extension Patterns

**Target**: Sandpiper extension developers  
**Related**: All other docs in this suite, `.sandpiper/docs/` for Sandpiper architecture

---

## Overview

This document captures **Sandpiper-specific patterns** for extending Pi. These are architectural patterns, extension techniques, and integration strategies that are specific to the Sandpiper distribution of Pi.

---

## Capability Guidance Registry

### Pattern Overview

The **Capability Guidance Registry** is a Sandpiper-specific pattern for cross-cutting system prompt guidance injection. It allows extensions to register static or dynamic guidance blocks that are injected into the system prompt at assembly time.

**Why this matters**: Extensions need to inject system prompt guidance (like TOON format instructions) without hardcoding all guidance into the central prompt builder. The registry provides a cooperative, decoupled mechanism.

### Architecture

```
┌─────────────────────────────────────┐
│ Extension (e.g., autotoon.ts)       │
│                                     │
│ pi.events.emit(                     │
│   'capability_guidance:register',   │
│   { id: 'autotoon', block: guidance }│
│ )                                   │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ Capability Guidance Registry        │
│ (extensions/system/)                │
│                                     │
│ Collects registrations via          │
│ pi.events.on()                      │
│ Deduplicates by ID                  │
│ Exposes getStaticGuidance()         │
│ Exposes getDynamicGuidance()        │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ System Prompt Builder               │
│ (packages/core/src/system-startup.ts)│
│                                     │
│ Calls registry during               │
│ before_agent_start                  │
│ Injects guidance into prompt        │
└─────────────────────────────────────┘
```

### Static vs Dynamic Guidance

| Type | When to Use | Example |
|------|-------------|---------|
| **Static** | Byte-identical across turns, participates in prefix caching | TOON format description, tool usage guidelines |
| **Dynamic** | Varies per turn based on context | Active task context, standup content, working copy state |

### Registration Pattern

```typescript
// In your extension (module load time - BEFORE any event handlers)
import { pi } from '@mariozechner/pi-coding-agent';

const AUTOTOON_GUIDANCE = `
## TOON Format

When you see [TOON] headers in tool output, the data has been 
converted to TOON (Token-Oriented Object Notation) for efficiency.
`;

// Register at module load time
pi.events.emit('capability_guidance:register_static', {
  id: 'autotoon',
  block: AUTOTOON_GUIDANCE,
});

// For dynamic guidance
pi.events.emit('capability_guidance:register_dynamic', {
  id: 'task-context',
  generator: async (ctx) => {
    const tasks = await getActiveTasks();
    return `## Active Tasks\n\n${tasks.map(t => `- ${t.key}: ${t.title}`).join('\n')}`;
  }
});
```

### Registry Implementation

```typescript
// extensions/system/capability-guidance-registry.ts
import { pi } from '@mariozechner/pi-coding-agent';

interface StaticGuidance {
  id: string;
  block: string;
}

interface DynamicGuidance {
  id: string;
  generator: (ctx: ExtensionContext) => Promise<string>;
}

const staticGuidance = new Map<string, string>();
const dynamicGuidance = new Map<string, DynamicGuidance['generator']>();

// Collect static guidance
pi.events.on('capability_guidance:register_static', (registration: StaticGuidance) => {
  staticGuidance.set(registration.id, registration.block);
});

// Collect dynamic guidance
pi.events.on('capability_guidance:register_dynamic', (registration: DynamicGuidance) => {
  dynamicGuidance.set(registration.id, registration.generator);
});

export function getStaticGuidance(): string {
  return [...staticGuidance.values()].join('\n\n');
}

export async function getDynamicGuidance(ctx: ExtensionContext): Promise<string> {
  const blocks: string[] = [];
  
  for (const [id, generator] of dynamicGuidance) {
    try {
      const block = await generator(ctx);
      if (block.trim()) {
        blocks.push(block);
      }
    } catch (error) {
      console.error(`Dynamic guidance error (${id}):`, error);
    }
  }
  
  return blocks.join('\n\n');
}
```

### Usage in Prompt Builder

```typescript
// packages/core/src/system-startup.ts
import { getStaticGuidance, getDynamicGuidance } from './capability-guidance-registry';

pi.on('before_agent_start', async (event, ctx) => {
  const { systemPrompt } = event;
  
  // Parse PI's prompt into sections
  const sections = parsePromptSections(systemPrompt);
  
  // Inject static guidance (participates in prefix caching)
  const staticGuidanceBlock = getStaticGuidance();
  sections.staticCapabilityGuidance = staticGuidanceBlock;
  
  // Inject dynamic guidance (varies per turn)
  const dynamicGuidanceBlock = await getDynamicGuidance(ctx);
  sections.dynamicCapabilityGuidance = dynamicGuidanceBlock;
  
  // Reassemble
  const newPrompt = reassemblePrompt(sections);
  
  return { systemPrompt: newPrompt };
});
```

### Prompt Assembly Order

For optimal prefix caching, assemble the prompt in **stability-descending order**:

```
[base prompt]                    ← Pi's default (most stable)
[identity block]                 ← Sandpiper overrides (stable)
[staticCapabilityGuidance]       ← Registered static guidance (cacheable)
── cache boundary ──
[projectTriggers]                ← Dynamic project routing
[standupContent]                 ← Session standup (changes per session)
[activeTaskContext]              ← Active tasks (changes per turn)
[workingCopyContext]             ← Dirty files (changes per turn)
[coldStartGuidance]              ← Cold-start only (most volatile)
```

### Related Patterns

- **Concurrent Sessions**: Similar cooperative registration pattern for standup PID files
- **AutoTOON**: Primary user of static guidance registry
- **Task Context Injection**: Uses dynamic guidance registry

---

## System Prompt Assembly

### Sandpiper's Approach

Sandpiper **does not replace** Pi's base system prompt. Instead, it:

1. Lets PI build the default base (with dynamic tools/guidelines)
2. Parses PI's assembled prompt into sections
3. Replaces identity/docs sections (fixes paths, adds Sandpiper docs)
4. Keeps tools/guidelines (already dynamic and correct)
5. Appends Sandpiper-specific dynamic sections

**Why this wins**:
- ✅ Handles dynamic tools (uses PI's dynamically-built section)
- ✅ Reuses PI's work (no duplication)
- ✅ Minimal code (parse/replace/reassemble)
- ✅ Clean separation of concerns

### Prompt Section Markers

Use these regex markers to parse PI's prompt:

```typescript
function parsePromptSections(fullPrompt: string): PromptSections {
  const markers = {
    tools: 'Available tools:',
    guidelines: 'Guidelines:',
    docs: 'Pi documentation',
    agents: '# Project Context',
    skills: '<available_skills>',
    date: 'Current date:'
  };
  
  // Extract sections via regex
  // ...
}
```

### Implementation

```typescript
// packages/core/src/sandpiper-prompt-builder.ts

export function buildSandpiperPrompt(piPrompt: string, options: BuildOptions): string {
  const sections = parsePromptSections(piPrompt);
  
  // Replace identity section
  sections.identity = buildSandpiperIdentity({
    piVersion: options.piVersion,
    sandpiperDocs: options.sandpiperDocs
  });
  
  // Replace docs section
  sections.docs = buildSandpiperDocsSection({
    sandpiperDocsPath: '.sandpiper/docs/',
    piDocsPath: process.env.PI_CODING_AGENT_PACKAGE + '/docs/'
  });
  
  // Keep PI's tools/guidelines (already dynamic)
  // Keep PI's context files/skills (already appended)
  
  // Append Sandpiper dynamic sections
  const dynamicSections = [
    buildStandupSection(options.standupContent),
    buildTaskSection(options.activeTasks),
    buildWorkingCopySection(options.dirtyFiles),
    buildColdStartSection(options.isColdStart)
  ];
  
  return reassemblePrompt({ ...sections, dynamic: dynamicSections });
}
```

### Related Docs

- `.sandpiper/docs/recommended-approach.md` - Full rationale
- `.sandpiper/docs/implementation-strategy.md` - Implementation plan
- `.sandpiper/docs/pi-complete-docs-review.md` - PI docs analysis

---

## Shell Relay Integration

### Overview

Sandpiper includes a **shell relay extension** that provides a shared terminal session between user and agent via Zellij. This is a Sandpiper-specific capability not present in vanilla Pi.

### Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Agent Session   │────▶│ Shell Relay Ext  │────▶│ Zellij Pane     │
│ (pi-coding-agent)│    │ (extensions/)    │     │ (shared terminal)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │ FIFO Management  │
                        │ Relay Orchestration│
                        └──────────────────┘
```

### Extension Pattern

```typescript
// extensions/shell-relay/src/index.ts
import { pi } from '@mariozechner/pi-coding-agent';

export default function shellRelayExtension(pi: ExtensionAPI) {
  let relayProcess: ReturnType<typeof spawn> | null = null;
  
  pi.on('session_start', async (_event, ctx) => {
    // Start relay orchestrator
    relayProcess = spawn('unbuffer-relay', [ctx.cwd], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Create FIFO for agent → relay communication
    await createFIFO('/tmp/sandpiper-relay.fifo');
  });
  
  pi.registerTool({
    name: 'shell_relay',
    label: 'Shell Relay',
    description: 'Execute commands in shared Zellij session',
    parameters: Type.Object({
      command: Type.String()
    }),
    async execute(_toolCallId, params) {
      // Write to FIFO
      await writeToFIFO('/tmp/sandpiper-relay.fifo', params.command);
      
      // Read response
      const output = await readFromFIFO('/tmp/sandpiper-relay.fifo');
      
      return {
        content: [{ type: 'text', text: output }]
      };
    }
  });
  
  pi.on('session_shutdown', async () => {
    if (relayProcess) {
      relayProcess.kill('SIGTERM');
      relayProcess = null;
    }
  });
}
```

### FIFO Management Pattern

```typescript
import { open, close, read, write } from 'fs/promises';

// O_RDWR sentinel pattern for persistent FIFOs
async function writeToFIFO(fifoPath: string, data: string): Promise<void> {
  const fd = await open(fifoPath, 'w');
  try {
    await write(fd, data);
  } finally {
    await close(fd);
  }
}

async function readFromFIFO(fifoPath: string): Promise<string> {
  const fd = await open(fifoPath, 'r');
  try {
    const buffer = Buffer.alloc(4096);
    const bytesRead = await read(fd, buffer, 0, buffer.length, null);
    return buffer.toString('utf8', 0, bytesRead);
  } finally {
    await close(fd);
  }
}
```

### Related Docs

- `.sandpiper/docs/concurrent-sessions.md` - PID-based liveness detection
- `.sandpiper/tasks/SHR/PROJECT.md` - Shell relay project tracking
- `extensions/shell-relay/` - Extension source

---

## Task Management Integration

### Overview

Sandpiper includes a **tasks CLI** (`sandpiper-tasks`) for managing project work items as markdown files with YAML frontmatter. Extensions can integrate with this system for task-aware behavior.

### Task Context Injection

```typescript
// In before_agent_start handler
import { execFileSync } from 'child_process';

pi.on('before_agent_start', async (_event, ctx) => {
  // Get active tasks via CLI
  const activeTasks = execFileSync('sandpiper-tasks', ['list', '--status', 'active'], {
    encoding: 'utf8'
  });
  
  const taskContext = `## Active Tasks

${activeTasks}

Reference task keys (e.g., TCL-123) in commits and standup notes.`;
  
  return {
    systemPrompt: event.systemPrompt + '\n\n' + taskContext
  };
});
```

### Task Storage Modes

The tasks CLI supports multiple storage modes:

| Mode | Description | Use Case |
|------|-------------|----------|
| **Inline** (default) | Tasks on current branch | Solo development |
| **Separate branch** | Tasks on dedicated branch via workspace/worktree | Reduce VCS churn |
| **External repo** | Tasks in separate repository | Shared task tracking |

### Configuration

```json
// .sandpiper-tasks.json
{
  "version_control": {
    "enabled": true,
    "mode": {
      "branch": "sandpiper-tasks"
    },
    "auto_commit": false,
    "auto_push": false
  }
}
```

### Related Docs

- `.sandpiper/docs/task-storage-strategy.md` - Full design rationale
- `.sandpiper/docs/task-storage-implementation-plan.md` - Implementation phases
- `packages/sandpiper-tasks-cli/STORAGE.md` - Operator guide

---

## Standup & Session Continuity

### Overview

Sandpiper uses a **standup file** (`.sandpiper/standup.md`) to bridge context across sequential agent sessions. The standup CLI manages concurrent session access via PID-based liveness detection.

### Architecture

```
┌─────────────────────┐       ┌──────────────────────────┐
│ Extension           │       │ sandpiper-standup CLI    │
│                     │       │                          │
│ session_start:      │       │ read:                    │
│   create PID file   │──────▶│   - clean dead sections  │
│                     │       │   - output active/       │
│ session_shutdown:   │       │     inactive sections    │
│   remove PID file   │       │                          │
│                     │       │ write:                   │
│                     │       │   - clean dead sections  │
│                     │       │   - write own section    │
└─────────────────────┘       └──────────────────────────┘
```

### PID File Convention

```
$XDG_STATE_HOME/sandpiper/sessions/<uuid>.pid
```

Contents (three lines):
```
12345
2026-04-05T10:00:00.000Z
/Users/doug/git/my-project
```

### Liveness Detection

```typescript
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);  // Signal 0 = check existence
    return true;
  } catch (error) {
    if (error.code === 'ESRCH') {
      return false;  // No such process
    }
    if (error.code === 'EPERM') {
      return true;  // Process exists, no permission to signal
    }
    throw error;
  }
}
```

### Standup Injection

```typescript
import { execFileSync } from 'child_process';

pi.on('before_agent_start', async (_event, ctx) => {
  const standupContent = execFileSync('sandpiper-standup', ['read', '-d', ctx.cwd], {
    encoding: 'utf8'
  });
  
  const standupContext = `## Previous Session Context

${standupContent}

Use this to orient on what was done, what's planned next, and any important context.`;
  
  return {
    systemPrompt: event.systemPrompt + '\n\n' + standupContext
  };
});
```

### Related Docs

- `.sandpiper/docs/concurrent-sessions.md` - Full design
- `packages/resources/skills/sandpiper/standup/SKILL.md` - Standup skill

---

## Environment Variable Mirroring

### Overview

Sandpiper mirrors `PI_*` env vars into the `SANDPIPER_*` namespace (and vice versa) at startup. This allows users to configure either namespace while Sandpiper code consistently reads through the Sandpiper-first lookup path.

### Usage Pattern

```typescript
// ✅ Correct — uses Sandpiper-first lookup
import { resolveEnvVar } from 'sandpiper-ai-core';

const offline = resolveEnvVar('OFFLINE');  // Checks SANDPIPER_OFFLINE, then PI_OFFLINE

// ❌ Wrong — misses the SANDPIPER_* override
const offline = process.env.PI_OFFLINE;
```

### Exempt Variables

Four `PI_*` variables are **exempt** from mirroring and should be read directly:

| Variable | Purpose |
|----------|---------|
| `PI_CODING_AGENT_PACKAGE` | Path to pi-coding-agent package |
| `PI_CODING_AGENT_VERSION` | Pi version string |
| `PI_PACKAGE_DIR` | Pi package directory override |
| `PI_SKIP_VERSION_CHECK` | Suppress Pi update check |

### Related Docs

- `.sandpiper/docs/env-vars.md` - Full mirroring model
- `packages/core/src/env.ts` - `resolveEnvVar()` implementation

---

## Build & Extension Loading

### Source-Loaded Extensions

Sandpiper extensions are loaded from **source `.ts` files** via jiti. There is **no build step** for extension runtime entrypoints.

```typescript
// ✅ Correct — extension loads from source
extensions/system.ts
extensions/shell-relay/src/index.ts

// ❌ Wrong — don't build extensions
dist/extensions/system.js  // Don't create this!
```

### Postinstall Workflow

After changing extension code, skills, prompts, themes, or packaged resources:

```bash
bash devtools/postinstall.sh
```

After changing a package that emits binaries or declarations:

```bash
# Build the package first
cd packages/cli && bun run build

# Then run postinstall
bash devtools/postinstall.sh
```

### Related Docs

- `.sandpiper/docs/build-system.md` - Build pipeline
- `.sandpiper/docs/extension-loading.md` - Jiti loading details

---

## Testing & Verification

### Sandpiper-Specific Test Constraints

Tests must **not** touch real user or installed production state:

```typescript
// ❌ Wrong - touches real state
const configPath = join(homedir(), '.sandpiper', 'settings.json');

// ✅ Correct - parameterize the concrete resource
function getSettingsPath(baseDir: string): string {
  return join(baseDir, '.sandpiper', 'settings.json');
}

// Test
const testSettings = getSettingsPath('/tmp/test-fixture');
```

### Related Docs

- `AGENTS.md` - Testing guidelines
- `.sandpiper/docs/task-storage-strategy.md` - VCS churn considerations

---

## Summary

Sandpiper extends Pi with several key architectural patterns:

1. **Capability Guidance Registry** - Cooperative prompt guidance injection
2. **System Prompt Assembly** - Parse/replace/reassemble PI's prompt
3. **Shell Relay** - Shared terminal via Zellij + FIFOs
4. **Task Management** - CLI + storage modes + context injection
5. **Standup Continuity** - PID-based concurrent session handoff
6. **Env Var Mirroring** - SANDPIPER_* / PI_* dual namespace
7. **Source-Loaded Extensions** - Jiti loading, no build step

These patterns are specific to Sandpiper and should be understood by all extension developers working in this codebase.


---

## Build & Extension Loading

### Source-Loaded Extensions

Sandpiper extensions are loaded from **source `.ts` files** via jiti. There is **no build step** for extension runtime entrypoints.

```typescript
// ✅ Correct — extension loads from source
extensions/system.ts
extensions/shell-relay/src/index.ts

// ❌ Wrong — don't build extensions
dist/extensions/system.js  // Don't create this!
```

### Postinstall Workflow

After changing extension code, skills, prompts, themes, or packaged resources:

```bash
bash devtools/postinstall.sh
```

After changing a package that emits binaries or declarations:

```bash
# Build the package first
cd packages/cli && bun run build

# Then run postinstall
bash devtools/postinstall.sh
```

### Why This Works

- **jiti loads `.ts` directly** — no compilation needed
- **`postinstall.sh` copies source trees** — preserves `src/` directories in `dist/`
- **Package.json entries resolve** — `pi.extensions: "./src/index.ts"` works in both source and dist
- **npm deps hoisted** — Bun workspace install puts deps in root `node_modules/`

### Module Scope Boundaries

Each extension loaded by jiti gets its own module scope:
- Module-level state is **not shared** between extensions
- Use `pi.events` for cross-extension communication
- Don't rely on module singleton pattern across extensions

