import {
  type CreateAgentSessionRuntimeFactory,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  hasTrustRequiringProjectResources,
  ProjectTrustStore,
  parseArgs,
  SessionManager,
  SettingsManager,
} from '@earendil-works/pi-coding-agent';
import { createSandpiperExtensionFactories } from './sandpiper_resources.js';

const DIAGNOSTIC_COMMAND = '__sandpiper-system-prompt';

export interface SystemPromptDiagnosticOptions {
  readonly args: readonly string[];
  readonly cwd: string;
  readonly resourceRoot: string;
}

export interface SystemPromptDiagnosticSources {
  readonly identity?: string;
  readonly systemPrompt?: string;
  readonly appendSystemPrompts: readonly string[];
  readonly contextFiles: readonly string[];
}

export interface SystemPromptDiagnosticResult {
  readonly prompt: string;
  readonly warnings: readonly string[];
  readonly sources: SystemPromptDiagnosticSources;
  readonly json: boolean;
}

function resolveProjectTrust(cwd: string, agentDir: string, override: boolean | undefined): boolean {
  if (override !== undefined) return override;
  if (!hasTrustRequiringProjectResources(cwd)) return true;
  return new ProjectTrustStore(agentDir).get(cwd) === true;
}

export async function renderSystemPrompt(
  options: SystemPromptDiagnosticOptions,
): Promise<SystemPromptDiagnosticResult> {
  const parsed = parseArgs([...options.args]);
  const errors = parsed.diagnostics.filter((diagnostic) => diagnostic.type === 'error');
  if (errors.length > 0) {
    throw new Error(errors.map((diagnostic) => diagnostic.message).join('\n'));
  }
  if (parsed.messages.length > 0 || parsed.fileArgs.length > 0) {
    throw new Error('sandpiper-system-prompt does not accept prompt messages or @file arguments');
  }

  const warnings = parsed.diagnostics
    .filter((diagnostic) => diagnostic.type === 'warning')
    .map((diagnostic) => diagnostic.message);
  const agentDir = getAgentDir();
  const settingsManager = SettingsManager.create(options.cwd, agentDir, {
    projectTrusted: resolveProjectTrust(options.cwd, agentDir, parsed.projectTrustOverride),
  });
  let renderedPrompt: string | undefined;
  let identitySource: string | undefined;
  const extensionFactories = createSandpiperExtensionFactories(options.resourceRoot, {
    checkForUpdates: async () => [],
    systemPromptDiagnostic: {
      commandName: DIAGNOSTIC_COMMAND,
      onPrompt: (prompt, sources) => {
        renderedPrompt = prompt;
        identitySource = sources.identity;
      },
    },
  });

  const createRuntime: CreateAgentSessionRuntimeFactory = async ({
    cwd,
    agentDir: runtimeAgentDir,
    sessionManager,
    sessionStartEvent,
  }) => {
    const services = await createAgentSessionServices({
      cwd,
      agentDir: runtimeAgentDir,
      settingsManager,
      modelRuntimeSignal: AbortSignal.timeout(15_000),
      extensionFlagValues: parsed.unknownFlags,
      resourceLoaderOptions: {
        additionalExtensionPaths: parsed.extensions,
        additionalSkillPaths: parsed.skills,
        additionalPromptTemplatePaths: parsed.promptTemplates,
        additionalThemePaths: parsed.themes,
        noExtensions: parsed.noExtensions,
        noSkills: parsed.noSkills,
        noPromptTemplates: parsed.noPromptTemplates,
        noThemes: parsed.noThemes,
        noContextFiles: parsed.noContextFiles,
        systemPrompt: parsed.systemPrompt,
        appendSystemPrompt: parsed.appendSystemPrompt,
        extensionFactories,
      },
    });
    const created = await createAgentSessionFromServices({
      services,
      sessionManager,
      sessionStartEvent,
      tools: parsed.tools,
      excludeTools: parsed.excludeTools,
      noTools: parsed.noTools ? 'all' : parsed.noBuiltinTools ? 'builtin' : undefined,
    });
    const extensionDiagnostics = services.resourceLoader.getExtensions().errors.map(({ path, error }) => ({
      type: 'error' as const,
      message: `Failed to load extension "${path}": ${error}`,
    }));

    return {
      ...created,
      services,
      diagnostics: [...services.diagnostics, ...extensionDiagnostics],
    };
  };

  const runtime = await createAgentSessionRuntime(createRuntime, {
    cwd: options.cwd,
    agentDir,
    sessionManager: SessionManager.inMemory(options.cwd),
  });

  let json = false;
  try {
    for (const diagnostic of runtime.diagnostics) {
      if (diagnostic.type === 'error') {
        throw new Error(diagnostic.message);
      }
      warnings.push(diagnostic.message);
    }

    await runtime.session.bindExtensions({
      mode: 'print',
      onError: (error) => {
        warnings.push(`Extension error (${error.extensionPath}): ${error.error}`);
      },
    });
    json = runtime.session.extensionRunner.getFlagValues().get('json') === true;
    await runtime.session.prompt(`/${DIAGNOSTIC_COMMAND}`);
  } finally {
    await runtime.dispose();
  }

  if (renderedPrompt === undefined) {
    throw new Error('Sandpiper system prompt diagnostic command did not produce a prompt');
  }

  const resourceLoader = runtime.services.resourceLoader;
  return {
    prompt: renderedPrompt,
    warnings,
    sources: {
      identity: identitySource,
      systemPrompt: resourceLoader.getSystemPromptSource()?.path,
      appendSystemPrompts: resourceLoader.getAppendSystemPromptSources().map(({ path }) => path),
      contextFiles: resourceLoader.getAgentsFiles().agentsFiles.map(({ path }) => path),
    },
    json,
  };
}
