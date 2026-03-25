import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import {
  type MigrationMode,
  parseMigrationCommandArgs,
  parseMigrationScope,
  performMigration,
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

// ─── Migration ──────────────────────────────────────────────────

/**
 * Handle migration flag — perform migration and exit.
 */
async function handleMigrationFlag(pi: ExtensionAPI, mode: MigrationMode, cwd: string): Promise<void> {
  const scope = parseMigrationScope(
    pi.getFlag('--pi-configs-global') === true,
    pi.getFlag('--pi-configs-local') === true,
  );
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

  // Handle migration flags in session_directory (CLI-only, fires before session is created)
  pi.on('session_directory', async (event) => {
    const migrate = pi.getFlag('--migrate-pi-configs');
    const symlink = pi.getFlag('--symlink-config');
    const hasScope = pi.getFlag('--pi-configs-global') || pi.getFlag('--pi-configs-local');

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
        ctx.ui.setWidget('migration-warning', undefined); // Clear warning banner if present
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

  pi.on('before_agent_start', async (event) => {
    return {
      systemPrompt:
        event.systemPrompt +
        `

IMPORTANT: You are running via an extension framework called 'sandpiper', and the 'sandpiper' identity should supersede the 'pi'
identity whenever it makes sense.

Your core functionality is still provided by the 'pi' coding agent, and all of the previous information about the Pi framework,
its documentation, APIs, etc. remain valid, with a few alterations:

- The user global config directory is '~/.sandpiepr' instead of '~/.pi'
- The project local config directory is './.sandpiper' instead of './.pi'
- The README/CHANGELOG/docs/examples are all vendored and should be where you expect them to be, but if they aren't,
  you can find them at ${process.env.PI_CODING_AGENT_PACKAGE}, which is also in the environment variable 'PI_CODING_AGENT_PACKAGE'
- The version string for 'sandpiper' is separate from the version string for 'pi'; you are wrapped around Pi version ${process.env.PI_CODING_AGENT_VERSION},
  which is also in the environment variable 'PI_CODING_AGENT_VERSION'
- You are distributed with a good bit of functionality that the core 'pi' framework doesn't include, via bundled extensions, skills, and prompts.
`,
    };
  });

  // ── Update notifications ──

  pi.on('session_start', async (_event, ctx) => {
    if (process.env.PI_OFFLINE === '1') return;

    const updates = await checkForUpdates();
    if (updates.length === 0) return;

    for (const update of updates) {
      const lines = [
        `Update available for ${update.name}: ${update.currentVersion} → ${update.latestVersion}`,
        `Run: ${update.installCommand}`,
      ];
      if (update.changelogUrl) {
        lines.push(`Changelog: ${update.changelogUrl}`);
      }
      ctx.ui.notify(lines.join('\n'), 'warning');
    }
  });
}
