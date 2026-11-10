import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { DynamicBorder } from '@earendil-works/pi-coding-agent';
import { Container, Spacer, Text } from '@earendil-works/pi-tui';
import type { SystemDiagnostic } from 'sandpiper-ai-core';
import * as core from 'sandpiper-ai-core';

const DIAGNOSTICS_BANNER_ENTRY_TYPE = 'sandpiper:diagnostics-banner';

interface DiagnosticsBannerData {
  readonly diagnostics: readonly SystemDiagnostic[];
}

export function registerDiagnosticsHooks(pi: ExtensionAPI): void {
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

  pi.on('session_start', async (_event, ctx) => {
    const plan = core.buildSystemDiagnosticsStartupPlan({ cwd: ctx.cwd });

    if (plan.unhealthyDiagnostics.length > 0) {
      pi.appendEntry<DiagnosticsBannerData>(DIAGNOSTICS_BANNER_ENTRY_TYPE, { diagnostics: plan.unhealthyDiagnostics });
    }
  });
}
