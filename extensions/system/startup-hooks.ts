import { readFile, stat } from 'node:fs/promises';
import { normalize } from 'node:path';
import { type BuildSystemPromptOptions, type ExtensionAPI, getAgentDir } from '@earendil-works/pi-coding-agent';
import {
  buildSandpiperStartupPrompt,
  handleSandpiperSessionShutdown,
  handleSandpiperSessionStart,
} from 'sandpiper-ai-core';
import {
  applyPromptContributions,
  SANDPIPER_PROMPT_CONTRIBUTION_CHANNEL,
  SandpiperPromptContributionCollector,
} from './prompt-contributions.js';
import type { SystemRuntimeState } from './runtime.js';

export interface StartupPromptDiagnosticCommand {
  readonly commandName: string;
  readonly onPrompt: (prompt: string) => void | Promise<void>;
}

export function registerStartupPromptHooks(
  pi: ExtensionAPI,
  dumpSystemPrompt?: boolean,
  diagnosticCommand?: StartupPromptDiagnosticCommand,
): void {
  // First-turn-only: contributions are collected during session_start and folded into the
  // cached prompt once at before_agent_start. They never re-apply per turn, so this does not
  // reintroduce the across-turns mutation eff4bda53 removed. External consumers (e.g. pi-yaams's
  // memory bootstrap) inject via SANDPIPER_PROMPT_CONTRIBUTION_CHANNEL — a public extension API.
  const promptContributions = new SandpiperPromptContributionCollector();
  let unsubscribePromptContributions: (() => void) | undefined;

  const resetPromptContributionListener = () => {
    unsubscribePromptContributions?.();
    unsubscribePromptContributions = undefined;
    promptContributions.reset();
  };

  pi.registerFlag('identity', {
    type: 'string',
    description: 'Content or markdown file that replaces the <identity>...</identity> block in the system prompt',
  });

  pi.on('session_start', () => {
    resetPromptContributionListener();
    unsubscribePromptContributions = pi.events.on(SANDPIPER_PROMPT_CONTRIBUTION_CHANNEL, (payload) => {
      promptContributions.add(payload);
    });
  });

  pi.on('session_shutdown', () => {
    resetPromptContributionListener();
  });

  const buildEffectiveSystemPrompt = async (cwd: string, systemPromptOptions: BuildSystemPromptOptions) => {
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

    return buildSandpiperStartupPrompt({
      agentDir: getAgentDir(),
      cwd,
      systemPromptOptions,
      identityContent,
      dumpSystemPrompt,
    });
  };

  const applyResolvedContributions = async (systemPrompt: string) => {
    const resolvedContributions = await promptContributions.resolve();
    return applyPromptContributions(systemPrompt, resolvedContributions);
  };

  if (diagnosticCommand) {
    pi.registerCommand(diagnosticCommand.commandName, {
      handler: async (_args, ctx) => {
        const effectiveSystemPrompt = await buildEffectiveSystemPrompt(ctx.cwd, ctx.getSystemPromptOptions());
        const finalSystemPrompt =
          effectiveSystemPrompt === undefined
            ? ctx.getSystemPrompt()
            : await applyResolvedContributions(effectiveSystemPrompt);
        await diagnosticCommand.onPrompt(finalSystemPrompt);
      },
    });
  }

  pi.on('before_agent_start', async (event, ctx) => {
    const effectiveSystemPrompt = await buildEffectiveSystemPrompt(ctx.cwd, event.systemPromptOptions);
    if (effectiveSystemPrompt === undefined) {
      return;
    }

    const finalSystemPrompt = await applyResolvedContributions(effectiveSystemPrompt);

    if (dumpSystemPrompt) {
      // console.error('base prompt:\n', event.systemPrompt);
      console.error('system prompt:\n', finalSystemPrompt);
      ctx.shutdown();
      // ctx.shutdown() only exits reliably in modes that wire a real shutdown
      // handler (tui, rpc). Pi's print mode -- forced whenever stdin/stdout
      // isn't a TTY, i.e. every headless/scripted/CI invocation -- never
      // registers one, so shutdown() silently no-ops there and execution
      // would otherwise fall through into a real agent turn. Hard-exit
      // shortly after as a fallback for that case; harmless when shutdown()
      // already worked, since the process is gone before this fires.
      setTimeout(() => process.exit(0), 200);
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
