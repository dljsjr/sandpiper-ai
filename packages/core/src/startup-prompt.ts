import { existsSync, readFileSync } from 'node:fs';
import { buildSandpiperSystemPrompt } from './system-prompt.js';
import { readSandpiperUserProfile } from './user-profile.js';
import { detectVersionControl } from './version-control.js';

type BuildSystemPrompt = typeof buildSandpiperSystemPrompt;

export interface StartupPromptDependencies {
  readonly fileExists?: (path: string) => boolean;
  readonly readFile?: (path: string) => string;
  readonly buildSystemPrompt?: BuildSystemPrompt;
  readonly env?: NodeJS.ProcessEnv;
  readonly detectVersionControl?: typeof detectVersionControl;
  readonly readUserProfile?: typeof readSandpiperUserProfile;
}

export interface StartupPromptInput {
  readonly agentDir?: string;
  readonly identityContent?: string;
  readonly cwd: string;
  readonly systemPromptOptions: Parameters<BuildSystemPrompt>[1];
  readonly sessionStartDate?: string;
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
    buildSystemPrompt: buildSandpiperSystemPrompt,
    env: process.env,
    detectVersionControl,
    readUserProfile: readSandpiperUserProfile,
    ...withoutUndefinedValues<ResolvedStartupPromptDependencies>(dependencies),
  };
}

export async function buildSandpiperStartupPrompt(
  input: StartupPromptInput,
  dependencies: StartupPromptDependencies = {},
): Promise<string | undefined> {
  if (input.systemPromptOptions.customPrompt) {
    return undefined;
  }

  const resolved = resolveStartupPromptDependencies(dependencies);

  return resolved.buildSystemPrompt(
    {
      piCodingAgentPackage: resolved.env.PI_CODING_AGENT_PACKAGE,
      piCodingAgentVersion: resolved.env.PI_CODING_AGENT_VERSION,
      sandpiperCodingAgentPackage: resolved.env.SANDPIPER_CODING_AGENT_PACKAGE,
      versionControl: resolved.detectVersionControl(input.cwd, { fileExists: resolved.fileExists }),
      userProfile: resolved.readUserProfile({
        agentDir: input.agentDir,
        fileExists: resolved.fileExists,
        readFile: resolved.readFile,
      }),
      identityOverride: input.identityContent,
      sessionStartDate: input.sessionStartDate,
      dumpSystemPrompt: input.dumpSystemPrompt,
    },
    input.systemPromptOptions,
  );
}
