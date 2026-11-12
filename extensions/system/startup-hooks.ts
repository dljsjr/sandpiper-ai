import { appendFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, normalize, resolve } from 'node:path';
import { getCurrentSystemPrompt } from '@earendil-works/pi-ai';
import {
  type BuildSystemPromptOptions,
  type ExtensionAPI,
  getAgentDir,
  type SessionEntry,
} from '@earendil-works/pi-coding-agent';
import { createTwoFilesPatch } from 'diff';
import type { RenderedText } from '../../packages/core/src/prompt-template.js';
import { setSandpiperSessionEnv } from '../../packages/core/src/session-continuity.js';
import { buildSandpiperStartupPrompt } from '../../packages/core/src/startup-prompt.js';
import {
  formatLocalDate,
  loadSystemPromptTemplates,
  type SystemPromptTemplates,
} from '../../packages/core/src/system-prompt.js';
import { readSandpiperUserProfile } from '../../packages/core/src/user-profile.js';
import { detectVersionControl, type SandpiperVersionControlContext } from '../../packages/core/src/version-control.js';
import {
  applyPromptContributions,
  SANDPIPER_PROMPT_CONTRIBUTION_CHANNEL,
  SandpiperPromptContributionCollector,
} from './prompt-contributions.js';

const SESSION_START_DATE_ENTRY_TYPE = 'sandpiper:session-start-date';

interface SessionStartDateEntryData {
  readonly version: 1;
  readonly date: string;
}

function parseSessionStartDate(data: unknown): string | undefined {
  if (
    typeof data === 'object' &&
    data !== null &&
    'version' in data &&
    data.version === 1 &&
    'date' in data &&
    typeof data.date === 'string'
  ) {
    return data.date;
  }
  return undefined;
}

function getOrCreateSessionStartDate(pi: ExtensionAPI, entries: readonly SessionEntry[]): string {
  const storedEntry = entries.find(
    (entry) => entry.type === 'custom' && entry.customType === SESSION_START_DATE_ENTRY_TYPE,
  );
  const storedDate = storedEntry?.type === 'custom' ? parseSessionStartDate(storedEntry.data) : undefined;
  if (storedDate !== undefined) {
    return storedDate;
  }

  const date = formatLocalDate(new Date());
  const data: SessionStartDateEntryData = { version: 1, date };
  pi.appendEntry(SESSION_START_DATE_ENTRY_TYPE, data);
  return date;
}

export interface StartupPromptDiagnosticSources {
  readonly identity?: string;
}

export interface StartupPromptDiagnosticCommand {
  readonly commandName: string;
  readonly onPrompt: (prompt: string, sources: StartupPromptDiagnosticSources) => void | Promise<void>;
  /** Receives the prompt Sandpiper gives Pi as its preamble, with its editable spans, on each run. */
  readonly onPreamble?: (preamble: RenderedText) => void;
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
  let versionControl: SandpiperVersionControlContext | undefined;
  let userProfile: string | undefined;
  let identity: ReturnType<typeof readIdentity> | undefined;
  let templates: SystemPromptTemplates | undefined;
  let lastKnownSystemPrompt: string | undefined;

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
    versionControl = undefined;
    userProfile = undefined;
    identity = undefined;
    templates = undefined;
    lastKnownSystemPrompt = undefined;
    resetPromptContributionListener();
    unsubscribePromptContributions = pi.events.on(SANDPIPER_PROMPT_CONTRIBUTION_CHANNEL, (payload) => {
      promptContributions.add(payload);
    });
  });

  pi.on('session_shutdown', () => {
    resetPromptContributionListener();
  });

  const readIdentity = async () => {
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
    return { identityContent, identitySource };
  };

  const buildEffectiveSystemPrompt = async (
    cwd: string,
    systemPromptOptions: BuildSystemPromptOptions,
    sessionStartDate: string,
  ) => {
    identity ??= readIdentity();
    const { identityContent, identitySource } = await identity;
    if (!systemPromptOptions.customPrompt) {
      versionControl ??= detectVersionControl(cwd);
      userProfile ??= readSandpiperUserProfile({ agentDir: getAgentDir() });
      templates ??= loadSystemPromptTemplates();
    }
    const prompt = await buildSandpiperStartupPrompt({
      versionControl,
      userProfile,
      agentDir: getAgentDir(),
      cwd,
      systemPromptOptions,
      identityContent,
      identityPath: identitySource,
      templates,
      sessionStartDate,
      dumpSystemPrompt,
    });
    return { prompt, sources: { identity: identitySource } };
  };

  const applyResolvedContributions = async (systemPrompt: RenderedText) => {
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
        const sessionStartDate = getOrCreateSessionStartDate(pi, ctx.sessionManager.getEntries());
        const result = await buildEffectiveSystemPrompt(ctx.cwd, ctx.getSystemPromptOptions(), sessionStartDate);
        const finalSystemPrompt =
          result.prompt === undefined ? ctx.getSystemPrompt() : (await applyResolvedContributions(result.prompt)).text;
        await diagnosticCommand.onPrompt(finalSystemPrompt, result.sources);
      },
    });
  }

  if (dumpSystemPrompt) {
    // Dump at request time rather than in before_agent_start, so the output includes the sections
    // Pi renders after Sandpiper's prompt (tools, rules, cwd, and extension sections).
    let dumped = false;
    pi.on('context_with_system', (event, ctx) => {
      if (dumped) return;
      dumped = true;
      console.error('system prompt:\n', getCurrentSystemPrompt(event.messages));
      ctx.shutdown();
      // ctx.shutdown() only exits reliably in modes that wire a real shutdown
      // handler (tui, rpc). Pi's print mode -- forced whenever stdin/stdout
      // isn't a TTY, i.e. every headless/scripted/CI invocation -- never
      // registers one, so shutdown() silently no-ops there and execution
      // would otherwise fall through into a real agent turn. Hard-exit
      // shortly after as a fallback for that case; harmless when shutdown()
      // already worked, since the process is gone before this fires.
      setTimeout(() => process.exit(0), 200);
    });
  }

  pi.on('before_agent_start', async (event, ctx) => {
    const sessionStartDate = getOrCreateSessionStartDate(pi, ctx.sessionManager.getEntries());
    const result = await buildEffectiveSystemPrompt(ctx.cwd, event.systemPromptOptions, sessionStartDate);
    if (result.prompt === undefined) {
      return;
    }

    const preamble = await applyResolvedContributions(result.prompt);
    diagnosticCommand?.onPreamble?.(preamble);
    const finalSystemPrompt = preamble.text;

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

    // Own the prompt through Pi's custom base prompt so the transcript records it; a returned
    // systemPrompt would apply to this run only and leave /export on Pi's default. Sandpiper
    // renders these inputs itself, so Pi must not render them again.
    const options = event.systemPromptOptions;
    options.customPrompt = finalSystemPrompt;
    options.appendSystemPrompt = '';
    options.contextFiles = [];
    options.skills = [];
  });
}

export function registerSessionContinuityHooks(pi: ExtensionAPI): void {
  pi.on('session_start', async (_event, ctx) => {
    setSandpiperSessionEnv(process.env, {
      sessionId: ctx.sessionManager.getSessionId(),
      sessionFile: ctx.sessionManager.getSessionFile(),
    });
  });
}
