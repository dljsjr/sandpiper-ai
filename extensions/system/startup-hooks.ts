import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import {
  buildSandpiperSystemPrompt,
  collectActiveTaskContext,
  collectProjectTriggers,
  collectWorkingCopySummary,
  formatActiveTaskContextForPrompt,
  formatColdStartGuidance,
  formatProjectTriggersForPrompt,
  formatStandupContext,
  formatWorkingCopySummaryForPrompt,
  getPidFilePath,
  type ProcessManager,
  shouldTreatInitialLoadAsColdStart,
} from 'sandpiper-ai-core';
import type { SystemRuntimeState } from './runtime.js';

function writePidFile(sessionId: string, cwd: string): void {
  const pidFilePath = getPidFilePath(sessionId);
  mkdirSync(dirname(pidFilePath), { recursive: true });

  const content = [process.pid.toString(), new Date().toISOString(), cwd].join('\n');

  writeFileSync(pidFilePath, content, 'utf-8');
}

function removePidFile(sessionId: string): void {
  const pidFilePath = getPidFilePath(sessionId);
  if (existsSync(pidFilePath)) {
    rmSync(pidFilePath);
  }
}

function readStandupContent(cwd: string): string {
  const standupPath = join(cwd, '.sandpiper', 'standup.md');
  if (!existsSync(standupPath)) return '';

  // Try to use the standup CLI for cleaned output
  try {
    const output = execFileSync('sandpiper-standup', ['read', '-d', cwd], {
      encoding: 'utf-8',
      env: { ...process.env },
    });
    // If CLI returns only the header with no sections, fall back to direct read
    // This handles the case where CLI succeeds but produces empty output (e.g., legacy migration issue)
    if (output.trim() === '# Session Stand-Up') {
      return readFileSync(standupPath, 'utf-8');
    }
    return output;
  } catch {
    // Fallback to direct file read if CLI is not available
    try {
      return readFileSync(standupPath, 'utf-8');
    } catch {
      return '';
    }
  }
}

export function registerStartupPromptHooks(pi: ExtensionAPI, state: SystemRuntimeState): void {
  pi.on('before_agent_start', async (event, ctx) => {
    const projectTriggers = formatProjectTriggersForPrompt(collectProjectTriggers(ctx.cwd));
    const activeTaskContext = state.startupContextPending
      ? formatActiveTaskContextForPrompt(collectActiveTaskContext(ctx.cwd))
      : '';
    const workingCopyContext = state.startupContextPending
      ? formatWorkingCopySummaryForPrompt(collectWorkingCopySummary(ctx.cwd))
      : '';
    const coldStartGuidance = state.coldStartGuidancePending ? formatColdStartGuidance() : '';

    state.startupContextPending = false;
    state.coldStartGuidancePending = false;

    return {
      systemPrompt: buildSandpiperSystemPrompt(event.systemPrompt, {
        piCodingAgentPackage: process.env.PI_CODING_AGENT_PACKAGE,
        piCodingAgentVersion: process.env.PI_CODING_AGENT_VERSION,
        projectTriggers,
        activeTaskContext,
        workingCopyContext,
        coldStartGuidance,
        standupContent: formatStandupContext(readStandupContent(ctx.cwd)),
      }),
    };
  });
}

let currentSessionId: string | undefined;

export function registerSessionContinuityHooks(pi: ExtensionAPI, state: SystemRuntimeState): void {
  pi.on('session_start', async (event, ctx) => {
    state.startupContextPending = true;

    // Cold-start determination is now reason-driven (Pi 0.65.0).
    // Only 'startup' is ambiguous — Pi may have auto-resumed the last session,
    // so we inspect session contents to distinguish fresh vs resumed.
    switch (event.reason) {
      case 'startup': {
        const sessionFile = ctx.sessionManager.getSessionFile();
        state.coldStartGuidancePending = shouldTreatInitialLoadAsColdStart(
          sessionFile,
          ctx.sessionManager.getEntries(),
        );
        break;
      }
      case 'new':
        state.coldStartGuidancePending = true;
        break;
      default:
        // 'reload', 'resume', 'fork' — never a cold start
        state.coldStartGuidancePending = false;
        break;
    }

    const sessionId = ctx.sessionManager.getSessionId();
    process.env.SANDPIPER_SESSION_ID = sessionId;

    // Remove old PID file if switching sessions
    if (currentSessionId && currentSessionId !== sessionId) {
      removePidFile(currentSessionId);
    }

    // Write new PID file
    writePidFile(sessionId, ctx.cwd);
    currentSessionId = sessionId;

    const sessionFile = ctx.sessionManager.getSessionFile();
    if (sessionFile) {
      process.env.SANDPIPER_SESSION_FILE = sessionFile;
    }
  });

  pi.on('session_shutdown', async () => {
    if (currentSessionId) {
      removePidFile(currentSessionId);
      currentSessionId = undefined;
    }
  });
}

export function registerBackgroundProcessContextHooks(pi: ExtensionAPI, processManager: ProcessManager): void {
  pi.on('context', async (event) => {
    const completed = processManager.getCompletedUnacknowledged();
    if (completed.length === 0) return;

    const lines = completed.map((p) => `Background process "${p.id}" exited with code ${p.exitCode}.`);
    for (const p of completed) processManager.acknowledge(p.id);

    return {
      messages: [
        ...event.messages,
        {
          role: 'user',
          content: [{ type: 'text', text: lines.join('\n') }],
        } as (typeof event.messages)[number],
      ],
    };
  });

  pi.on('session_shutdown', async () => {
    processManager.killAll();
  });
}
