import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { DynamicBorder } from '@earendil-works/pi-coding-agent';
import { Container, Spacer, Text } from '@earendil-works/pi-tui';
import type { SystemDiagnostic, UpdateInfo } from 'sandpiper-ai-core';
import * as core from 'sandpiper-ai-core';

const DIAGNOSTICS_BANNER_ENTRY_TYPE = 'sandpiper:diagnostics-banner';
const UPDATE_BANNER_ENTRY_TYPE = 'sandpiper:update-banner';

interface DiagnosticsBannerData {
  readonly diagnostics: readonly SystemDiagnostic[];
}

export function registerDiagnosticsHooks(
  pi: ExtensionAPI,
  checkForUpdates: () => Promise<readonly UpdateInfo[]>,
): void {
  pi.registerEntryRenderer<DiagnosticsBannerData>(DIAGNOSTICS_BANNER_ENTRY_TYPE, (entry, _options, theme) => {
    const data = entry.data;
    if (!data || data.diagnostics.length === 0) {
      return undefined;
    }

    const container = new Container();
    container.addChild(new Spacer(1));
    container.addChild(new DynamicBorder((segment: string) => theme.fg('warning', segment)));
    container.addChild(new Text(theme.bold(theme.fg('warning', '⚠  Sandpiper Diagnostics')), 1, 0));
    for (const diagnostic of data.diagnostics) {
      container.addChild(new Text(`  ${theme.fg('warning', diagnostic.message)}`, 1, 0));
      for (const instruction of diagnostic.instructions ?? []) {
        container.addChild(new Text(theme.fg('muted', `    ${instruction}`), 1, 0));
      }
    }
    container.addChild(new DynamicBorder((segment: string) => theme.fg('warning', segment)));
    return container;
  });

  pi.registerEntryRenderer<UpdateInfo>(UPDATE_BANNER_ENTRY_TYPE, (entry, _options, theme) => {
    const update = entry.data;
    if (!update) {
      return undefined;
    }

    const container = new Container();
    container.addChild(new Spacer(1));
    container.addChild(new DynamicBorder((segment: string) => theme.fg('warning', segment)));
    const heading = theme.bold(theme.fg('warning', 'Update Available'));
    const versionLine =
      theme.fg('muted', `New version of ${update.name}: ${update.currentVersion} → ${update.latestVersion}. Run `) +
      theme.fg('accent', update.installCommand);
    let content = `${heading}\n${versionLine}`;
    if (update.changelogUrl) {
      content += `\n${theme.fg('muted', 'Changelog: ')}${theme.fg('accent', update.changelogUrl)}`;
    }
    container.addChild(new Text(content, 1, 0));
    container.addChild(new DynamicBorder((segment: string) => theme.fg('warning', segment)));
    return container;
  });

  pi.on('session_start', async (_event, ctx) => {
    const plan = core.buildSystemDiagnosticsStartupPlan({ cwd: ctx.cwd });

    if (plan.unhealthyDiagnostics.length > 0) {
      pi.appendEntry<DiagnosticsBannerData>(DIAGNOSTICS_BANNER_ENTRY_TYPE, { diagnostics: plan.unhealthyDiagnostics });
    }

    if (plan.shouldCheckForUpdates) {
      checkForUpdates().then((updates) => {
        for (const update of updates) {
          pi.appendEntry<UpdateInfo>(UPDATE_BANNER_ENTRY_TYPE, update);
        }
      });
    }
  });
}
