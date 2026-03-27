import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { DynamicBorder } from '@mariozechner/pi-coding-agent';
import { Container, Text } from '@mariozechner/pi-tui';
import {
  collectPreflightDiagnostics,
  detectUnmigratedConfigs,
  formatInstallInstructions,
  installShellIntegrations,
  type MigrationMode,
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

// ─── Project Metadata ───────────────────────────────────────────

interface ProjectTrigger {
  readonly key: string;
  readonly whenToRead: string;
  readonly location: string;
}

/**
 * Extract a YAML frontmatter field from a markdown file's content.
 * Handles both quoted and unquoted values.
 */
function extractFrontmatterField(content: string, field: string): string {
  const match = content.match(new RegExp(`^${field}:\\s*"?([^"\\n]*)"?`, 'm'));
  return match?.[1]?.trim() ?? '';
}

/**
 * Scan .sandpiper/tasks/{project}/PROJECT.md for project metadata triggers.
 * Returns only projects that have a non-empty when_to_read field.
 */
function collectProjectTriggers(cwd: string): readonly ProjectTrigger[] {
  const tasksDir = join(cwd, '.sandpiper', 'tasks');
  if (!existsSync(tasksDir)) return [];

  const triggers: ProjectTrigger[] = [];
  for (const entry of readdirSync(tasksDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const projectMdPath = join(tasksDir, entry.name, 'PROJECT.md');
    if (!existsSync(projectMdPath)) continue;

    try {
      const content = readFileSync(projectMdPath, 'utf-8');
      const key = extractFrontmatterField(content, 'key');
      const whenToRead = extractFrontmatterField(content, 'when_to_read');
      if (key && whenToRead) {
        triggers.push({
          key,
          whenToRead,
          location: `.sandpiper/tasks/${entry.name}/PROJECT.md`,
        });
      }
    } catch {
      // Skip unreadable files
    }
  }
  return triggers;
}

/**
 * Format project triggers as XML for inclusion in the system prompt,
 * mirroring pi's skill injection format.
 */
function formatProjectTriggersForPrompt(triggers: readonly ProjectTrigger[]): string {
  if (triggers.length === 0) return '';

  const escapeXml = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const lines = [
    '',
    'The following projects are registered in the local task tracker.',
    'Use the read tool to load a project file when the task matches its description.',
    '',
    '<available_projects>',
  ];
  for (const trigger of triggers) {
    lines.push('  <project>');
    lines.push(`    <key>${escapeXml(trigger.key)}</key>`);
    lines.push(`    <description>${escapeXml(trigger.whenToRead)}</description>`);
    lines.push(`    <location>${escapeXml(trigger.location)}</location>`);
    lines.push('  </project>');
  }
  lines.push('</available_projects>');
  return lines.join('\n');
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

export default function (pi: ExtensionAPI) {
  // ── Custom message renderers ──

  pi.registerMessageRenderer<UpdateInfo>('sandpiper-update', (message, _options, theme) => {
    const update = message.details;
    if (!update) return undefined;

    const container = new Container();
    container.addChild(new DynamicBorder((s: string) => theme.fg('warning', s)));
    const heading = theme.bold(theme.fg('warning', 'Update Available'));
    const versionLine =
      theme.fg('muted', `New version of ${update.name}: ${update.currentVersion} → ${update.latestVersion}. Run `) +
      theme.fg('accent', update.installCommand);
    let content = `${heading}\n${versionLine}`;
    if (update.changelogUrl) {
      content += `\n${theme.fg('muted', 'Changelog: ')}${theme.fg('accent', update.changelogUrl)}`;
    }
    container.addChild(new Text(content, 1, 0));
    container.addChild(new DynamicBorder((s: string) => theme.fg('warning', s)));
    return container;
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
        projectTriggers,
    };
  });

  // ── Diagnostics + update notifications ──

  pi.on('session_start', async (_event, ctx) => {
    // --- Session identity ---
    process.env.SANDPIPER_SESSION_ID = ctx.sessionManager.getSessionId();
    const sessionFile = ctx.sessionManager.getSessionFile();
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
    if (unhealthy.length > 0) {
      ctx.ui.setWidget('sandpiper-diagnostics', (_tui, theme) => {
        const container = new Container();
        container.addChild(new DynamicBorder((s: string) => theme.fg('warning', s)));
        container.addChild(new Text(theme.bold(theme.fg('warning', '⚠  Sandpiper Diagnostics')), 1, 0));
        for (const d of unhealthy) {
          container.addChild(new Text(`  ${theme.fg('warning', d.message)}`, 1, 0));
          for (const instruction of d.instructions ?? []) {
            container.addChild(new Text(theme.fg('muted', `    ${instruction}`), 1, 0));
          }
        }
        container.addChild(new DynamicBorder((s: string) => theme.fg('warning', s)));
        return {
          render: (w: number) => container.render(w),
          invalidate: () => container.invalidate(),
        };
      });
    } else {
      ctx.ui.setWidget('sandpiper-diagnostics', undefined);
    }

    // --- Update notifications ---
    // Fire-and-forget: don't await so the notification appears after
    // startup info (Context, Skills, etc.) has rendered, matching Pi's
    // own update banner placement.
    if (resolveEnvVar('OFFLINE') !== '1') {
      checkForUpdates().then((updates) => {
        for (const update of updates) {
          pi.sendMessage({
            customType: 'sandpiper-update',
            content: '',
            display: true,
            details: update,
          });
        }
      });
    }
  });
}
