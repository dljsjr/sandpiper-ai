import { readFile, stat } from 'node:fs/promises';
import { normalize } from 'node:path';
import { type ExtensionAPI, getAgentDir } from '@earendil-works/pi-coding-agent';
import {
  buildSandpiperStartupPrompt,
  handleSandpiperSessionShutdown,
  handleSandpiperSessionStart,
} from 'sandpiper-ai-core';
import type { SystemRuntimeState } from './runtime.js';

export function registerStartupPromptHooks(pi: ExtensionAPI, dumpSystemPrompt?: boolean): void {
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

    const finalSystemPrompt = await buildSandpiperStartupPrompt({
      agentDir: getAgentDir(),
      cwd: ctx.cwd,
      systemPromptOptions: event.systemPromptOptions,
      identityContent,
      dumpSystemPrompt,
    });
    if (finalSystemPrompt === undefined) {
      return;
    }

    if (dumpSystemPrompt) {
      // console.error('base prompt:\n', event.systemPrompt);
      console.error('system prompt:\n', finalSystemPrompt);
      ctx.shutdown();
    }

    return {
      systemPrompt: finalSystemPrompt,
    };
  });
}

export function registerSessionContinuityHooks(pi: ExtensionAPI, state: SystemRuntimeState): void {
  pi.on('session_start', async (_event, ctx) => {
    handleSandpiperSessionStart(state, {
      cwd: ctx.cwd,
      sessionId: ctx.sessionManager.getSessionId(),
      sessionFile: ctx.sessionManager.getSessionFile(),
    });
  });

  pi.on('session_shutdown', async () => {
    handleSandpiperSessionShutdown(state);
  });
}
