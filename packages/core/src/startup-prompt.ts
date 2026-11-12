import { existsSync, readFileSync } from 'node:fs';
import type { RenderedText } from './prompt-template.js';
import { buildSandpiperSystemPrompt, type SystemPromptTemplates } from './system-prompt.js';
import { getSandpiperUserProfilePath, readSandpiperUserProfile } from './user-profile.js';
import { detectVersionControl, type SandpiperVersionControlContext } from './version-control.js';

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
  /** The file `identityContent` was read from. */
  readonly identityPath?: string;
  readonly templates?: SystemPromptTemplates;
  readonly versionControl?: SandpiperVersionControlContext;
  readonly userProfile?: string;
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
): Promise<RenderedText | undefined> {
  if (input.systemPromptOptions.customPrompt) {
    return undefined;
  }

  const resolved = resolveStartupPromptDependencies(dependencies);

  return resolved.buildSystemPrompt(
    {
      piCodingAgentPackage: resolved.env.PI_CODING_AGENT_PACKAGE,
      piCodingAgentVersion: resolved.env.PI_CODING_AGENT_VERSION,
      sandpiperCodingAgentPackage: resolved.env.SANDPIPER_CODING_AGENT_PACKAGE,
      versionControl:
        input.versionControl ?? resolved.detectVersionControl(input.cwd, { fileExists: resolved.fileExists }),
      userProfile:
        input.userProfile ??
        resolved.readUserProfile({
          agentDir: input.agentDir,
          fileExists: resolved.fileExists,
          readFile: resolved.readFile,
        }),
      userProfilePath: input.agentDir ? getSandpiperUserProfilePath(input.agentDir) : undefined,
      identityOverride: input.identityContent,
      identityPath: input.identityPath,
      templates: input.templates,
      sessionStartDate: input.sessionStartDate,
      dumpSystemPrompt: input.dumpSystemPrompt,
    },
    input.systemPromptOptions,
  );
}
