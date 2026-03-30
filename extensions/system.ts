import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { DynamicBorder } from '@mariozechner/pi-coding-agent';
import { Spacer, Text } from '@mariozechner/pi-tui';
import { Type } from '@sinclair/typebox';
import {
  collectActiveTaskContext,
  collectPreflightDiagnostics,
  collectProjectTriggers,
  collectWorkingCopySummary,
  detectUnmigratedConfigs,
  formatActiveTaskContextForPrompt,
  formatInstallInstructions,
  formatProjectTriggersForPrompt,
  formatWorkingCopySummaryForPrompt,
  installShellIntegrations,
  type MigrationMode,
  ProcessManager,
  parseMigrationCommandArgs,
  parseMigrationScope,
  performMigration,
  resolveEnvVar,
} from 'sandpiper-ai-core';

// ─── Version Check ──────────────────────────────────────────────

interface UpdateInfo {
  readonly name: string;
  readonly currentVersion: string;
  readonly latestVersion: string;
  readonly installCommand: string;
  readonly changelogUrl?: string;
}

/**
 * Check the npm registry for a newer version of a package.
 * Returns the latest version string if an update is available, undefined otherwise.
 */
async function checkNpmVersion(packageName: string, currentVersion: string): Promise<string | undefined> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}/latest`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return undefined;
    const data = (await response.json()) as { version?: string };
    if (data.version && data.version !== currentVersion) {
      return data.version;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Detect install method and return the appropriate install command.
 */
function getInstallCommand(packageName: string): string {
  const isBun = !!process.versions.bun;
  if (isBun) return `bun install -g ${packageName}`;
  return `npm install -g ${packageName}`;
}

/**
 * Check for updates to both pi-coding-agent and sandpiper.
 * Returns an array of available updates (empty if everything is current).
 */
async function checkForUpdates(): Promise<readonly UpdateInfo[]> {
  const updates: UpdateInfo[] = [];

  // Check pi-coding-agent
  const piVersion = process.env.PI_CODING_AGENT_VERSION;
  if (piVersion) {
    const piLatest = await checkNpmVersion('@mariozechner/pi-coding-agent', piVersion);
    if (piLatest) {
      updates.push({
        name: 'pi-coding-agent',
        currentVersion: piVersion,
        latestVersion: piLatest,
        installCommand: getInstallCommand('@mariozechner/pi-coding-agent'),
        changelogUrl: 'https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/CHANGELOG.md',
      });
    }
  }

  // TODO: Check sandpiper when it's published to a package registry.
  // const sandpiperVersion = process.env.SANDPIPER_VERSION ?? '0.0.1';
  // const sandpiperLatest = await checkNpmVersion('sandpiper-ai', sandpiperVersion);
  // if (sandpiperLatest) {
  //   updates.push({
  //     name: 'sandpiper',
  //     currentVersion: sandpiperVersion,
  //     latestVersion: sandpiperLatest,
  //     installCommand: getInstallCommand('sandpiper-ai'),
  //   });
  // }

  return updates;
}

// ─── Chat Container Access ──────────────────────────────────────

/**
 * Get the chat container from the TUI component tree.
 *
 * The chat container is the second child (index 1) of the TUI root,
 * per interactive-mode.ts init() layout order:
 *   [0] headerContainer, [1] chatContainer, [2] pendingMessages,
 *   [3] status, [4] widgetAbove, [5] editor, [6] widgetBelow, [7] footer
 *
 * Components added here flow with the chat — they scroll up naturally
 * and are NOT persisted to the session JSONL.
 */
function getChatContainer(tui: { children: unknown[] }): { addChild: (c: unknown) => void } | undefined {
  const candidate = tui.children[1];
  if (
    candidate &&
    typeof candidate === 'object' &&
    'addChild' in candidate &&
    typeof (candidate as Record<string, unknown>).addChild === 'function'
  ) {
    return candidate as { addChild: (c: unknown) => void };
  }
  return undefined;
}

// ─── Migration ──────────────────────────────────────────────────

/**
 * Handle migration flag — perform migration and exit.
 */
async function handleMigrationFlag(pi: ExtensionAPI, mode: MigrationMode, cwd: string): Promise<void> {
  const scope = parseMigrationScope(pi.getFlag('pi-configs-global') === true, pi.getFlag('pi-configs-local') === true);
  const result = await performMigration(mode, { cwd, scope });

  if (result.success) {
    if (result.migrated.length > 0) {
      console.log('✓ Migration complete!');
      for (const path of result.migrated) {
        console.log(`  Migrated: ${path}`);
      }
    } else {
      console.log('No configs to migrate.');
    }
    process.exit(0);
  } else {
    console.error(`✗ Migration failed: ${result.error}`);
    process.exit(1);
  }
}

// ─── Extension ──────────────────────────────────────────────────

const processManager = new ProcessManager();
let startupContextPending = true;
let coldStartGuidancePending = false;

export default function (pi: ExtensionAPI) {
  // ── Background process tools ──

  pi.registerTool({
    name: 'start_background_process',
    label: 'Start Background Process',
    description:
      'Start a long-running background process. Returns immediately with a process ID. ' +
      'The process runs independently — use check_background_process to poll its status and output. ' +
      'Use for builds, file watchers, server processes, or any command that should run while you continue working.',
    parameters: Type.Object({
      id: Type.String({ description: 'Unique identifier for this process (used to check/kill it later)' }),
      command: Type.String({ description: 'Command to execute' }),
      args: Type.Optional(Type.Array(Type.String(), { description: 'Command arguments' })),
      cwd: Type.Optional(Type.String({ description: 'Working directory (defaults to session cwd)' })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      try {
        const proc = processManager.spawn({
          id: params.id,
          command: params.command,
          args: params.args,
          cwd: params.cwd ?? ctx.cwd,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: `Background process "${params.id}" started (PID: ${proc.pid}).`,
            },
          ],
          details: { id: params.id, pid: proc.pid, status: 'running' },
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Failed to start background process: ${msg}` }],
          details: { error: msg },
          isError: true,
        };
      }
    },
  });

  pi.registerTool({
    name: 'check_background_process',
    label: 'Check Background Process',
    description:
      'Check the status of a background process. By default returns only status and exit code (no output, low context cost). ' +
      'Set include_stdout/include_stderr to true to retrieve buffered output. Use tail_lines to limit output volume.',
    parameters: Type.Object({
      id: Type.String({ description: 'Process ID to check' }),
      include_stdout: Type.Optional(Type.Boolean({ description: 'Include buffered stdout (default: false)' })),
      include_stderr: Type.Optional(Type.Boolean({ description: 'Include buffered stderr (default: false)' })),
      tail_lines: Type.Optional(Type.Number({ description: 'Only include last N lines of output' })),
      clear_buffer: Type.Optional(Type.Boolean({ description: 'Clear output buffers after reading (default: false)' })),
    }),
    async execute(_toolCallId, params) {
      const proc = processManager.get(params.id);
      if (!proc) {
        return {
          content: [{ type: 'text' as const, text: `No background process found with ID "${params.id}".` }],
          details: { id: params.id, pid: undefined, running: false, exitCode: null, exitSignal: null },
          isError: true,
        };
      }

      const readOpts = { tail: params.tail_lines, clear: params.clear_buffer };
      const parts: string[] = [];

      parts.push(`Process "${params.id}": ${proc.running ? 'running' : 'exited'} (PID: ${proc.pid ?? 'n/a'})`);
      if (!proc.running) {
        parts.push(`Exit code: ${proc.exitCode}`);
      }

      if (params.include_stdout) {
        const stdout = proc.readStdout(readOpts);
        parts.push(`\nSTDOUT (${proc.stdoutLineCount} lines buffered):\n${stdout || '(empty)'}`);
      }

      if (params.include_stderr) {
        const stderr = proc.readStderr(readOpts);
        parts.push(`\nSTDERR (${proc.stderrLineCount} lines buffered):\n${stderr || '(empty)'}`);
      }

      return {
        content: [{ type: 'text' as const, text: parts.join('\n') }],
        details: proc.info,
      };
    },
  });

  // ── Shell integration install flag ──

  pi.registerFlag('install-shell-integrations', {
    description:
      'Install shell integration scripts to ~/.sandpiper/shell-integrations/, print sourcing instructions, then exit',
    type: 'boolean',
    default: false,
  });

  // ── Migration flags ──

  pi.registerFlag('migrate-pi-configs', {
    description: 'Migrate ~/.pi and ./.pi to ~/.sandpiper and ./.sandpiper, then exit',
    type: 'boolean',
    default: false,
  });

  pi.registerFlag('symlink-config', {
    description: 'Symlink ~/.pi and ./.pi to ~/.sandpiper and ./.sandpiper, then exit',
    type: 'boolean',
    default: false,
  });

  // Note: pi's registerFlag API has no built-in concept of flag dependencies or
  // required-if relationships. The CLI parser simply collects all registered flags
  // and stores their values. Conditional validation is done manually at runtime.
  pi.registerFlag('pi-configs-global', {
    description: 'With --migrate-pi-configs or --symlink-config: only operate on global config (~/.pi)',
    type: 'boolean',
    default: false,
  });

  pi.registerFlag('pi-configs-local', {
    description: 'With --migrate-pi-configs or --symlink-config: only operate on project-local config (./.pi)',
    type: 'boolean',
    default: false,
  });

  // Handle CLI-only flags in session_directory (fires before session is created)
  pi.on('session_directory', async (event) => {
    // --install-shell-integrations
    if (pi.getFlag('install-shell-integrations')) {
      const result = installShellIntegrations();
      if (result.success) {
        console.log(formatInstallInstructions(result.installedTo));
        process.exit(0);
      } else {
        console.error(`✗ Install failed: ${result.error}`);
        process.exit(1);
      }
    }

    const migrate = pi.getFlag('migrate-pi-configs');
    const symlink = pi.getFlag('symlink-config');
    const hasScope = pi.getFlag('pi-configs-global') || pi.getFlag('pi-configs-local');

    // Scope flags require a migration flag
    if (hasScope && !migrate && !symlink) {
      console.error(
        'Error: --pi-configs-global and --pi-configs-local require --migrate-pi-configs or --symlink-config.',
      );
      process.exit(1);
    }

    // Migration flags are mutually exclusive
    if (migrate && symlink) {
      console.error('Error: --migrate-pi-configs and --symlink-config are mutually exclusive.');
      process.exit(1);
    }

    if (migrate) await handleMigrationFlag(pi, 'move', event.cwd);
    if (symlink) await handleMigrationFlag(pi, 'symlink', event.cwd);
  });

  // ── Migration slash command ──

  pi.registerCommand('migrate-pi', {
    description: 'Migrate pi configs to sandpiper (move|symlink [--pi-configs-global|--pi-configs-local])',
    getArgumentCompletions: (prefix: string) => {
      const options = ['move', 'symlink', '--pi-configs-global', '--pi-configs-local'];
      return options.filter((o) => o.startsWith(prefix)).map((o) => ({ value: o, label: o }));
    },
    handler: async (args, ctx) => {
      const parsed = parseMigrationCommandArgs(args ?? '');

      if ('error' in parsed) {
        ctx.ui.notify(parsed.error, 'error');
        return;
      }

      const result = await performMigration(parsed.mode, { cwd: ctx.cwd, scope: parsed.scope });

      if (result.success) {
        ctx.ui.setWidget('sandpiper-diagnostics', undefined); // Will be re-evaluated on next session_start
        const verb = parsed.mode === 'move' ? 'Migration' : 'Symlink';
        if (result.migrated.length > 0) {
          ctx.ui.notify(`${verb} complete. Reloading...`, 'info');
          await ctx.reload();
        } else {
          ctx.ui.notify('No configs to migrate.', 'info');
        }
      } else {
        const verb = parsed.mode === 'move' ? 'Migration' : 'Symlink';
        ctx.ui.notify(`${verb} failed: ${result.error}`, 'error');
      }
    },
  });

  // ── System prompt ──

  pi.on('before_agent_start', async (event, ctx) => {
    const projectTriggers = formatProjectTriggersForPrompt(collectProjectTriggers(ctx.cwd));
    const activeTaskContext = startupContextPending
      ? formatActiveTaskContextForPrompt(collectActiveTaskContext(ctx.cwd))
      : '';
    const workingCopyContext = startupContextPending
      ? formatWorkingCopySummaryForPrompt(collectWorkingCopySummary(ctx.cwd))
      : '';
    const coldStartGuidance = coldStartGuidancePending
      ? `

# Cold-Start Guidance

This session started without restored conversation history.
Before making changes that depend on prior work:
- orient from the stand-up below
- review the active task context and working-copy context in this prompt
- use the root AGENTS.md routing table to load focused docs and local module docs for the area you will touch
- summarize current state before implementing if the user's request depends on prior session context`
      : '';

    startupContextPending = false;
    coldStartGuidancePending = false;

    // Read the standup file for session continuity
    const standupPath = join(ctx.cwd, '.sandpiper', 'standup.md');
    let standupContent = '';
    if (existsSync(standupPath)) {
      try {
        const raw = readFileSync(standupPath, 'utf-8');
        standupContent = `

# Previous Session Context

The following is the stand-up note from the previous session. Use it to orient yourself
on what was done, what's planned next, and any important context. Do NOT read the session
file referenced in the header — it is a large JSONL file.

${raw}`;
      } catch {
        // Standup file unreadable — skip silently
      }
    }

    return {
      systemPrompt:
        event.systemPrompt +
        `

IMPORTANT: You are running via an extension framework called 'sandpiper', and the 'sandpiper' identity should supersede the 'pi'
identity whenever it makes sense.

Your core functionality is still provided by the 'pi' coding agent, and all of the previous information about the Pi framework,
its documentation, APIs, etc. remain valid, with a few alterations:

- The user global config directory is '~/.sandpiper' instead of '~/.pi'
- The project local config directory is './.sandpiper' instead of './.pi'
- The README/CHANGELOG/docs/examples are all vendored and should be where you expect them to be, but if they aren't,
  you can find them at ${process.env.PI_CODING_AGENT_PACKAGE}, which is also in the environment variable 'PI_CODING_AGENT_PACKAGE'
- The version string for 'sandpiper' is separate from the version string for 'pi'; you are wrapped around Pi version ${process.env.PI_CODING_AGENT_VERSION},
  which is also in the environment variable 'PI_CODING_AGENT_VERSION'
- You are distributed with a good bit of functionality that the core 'pi' framework doesn't include, via bundled extensions, skills, and prompts.
` +
        projectTriggers +
        activeTaskContext +
        workingCopyContext +
        coldStartGuidance +
        standupContent,
    };
  });

  // ── Diagnostics + update notifications ──

  pi.on('session_start', async (_event, ctx) => {
    startupContextPending = true;

    // Cold-start heuristic for initial load:
    // - brand-new sessions have no session file yet until after the first agent response
    // - resumed sessions already have a session file
    // - as a fallback, resumed sessions also have prior message entries loaded
    const sessionFile = ctx.sessionManager.getSessionFile();
    coldStartGuidancePending =
      sessionFile === undefined || !ctx.sessionManager.getEntries().some((entry) => entry.type === 'message');

    // --- Session identity ---
    process.env.SANDPIPER_SESSION_ID = ctx.sessionManager.getSessionId();
    if (sessionFile) {
      process.env.SANDPIPER_SESSION_FILE = sessionFile;
    }

    // --- Preflight diagnostics ---
    // Collect from registered checks (extensions) + built-in migration check.
    // pi.events.emit is synchronous — all listeners run before this returns.
    const diagnostics = collectPreflightDiagnostics(pi);

    // Built-in: unmigrated pi configs (not a registered preflight check since it
    // lives in system.ts itself and has no separate extension to register from).
    const unmigrated = detectUnmigratedConfigs(ctx.cwd);
    if (unmigrated.length > 0) {
      diagnostics.push({
        key: 'system:unmigrated-pi-configs',
        healthy: false,
        message: `Unmigrated pi configs detected: ${unmigrated.join(', ')}`,
        instructions: [
          'Migrate:  sandpiper --migrate-pi-configs',
          'Symlink:  sandpiper --symlink-config',
          'Or run:   /migrate-pi move',
        ],
      });
    }

    const unhealthy = diagnostics.filter((d) => !d.healthy);

    // Use a transient widget to capture the TUI reference, then inject
    // banners directly into the chat container so they flow with chat
    // (not sticky) and aren't persisted to the session JSONL.
    ctx.ui.setWidget('sandpiper-banners', (tui, theme) => {
      const chatContainer = getChatContainer(tui);
      if (chatContainer) {
        // Diagnostics banner
        if (unhealthy.length > 0) {
          chatContainer.addChild(new Spacer(1));
          chatContainer.addChild(new DynamicBorder((s: string) => theme.fg('warning', s)));
          chatContainer.addChild(new Text(theme.bold(theme.fg('warning', '⚠  Sandpiper Diagnostics')), 1, 0));
          for (const d of unhealthy) {
            chatContainer.addChild(new Text(`  ${theme.fg('warning', d.message)}`, 1, 0));
            for (const instruction of d.instructions ?? []) {
              chatContainer.addChild(new Text(theme.fg('muted', `    ${instruction}`), 1, 0));
            }
          }
          chatContainer.addChild(new DynamicBorder((s: string) => theme.fg('warning', s)));
        }

        // Update notifications (fire-and-forget for post-startup placement)
        if (resolveEnvVar('OFFLINE') !== '1') {
          checkForUpdates().then((updates) => {
            for (const update of updates) {
              chatContainer.addChild(new Spacer(1));
              chatContainer.addChild(new DynamicBorder((s: string) => theme.fg('warning', s)));
              const heading = theme.bold(theme.fg('warning', 'Update Available'));
              const versionLine =
                theme.fg(
                  'muted',
                  `New version of ${update.name}: ${update.currentVersion} → ${update.latestVersion}. Run `,
                ) + theme.fg('accent', update.installCommand);
              let content = `${heading}\n${versionLine}`;
              if (update.changelogUrl) {
                content += `\n${theme.fg('muted', 'Changelog: ')}${theme.fg('accent', update.changelogUrl)}`;
              }
              chatContainer.addChild(new Text(content, 1, 0));
              chatContainer.addChild(new DynamicBorder((s: string) => theme.fg('warning', s)));
            }
          });
        }
      }

      // Return a no-op component — the real work is the side-effect above
      return { render: () => [], invalidate: () => {} };
    });
    // Clear the dummy widget immediately so it doesn't take up space
    ctx.ui.setWidget('sandpiper-banners', undefined);
  });

  pi.on('session_switch', async (event) => {
    startupContextPending = true;
    coldStartGuidancePending = event.reason === 'new';
  });

  // ── Background process completion notifications ──
  // Inject a message into the LLM context when background processes finish.
  // This fires before every LLM call — zero cost when nothing to report.

  pi.on('context', async (event, _ctx) => {
    const completed = processManager.getCompletedUnacknowledged();
    if (completed.length === 0) return;

    const lines = completed.map((p) => `Background process "${p.id}" exited with code ${p.exitCode}.`);
    for (const p of completed) processManager.acknowledge(p.id);

    return {
      messages: [
        ...event.messages,
        {
          role: 'user',
          content: [{ type: 'text', text: lines.join('\n') }],
        } as (typeof event.messages)[number],
      ],
    };
  });

  // ── Background process cleanup ──

  pi.on('session_shutdown', async () => {
    processManager.killAll();
  });
}
