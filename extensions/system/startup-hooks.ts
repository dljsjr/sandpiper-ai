import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import {
  collectActiveTaskContext,
  collectProjectTriggers,
  collectWorkingCopySummary,
  formatActiveTaskContextForPrompt,
  formatColdStartGuidance,
  formatProjectTriggersForPrompt,
  formatStandupContext,
  formatWorkingCopySummaryForPrompt,
  handleSandpiperSessionShutdown,
  handleSandpiperSessionStart,
} from 'sandpiper-ai-core';
import { buildSandpiperSystemPrompt } from '../../packages/core/src/system-prompt.js';
import type { SystemRuntimeState } from './runtime.js';

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

export function registerStartupPromptHooks(
  pi: ExtensionAPI,
  state: SystemRuntimeState,
  dumpSystemPrompt?: boolean,
): void {
  pi.on('before_agent_start', async (event, ctx) => {
    // If the user has specified a custom prompt, we don't want to modify the system prompt at all.
    if (event.systemPromptOptions.customPrompt) {
      return;
    }

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

    const effectiveSystemPrompt = await buildSandpiperSystemPrompt(
      {
        cwd: ctx.cwd,
        piCodingAgentPackage: process.env.PI_CODING_AGENT_PACKAGE,
        piCodingAgentVersion: process.env.PI_CODING_AGENT_VERSION,
        projectTriggers,
        activeTaskContext,
        workingCopyContext,
        coldStartGuidance,
        standupContent: formatStandupContext(readStandupContent(ctx.cwd)),
      },
      event.systemPromptOptions,
    );
    if (dumpSystemPrompt) {
      // console.error('base prompt:\n', event.systemPrompt);
      console.error('system prompt:\n', effectiveSystemPrompt);
      ctx.shutdown();
    }
    return {
      systemPrompt: effectiveSystemPrompt,
    };
  });
}

export function registerSessionContinuityHooks(pi: ExtensionAPI, state: SystemRuntimeState): void {
  pi.on('session_start', async (event, ctx) => {
    handleSandpiperSessionStart(state, {
      reason: event.reason,
      cwd: ctx.cwd,
      sessionId: ctx.sessionManager.getSessionId(),
      sessionFile: ctx.sessionManager.getSessionFile(),
      entries: ctx.sessionManager.getEntries(),
    });
  });

  pi.on('session_shutdown', async () => {
    handleSandpiperSessionShutdown(state);
  });
}
