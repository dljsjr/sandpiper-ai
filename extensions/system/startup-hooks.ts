import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import {
  buildSandpiperStartupPrompt,
  handleSandpiperSessionShutdown,
  handleSandpiperSessionStart,
} from 'sandpiper-ai-core';
import type { SystemRuntimeState } from './runtime.js';

export function registerStartupPromptHooks(
  pi: ExtensionAPI,
  state: SystemRuntimeState,
  dumpSystemPrompt?: boolean,
): void {
  pi.on('before_agent_start', async (event, ctx) => {
    const effectiveSystemPrompt = await buildSandpiperStartupPrompt(state, {
      cwd: ctx.cwd,
      systemPromptOptions: event.systemPromptOptions,
    });
    if (effectiveSystemPrompt === undefined) {
      return;
    }
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
