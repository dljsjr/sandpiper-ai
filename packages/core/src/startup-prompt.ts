import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SystemRuntimeState } from './session-continuity.js';
import {
  collectActiveTaskContext,
  collectProjectTriggers,
  collectWorkingCopySummary,
  formatActiveTaskContextForPrompt,
  formatProjectTriggersForPrompt,
  formatWorkingCopySummaryForPrompt,
} from './startup-context.js';
import { buildSandpiperSystemPrompt } from './system-prompt.js';
import { readSandpiperUserProfile } from './user-profile.js';
import { detectVersionControl } from './version-control.js';

type BuildSystemPrompt = typeof buildSandpiperSystemPrompt;

export interface StandupContentDependencies {
  readonly fileExists?: (path: string) => boolean;
  readonly readFile?: (path: string) => string;
  readonly runStandupRead?: (cwd: string) => string;
}

export interface StartupPromptDependencies extends StandupContentDependencies {
  readonly buildSystemPrompt?: BuildSystemPrompt;
  readonly collectActiveTaskContext?: typeof collectActiveTaskContext;
  readonly collectProjectTriggers?: typeof collectProjectTriggers;
  readonly collectWorkingCopySummary?: typeof collectWorkingCopySummary;
  readonly env?: NodeJS.ProcessEnv;
  readonly detectVersionControl?: typeof detectVersionControl;
  readonly readUserProfile?: typeof readSandpiperUserProfile;
  readonly formatActiveTaskContextForPrompt?: typeof formatActiveTaskContextForPrompt;
  readonly formatProjectTriggersForPrompt?: typeof formatProjectTriggersForPrompt;
  readonly formatWorkingCopySummaryForPrompt?: typeof formatWorkingCopySummaryForPrompt;
}

export interface StartupPromptInput {
  readonly agentDir?: string;
  readonly identityContent?: string;
  readonly cwd: string;
  readonly systemPromptOptions: Parameters<BuildSystemPrompt>[1];
  readonly dumpSystemPrompt?: boolean;
}

type ResolvedStartupPromptDependencies = Required<StartupPromptDependencies>;

function withoutUndefinedValues<T extends Record<string, unknown>>(input: Partial<T>): Partial<T> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>;
}

function resolveStartupPromptDependencies(dependencies: StartupPromptDependencies): ResolvedStartupPromptDependencies {
  return {
    fileExists: existsSync,
    readFile: (path: string) => readFileSync(path, 'utf-8'),
    runStandupRead: defaultRunStandupRead,
    buildSystemPrompt: buildSandpiperSystemPrompt,
    collectActiveTaskContext,
    collectProjectTriggers,
    collectWorkingCopySummary,
    env: process.env,
    detectVersionControl,
    readUserProfile: readSandpiperUserProfile,
    formatActiveTaskContextForPrompt,
    formatProjectTriggersForPrompt,
    formatWorkingCopySummaryForPrompt,
    ...withoutUndefinedValues<ResolvedStartupPromptDependencies>(dependencies),
  };
}

function defaultRunStandupRead(cwd: string): string {
  return execFileSync('sandpiper-standup', ['read', '-d', cwd], {
    encoding: 'utf-8',
    env: { ...process.env },
  });
}

export function readSandpiperStandupContent(cwd: string, dependencies: StandupContentDependencies = {}): string {
  const fileExists = dependencies.fileExists ?? existsSync;
  const readFile = dependencies.readFile ?? ((path: string) => readFileSync(path, 'utf-8'));
  const runStandupRead = dependencies.runStandupRead ?? defaultRunStandupRead;
  const standupPath = join(cwd, '.sandpiper', 'standup.md');

  if (!fileExists(standupPath)) return '';

  try {
    const output = runStandupRead(cwd);
    if (output.trim() !== '# Session Stand-Up') {
      return output;
    }
  } catch {
    // Fall back to direct file read below.
  }

  try {
    return readFile(standupPath);
  } catch {
    return '';
  }
}

export async function buildSandpiperStartupPrompt(
  state: SystemRuntimeState,
  input: StartupPromptInput,
  dependencies: StartupPromptDependencies = {},
): Promise<string | undefined> {
  if (input.systemPromptOptions.customPrompt) {
    return undefined;
  }

  const resolved = resolveStartupPromptDependencies(dependencies);

  const projectTriggers = resolved.formatProjectTriggersForPrompt(resolved.collectProjectTriggers(input.cwd));
  const activeTaskContext = state.startupContextPending
    ? resolved.formatActiveTaskContextForPrompt(resolved.collectActiveTaskContext(input.cwd))
    : '';
  const workingCopyContext = state.startupContextPending
    ? resolved.formatWorkingCopySummaryForPrompt(resolved.collectWorkingCopySummary(input.cwd))
    : '';

  state.startupContextPending = false;
  state.coldStartGuidancePending = false;

  return resolved.buildSystemPrompt(
    {
      cwd: input.cwd,
      piCodingAgentPackage: resolved.env.PI_CODING_AGENT_PACKAGE,
      piCodingAgentVersion: resolved.env.PI_CODING_AGENT_VERSION,
      sandpiperCodingAgentPackage: resolved.env.SANDPIPER_CODING_AGENT_PACKAGE,
      versionControl: resolved.detectVersionControl(input.cwd, { fileExists: resolved.fileExists }),
      userProfile: resolved.readUserProfile({
        agentDir: input.agentDir,
        fileExists: resolved.fileExists,
        readFile: resolved.readFile,
      }),
      projectTriggers,
      activeTaskContext,
      workingCopyContext,
      identityOverride: input.identityContent,
      dumpSystemPrompt: input.dumpSystemPrompt,
    },
    input.systemPromptOptions,
  );
}
