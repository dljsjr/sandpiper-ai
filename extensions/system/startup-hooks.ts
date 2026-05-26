import { readFile, stat } from 'node:fs/promises';
import { normalize } from 'node:path';
import { type ExtensionAPI, getAgentDir } from '@earendil-works/pi-coding-agent';
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
  pi.registerFlag('identity', {
    type: 'string',
    description: 'Content or markdown file that replaces the <identity>...</identity> block in the system prompt',
  });

  pi.on('before_agent_start', async (event, ctx) => {
    const identityFlag = pi.getFlag('identity');

    let identityContent: string | undefined;

    if (identityFlag && typeof identityFlag === 'string' && identityFlag.length > 0) {
      try {
        const fileStat = await stat(identityFlag, { throwIfNoEntry: false });
        if (fileStat?.isFile()) {
          identityContent = await readFile(normalize(identityFlag), { encoding: 'utf-8' });
        }
      } catch {}

      identityContent = identityContent ?? identityFlag;
    }

    const effectiveSystemPrompt = await buildSandpiperStartupPrompt(state, {
      agentDir: getAgentDir(),
      cwd: ctx.cwd,
      systemPromptOptions: event.systemPromptOptions,
      identityContent,
      dumpSystemPrompt,
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
