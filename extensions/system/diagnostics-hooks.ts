import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { DynamicBorder } from '@earendil-works/pi-coding-agent';
import { Spacer, Text } from '@earendil-works/pi-tui';
import type { UpdateInfo } from 'sandpiper-ai-core';
import * as core from 'sandpiper-ai-core';
import { getChatContainer } from './chat-container.js';

export function registerDiagnosticsHooks(
  pi: ExtensionAPI,
  checkForUpdates: () => Promise<readonly UpdateInfo[]>,
): void {
  pi.on('session_start', async (_event, ctx) => {
    const plan = core.buildSystemDiagnosticsStartupPlan({ cwd: ctx.cwd, preflightSource: pi });

    ctx.ui.setWidget('sandpiper-banners', (tui, theme) => {
      const chatContainer = getChatContainer(tui);
      if (chatContainer) {
        if (plan.unhealthyDiagnostics.length > 0) {
          chatContainer.addChild(new Spacer(1));
          chatContainer.addChild(new DynamicBorder((segment: string) => theme.fg('warning', segment)));
          chatContainer.addChild(new Text(theme.bold(theme.fg('warning', '⚠  Sandpiper Diagnostics')), 1, 0));
          for (const diagnostic of plan.unhealthyDiagnostics) {
            chatContainer.addChild(new Text(`  ${theme.fg('warning', diagnostic.message)}`, 1, 0));
            for (const instruction of diagnostic.instructions ?? []) {
              chatContainer.addChild(new Text(theme.fg('muted', `    ${instruction}`), 1, 0));
            }
          }
          chatContainer.addChild(new DynamicBorder((segment: string) => theme.fg('warning', segment)));
        }

        if (plan.shouldCheckForUpdates) {
          checkForUpdates().then((updates) => {
            for (const update of updates) {
              chatContainer.addChild(new Spacer(1));
              chatContainer.addChild(new DynamicBorder((segment: string) => theme.fg('warning', segment)));
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
              chatContainer.addChild(new DynamicBorder((segment: string) => theme.fg('warning', segment)));
            }
          });
        }
      }

      return { render: () => [], invalidate: () => {} };
    });
    ctx.ui.setWidget('sandpiper-banners', undefined);
  });
}
