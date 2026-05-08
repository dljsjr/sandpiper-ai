import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import * as core from 'sandpiper-ai-core';

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

  // Migration flags trigger early-exit behavior (process.exit) before any interaction.
  // Previously session_directory; moved to session_start (Pi 0.65.0 removed session_directory).
  pi.on('session_start', async (_event, ctx) => {
    const result = await core.executeMigrationStartupControls({
      cwd: ctx.cwd,
      flags: {
        installShellIntegrations: pi.getFlag('install-shell-integrations') === true,
        migratePiConfigs: pi.getFlag('migrate-pi-configs') === true,
        symlinkConfig: pi.getFlag('symlink-config') === true,
        piConfigsGlobal: pi.getFlag('pi-configs-global') === true,
        piConfigsLocal: pi.getFlag('pi-configs-local') === true,
      },
    });

    if (result.kind === 'exit') {
      for (const line of result.stdout) console.log(line);
      for (const line of result.stderr) console.error(line);
      process.exit(result.exitCode);
    }
  });

  pi.registerCommand('migrate-pi', {
    description: 'Migrate pi configs to sandpiper (move|symlink [--pi-configs-global|--pi-configs-local])',
    getArgumentCompletions: (prefix: string) => {
      const options = ['move', 'symlink', '--pi-configs-global', '--pi-configs-local'];
      return options.filter((option) => option.startsWith(prefix)).map((option) => ({ value: option, label: option }));
    },
    handler: async (args, ctx) => {
      const result = await core.executeMigrationCommand({ args, cwd: ctx.cwd });

      if (result.kind === 'notify') {
        ctx.ui.notify(result.message, result.level);
        return;
      }

      ctx.ui.setWidget(result.clearDiagnosticsWidget, undefined);
      ctx.ui.notify(result.message, result.level);
      await ctx.reload();
    },
  });
}
