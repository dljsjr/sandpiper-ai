import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import {
  formatInstallInstructions,
  installShellIntegrations,
  type MigrationMode,
  parseMigrationCommandArgs,
  parseMigrationScope,
  performMigration,
} from 'sandpiper-ai-core';

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

export function registerMigrationControls(pi: ExtensionAPI): void {
  pi.registerFlag('install-shell-integrations', {
    description:
      'Install shell integration scripts to ~/.sandpiper/shell-integrations/, print sourcing instructions, then exit',
    type: 'boolean',
    default: false,
  });

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

  pi.on('session_directory', async (event) => {
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

    if (hasScope && !migrate && !symlink) {
      console.error(
        'Error: --pi-configs-global and --pi-configs-local require --migrate-pi-configs or --symlink-config.',
      );
      process.exit(1);
    }

    if (migrate && symlink) {
      console.error('Error: --migrate-pi-configs and --symlink-config are mutually exclusive.');
      process.exit(1);
    }

    if (migrate) await handleMigrationFlag(pi, 'move', event.cwd);
    if (symlink) await handleMigrationFlag(pi, 'symlink', event.cwd);
  });

  pi.registerCommand('migrate-pi', {
    description: 'Migrate pi configs to sandpiper (move|symlink [--pi-configs-global|--pi-configs-local])',
    getArgumentCompletions: (prefix: string) => {
      const options = ['move', 'symlink', '--pi-configs-global', '--pi-configs-local'];
      return options.filter((option) => option.startsWith(prefix)).map((option) => ({ value: option, label: option }));
    },
    handler: async (args, ctx) => {
      const parsed = parseMigrationCommandArgs(args ?? '');

      if ('error' in parsed) {
        ctx.ui.notify(parsed.error, 'error');
        return;
      }

      const result = await performMigration(parsed.mode, { cwd: ctx.cwd, scope: parsed.scope });

      if (result.success) {
        ctx.ui.setWidget('sandpiper-diagnostics', undefined);
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
}
