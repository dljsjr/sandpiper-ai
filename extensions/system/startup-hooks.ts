import { readFile, stat } from 'node:fs/promises';
import { join, normalize, resolve } from 'node:path';
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
import { appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { createTwoFilesPatch } from 'diff';

export interface StartupPromptDiagnosticSources {
  readonly identity?: string;
}

export interface StartupPromptDiagnosticCommand {
  readonly commandName: string;
  readonly onPrompt: (prompt: string, sources: StartupPromptDiagnosticSources) => void | Promise<void>;
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
    let identitySource: string | undefined;

    if (identityFlag && typeof identityFlag === 'string' && identityFlag.length > 0) {
      try {
        const fileStat = await stat(identityFlag, { throwIfNoEntry: false });
        if (fileStat?.isFile()) {
          identitySource = resolve(normalize(identityFlag));
          identityContent = await readFile(identitySource, { encoding: 'utf-8' });
        }
      } catch {}

      identityContent = identityContent ?? identityFlag;
    }

    const prompt = await buildSandpiperStartupPrompt({
      agentDir: getAgentDir(),
      cwd,
      systemPromptOptions,
      identityContent,
      dumpSystemPrompt,
    });
    return { prompt, sources: { identity: identitySource } };
  };

  const applyResolvedContributions = async (systemPrompt: string) => {
    const resolvedContributions = await promptContributions.resolve();
    return applyPromptContributions(systemPrompt, resolvedContributions);
  };

  if (diagnosticCommand) {
    pi.registerFlag('json', {
      type: 'boolean',
      description: 'Emit the system prompt diagnostic as JSON with source metadata',
      default: false,
    });
    pi.registerCommand(diagnosticCommand.commandName, {
      handler: async (_args, ctx) => {
        const result = await buildEffectiveSystemPrompt(ctx.cwd, ctx.getSystemPromptOptions());
        const finalSystemPrompt =
          result.prompt === undefined ? ctx.getSystemPrompt() : await applyResolvedContributions(result.prompt);
        await diagnosticCommand.onPrompt(finalSystemPrompt, result.sources);
      },
    });
  }

  let lastKnownSystemPrompt: string | undefined;
  pi.on('before_agent_start', async (event, ctx) => {
    const result = await buildEffectiveSystemPrompt(ctx.cwd, event.systemPromptOptions);
    if (result.prompt === undefined) {
      return;
    }

    const finalSystemPrompt = await applyResolvedContributions(result.prompt);

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

    lastKnownSystemPrompt = lastKnownSystemPrompt ?? finalSystemPrompt;
    if (lastKnownSystemPrompt !== finalSystemPrompt) {
      const outFilePath = normalize(join(homedir(), `${Date.now()}-CHANGED-SYSPROMPT.diff`));
      ctx.ui.notify(`unexpected system prompt change! Check ${outFilePath}`, 'warning');

      appendFileSync(
        outFilePath,
        `${createTwoFilesPatch('previousPrompt', 'newPrompt', lastKnownSystemPrompt, finalSystemPrompt)}`,
        { encoding: 'utf8' },
      );
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
