import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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
  type ProcessManager,
  shouldTreatInitialLoadAsColdStart,
} from 'sandpiper-ai-core';
import type { SystemRuntimeState } from './runtime.js';

function readStandupContent(cwd: string): string {
  const standupPath = join(cwd, '.sandpiper', 'standup.md');
  if (!existsSync(standupPath)) return '';
  try {
    return readFileSync(standupPath, 'utf-8');
  } catch {
    return '';
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

    process.env.SANDPIPER_SESSION_ID = ctx.sessionManager.getSessionId();
    const sessionFile = ctx.sessionManager.getSessionFile();
    if (sessionFile) {
      process.env.SANDPIPER_SESSION_FILE = sessionFile;
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
