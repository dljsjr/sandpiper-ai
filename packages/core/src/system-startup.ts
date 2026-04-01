export interface SessionEntryLike {
  readonly type: string;
}

export interface SandpiperSystemPromptOptions {
  readonly piCodingAgentPackage?: string;
  readonly piCodingAgentVersion?: string;
  readonly projectTriggers?: string;
  readonly activeTaskContext?: string;
  readonly workingCopyContext?: string;
  readonly coldStartGuidance?: string;
  readonly standupContent?: string;
}

export function shouldTreatInitialLoadAsColdStart(
  sessionFile: string | undefined,
  entries: readonly SessionEntryLike[],
): boolean {
  return sessionFile === undefined || !entries.some((entry) => entry.type === 'message');
}

export function formatStandupContext(raw: string): string {
  if (raw.trim().length === 0) return '';

  return `

# Previous Session Context

The following is the stand-up note from the previous session. Use it to orient yourself
on what was done, what's planned next, and any important context. Do NOT read the session
file referenced in the header — it is a large JSONL file.

${raw}`;
}

export function formatColdStartGuidance(): string {
  return `

# Cold-Start Guidance

This session started without restored conversation history.
Before making changes that depend on prior work:
- orient from the stand-up below
- review the active task context and working-copy context in this prompt
- use the root AGENTS.md routing table to load focused docs and local module docs for the area you will touch
- summarize current state before implementing if the user's request depends on prior session context`;
}

export function buildSandpiperSystemPrompt(basePrompt: string, options: SandpiperSystemPromptOptions): string {
  const identityBlock = `

IMPORTANT: You are running via an extension framework called 'sandpiper', and the 'sandpiper' identity should supersede the 'pi'
identity whenever it makes sense.

Your core functionality is still provided by the 'pi' coding agent, and all of the previous information about the Pi framework,
its documentation, APIs, etc. remain valid, with a few alterations:

- The user global config directory is '~/.sandpiper' instead of '~/.pi'
- The project local config directory is './.sandpiper' instead of './.pi'
- The README/CHANGELOG/docs/examples are all vendored and should be where you expect them to be, but if they aren't,
  you can find them at ${options.piCodingAgentPackage}, which is also in the environment variable 'PI_CODING_AGENT_PACKAGE'
- The version string for 'sandpiper' is separate from the version string for 'pi'; you are wrapped around Pi version ${options.piCodingAgentVersion},
  which is also in the environment variable 'PI_CODING_AGENT_VERSION'
- You are distributed with a good bit of functionality that the core 'pi' framework doesn't include, via bundled extensions, skills, and prompts.
`;

  // Prefix-caching strategy:
  // 1) Keep static sections first (base prompt + identity block).
  // 2) Append dynamic sections afterwards.
  // 3) Within dynamic sections, keep less-volatile blocks before more-volatile blocks.
  const dynamicSections = [
    options.projectTriggers ?? '',
    options.standupContent ?? '',
    options.activeTaskContext ?? '',
    options.workingCopyContext ?? '',
    // Cold-start guidance is one-shot/volatile; keep it last to maximize
    // shared prefix caching across cold-start vs resumed first turns.
    options.coldStartGuidance ?? '',
  ];

  return basePrompt + identityBlock + dynamicSections.join('');
}
