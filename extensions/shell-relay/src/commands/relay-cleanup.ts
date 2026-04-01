import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import type { RelayRuntime } from '../types.js';
import { ZellijClient } from '../zellij.js';

export function registerRelayCleanupCommand(pi: ExtensionAPI, runtime: RelayRuntime): void {
  pi.registerCommand('relay-cleanup', {
    description: 'Remove stale EXITED relay sessions from Zellij',
    handler: async (_args, ctx) => {
      const probe = new ZellijClient({ sessionName: '' });
      if (!probe.isAvailable()) {
        ctx.ui.notify('Zellij is not installed or not available.', 'error');
        return;
      }

      const currentSession = runtime.getCurrentSessionName();
      const stale = probe
        .listSessionsWithStatus()
        .filter(
          (staleSession) =>
            staleSession.name.startsWith('relay-') && staleSession.exited && staleSession.name !== currentSession,
        );

      if (stale.length === 0) {
        ctx.ui.notify('No stale relay sessions found.', 'info');
        return;
      }

      const sessionList = stale.map((staleSession) => `  ${staleSession.name}`).join('\n');
      const confirmed = await ctx.ui.confirm(
        `Delete ${stale.length} stale relay session${stale.length > 1 ? 's' : ''}?`,
        `The following EXITED relay sessions will be permanently deleted:\n${sessionList}`,
      );
      if (!confirmed) return;

      let deleted = 0;
      let failed = 0;
      for (const staleSession of stale) {
        try {
          probe.deleteSession(staleSession.name);
          deleted++;
        } catch {
          failed++;
        }
      }

      if (failed > 0) {
        ctx.ui.notify(
          `Deleted ${deleted} session${deleted !== 1 ? 's' : ''}. ${failed} could not be deleted.`,
          'warning',
        );
      } else {
        ctx.ui.notify(`Deleted ${deleted} stale relay session${deleted !== 1 ? 's' : ''}.`, 'info');
      }
    },
  });
}
