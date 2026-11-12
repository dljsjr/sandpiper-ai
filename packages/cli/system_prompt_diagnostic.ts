import { join } from 'node:path';
import {
  type Api,
  type AssistantMessage,
  createAssistantMessageEventStream,
  getCurrentSystemPrompt,
  InMemoryCredentialStore,
  type Model,
  type TranscriptContext,
} from '@earendil-works/pi-ai';
import {
  type CreateAgentSessionRuntimeFactory,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  type ExtensionFactory,
  getAgentDir,
  hasTrustRequiringProjectResources,
  ModelRuntime,
  ProjectTrustStore,
  parseArgs,
  SessionManager,
  SettingsManager,
} from '@earendil-works/pi-coding-agent';
import { type EditableSpan, type RenderedText, verifyEditableSpans } from '../core/src/prompt-template.js';
import { createSandpiperExtensionFactories } from './sandpiper_resources.js';

const DIAGNOSTIC_COMMAND = '__sandpiper-system-prompt';
const CAPTURE_PROVIDER = 'sandpiper-prompt-capture';
const CAPTURE_MODEL = 'capture';

export interface SystemPromptDiagnosticOptions {
  readonly args: readonly string[];
  readonly cwd: string;
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
  /** Runs of `prompt` copied verbatim from a template or user file, with their offsets in that file. */
  readonly editableSpans: readonly EditableSpan[];
  readonly json: boolean;
}

function resolveProjectTrust(cwd: string, agentDir: string, override: boolean | undefined): boolean {
  if (override !== undefined) return override;
  if (!hasTrustRequiringProjectResources(cwd)) return true;
  return new ProjectTrustStore(agentDir).get(cwd) === true;
}

// Pi renders the preamble first, so its span offsets are offsets into the captured prompt.
function editableSpans(prompt: string, preamble: RenderedText | undefined): EditableSpan[] {
  if (preamble === undefined || !prompt.startsWith(preamble.text)) return [];
  return verifyEditableSpans(prompt, preamble.spans);
}

function emptyReply(model: Model<Api>): AssistantMessage {
  return {
    role: 'assistant',
    content: [],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: 'stop',
    timestamp: Date.now(),
  };
}

// An in-process provider that records the system prompt of the first request and answers with an
// empty reply, so the diagnostic shows exactly what Pi sends without credentials or network.
function createPromptCaptureExtension(onPrompt: (prompt: string) => void): ExtensionFactory {
  let captured = false;
  return (pi) => {
    pi.registerProvider(CAPTURE_PROVIDER, {
      name: 'Sandpiper prompt capture',
      baseUrl: 'http://sandpiper-prompt-capture.invalid',
      apiKey: 'unused',
      api: 'openai-completions',
      models: [
        {
          id: CAPTURE_MODEL,
          name: 'Sandpiper prompt capture',
          reasoning: false,
          input: ['text'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 128_000,
          maxTokens: 4096,
        },
      ],
      streamSimple: (model: Model<Api>, context: TranscriptContext) => {
        if (!captured) {
          captured = true;
          onPrompt(getCurrentSystemPrompt(context.messages));
        }
        const reply = emptyReply(model);
        const stream = createAssistantMessageEventStream();
        queueMicrotask(() => {
          stream.push({ type: 'start', partial: reply });
          stream.push({ type: 'done', reason: 'stop', message: reply });
          stream.end();
        });
        return stream;
      },
    });
  };
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
  // Prompt rendering needs model metadata for normal session setup, never stored provider credentials.
  const modelRuntime = await ModelRuntime.create({
    credentials: new InMemoryCredentialStore(),
    modelsPath: join(agentDir, 'models.json'),
    signal: AbortSignal.timeout(15_000),
  });
  let renderedPrompt: string | undefined;
  let preamble: RenderedText | undefined;
  let identitySource: string | undefined;
  const extensionFactories = [
    ...createSandpiperExtensionFactories({
      systemPromptDiagnostic: {
        commandName: DIAGNOSTIC_COMMAND,
        onPrompt: (_prompt, sources) => {
          identitySource = sources.identity;
        },
        onPreamble: (rendered) => {
          preamble = rendered;
        },
      },
    }),
    createPromptCaptureExtension((prompt) => {
      renderedPrompt = prompt;
    }),
  ];

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
      modelRuntime,
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
    const captureModel = runtime.session.modelRuntime.getModel(CAPTURE_PROVIDER, CAPTURE_MODEL);
    if (!captureModel) {
      throw new Error('Sandpiper prompt capture provider is not registered');
    }
    await runtime.session.setModel(captureModel);
    await runtime.session.prompt('Render the system prompt.');
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
    editableSpans: editableSpans(renderedPrompt, preamble),
    json,
  };
}
